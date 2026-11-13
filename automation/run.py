"""Adrian Financial Agents — Phase 3 automation entry point.

  python automation/run.py --job due            run whatever is due now (what the 15-minute cron calls)
  python automation/run.py --job all            run everything now (news, market, rates, translate, alerts)
  python automation/run.py --job news|market|rates|translate|alerts|digest|telegram
  python automation/run.py --loop               keep running 'due' every minute on this computer
  python automation/run.py --telegram-whoami    print your Telegram chat id (after sending /start to the bot)
  python automation/run.py --digest-styles      preview the email digest in every design direction (out/preview/compare.html)
  add --dry-run to send nothing: email/Telegram previews are written to automation/out/preview/
"""
import argparse
import sys
import time
from datetime import timedelta

sys.path.insert(0, __import__('os').path.dirname(__file__))

import common  # noqa: E402
from common import STATE, hm, iso, load_env, load_prefs, local_tz, log, now_utc, parse_iso, read_json, write_json  # noqa: E402

SCHED = STATE / 'schedule.json'


def due_jobs(prefs, sched, now):
    s = prefs.get('schedule', {})
    jobs = []

    def since(job):
        t = parse_iso(sched.get(job, '') or '')
        return (now - t).total_seconds() / 60 if t else 1e9

    if since('news') >= s.get('newsEveryMin', 30) - 1:
        jobs.append('news')
    if since('market') >= s.get('marketEveryMin', 15) - 1:
        jobs.append('market')
    loc = now.astimezone(local_tz(prefs))
    last_rates = parse_iso(sched.get('rates', '') or '')
    for t in s.get('ratesTimes', []):
        h, m = hm(t)
        slot = loc.replace(hour=h, minute=m, second=0, microsecond=0)
        if slot <= loc and (not last_rates or last_rates < slot):
            jobs.append('rates')
            break
    jobs += ['translate', 'alerts', 'telegram']
    last_digest = parse_iso(sched.get('digest', '') or '')
    times = sorted(prefs.get('digest', {}).get('times', []), key=hm)
    for i, t in enumerate(times):
        h, m = hm(t)
        slot = loc.replace(hour=h, minute=m, second=0, microsecond=0)
        if slot <= loc < slot + timedelta(hours=3) and (not last_digest or last_digest < slot):
            # each digest covers the news since the previous slot (the last slot of yesterday for the first one)
            ph, pm = hm(times[i - 1])
            prev = slot.replace(hour=ph, minute=pm) - (timedelta(days=1) if i == 0 else timedelta(0))
            jobs.append(('digest', slot_name(h), prev))
            break
    return jobs


def slot_name(hour):
    """Digest edition by Vietnam-time hour: Morning before 12:00, Afternoon before 18:00, then Evening."""
    return 'Morning' if hour < 12 else 'Afternoon' if hour < 18 else 'Evening'


def run_jobs(jobs, force_market=False):
    import market
    import news
    import notify
    import telegram_bot
    import translate

    prefs = load_prefs()
    sched = read_json(SCHED, {}) or {}
    now = now_utc()
    rate_changes = []
    for job in jobs:
        name = job[0] if isinstance(job, tuple) else job
        log(f'> {name}')
        try:
            if name == 'news':
                news.run()
            elif name == 'market':
                market.run(force=force_market)
            elif name == 'rates':
                rate_changes = market.run_rates()
            elif name == 'translate':
                translate.run()
            elif name == 'alerts':
                notify.run_alerts(prefs, rate_changes)
            elif name == 'digest':
                if isinstance(job, tuple):
                    notify.run_digest(prefs, job[1], since=job[2])
                else:
                    notify.run_digest(prefs, 'On-demand')
            elif name == 'telegram':
                telegram_bot.run()
            sched[name] = iso(now)
        except SystemExit:
            raise
        except Exception as e:  # one failing job never stops the others
            log(f'  {name} FAILED: {common.short_err(e)}')
    write_json(SCHED, sched, pretty=True)


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--job', default='due')
    p.add_argument('--loop', action='store_true')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--telegram-whoami', action='store_true')
    p.add_argument('--digest-styles', action='store_true', help='write email previews of every design direction + compare.html')
    a = p.parse_args()
    load_env()
    common.DRY_RUN = a.dry_run
    if a.digest_styles:
        import notify
        notify.write_style_previews(load_prefs())
        return
    if a.telegram_whoami:
        import telegram_bot
        telegram_bot.whoami()
        return
    if a.dry_run:
        log('DRY RUN: nothing will be sent')

    def once():
        if a.job == 'due':
            prefs = load_prefs()
            jobs = due_jobs(prefs, read_json(SCHED, {}) or {}, now_utc())
            run_jobs(jobs)
        elif a.job == 'all':
            run_jobs(['news', 'market', 'rates', 'translate', 'alerts', 'telegram'], force_market=True)
        else:
            run_jobs([a.job], force_market=True)

    if not a.loop:
        once()
        return
    log('loop mode: checking every 60 s (Ctrl+C to stop)')
    a.job = 'due'
    while True:
        once()
        time.sleep(60)


if __name__ == '__main__':
    main()
