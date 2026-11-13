"""Telegram commands, read with getUpdates on each run (no server, no webhook).

Only messages from TELEGRAM_CHAT_ID are obeyed. Changes are stored in state/prefs-overrides.json and override
notify-config.json. Commands: /help /status /latest /digest /mute 2h /unmute /threshold SYMBOL PCT /importance N /desks
"""
import re
from datetime import timedelta

from common import LIVE, STATE, env, iso, load_prefs, log, now_utc, parse_iso, read_json, registry_tree, short_err, update_status, write_json
import notify

OVR = STATE / 'prefs-overrides.json'
TSTATE = STATE / 'telegram.json'

HELP = ('<b>Adrian Financial Agents bot</b>\n'
        '/status — automation status\n/latest — 5 latest high-importance stories\n/digest — send a digest now\n'
        '/mute 2h — pause instant alerts (m, h or d)\n/unmute — resume alerts\n'
        '/threshold VNINDEX 1.5 — price alert at ±1.5% (0 = off)\n/importance 3 — min importance for Telegram (1–3)\n'
        '/desks — desks and story counts (24h)\n\nCommands are read every automation run (about every 15 min).')


def whoami():
    """Local helper: print chat ids that messaged the bot, so the user can set TELEGRAM_CHAT_ID. Never stored."""
    if not env('TELEGRAM_BOT_TOKEN'):
        print('Set TELEGRAM_BOT_TOKEN in .env first.')
        return
    ups = notify.tg_call('getUpdates', timeout=0)
    seen = {}
    for u in ups:
        m = u.get('message') or {}
        c = m.get('chat') or {}
        if c.get('id'):
            seen[c['id']] = c.get('username') or c.get('title') or c.get('first_name') or ''
    if not seen:
        print('No messages yet. Open your bot in Telegram, send /start, then run this again.')
    for cid, name in seen.items():
        print(f'chat id {cid}  ({name})  -> put TELEGRAM_CHAT_ID={cid} in .env')


def run():
    if not (env('TELEGRAM_BOT_TOKEN') and env('TELEGRAM_CHAT_ID')):
        return 0
    st = read_json(TSTATE, {'offset': 0})
    now = now_utc()
    try:
        ups = notify.tg_call('getUpdates', offset=st['offset'], timeout=0, allowed_updates='["message"]')
    except Exception as e:
        update_status('jobs', 'telegram', {'lastRun': iso(now), 'ok': False, 'error': short_err(e)})
        return 0
    handled = 0
    for u in ups:
        st['offset'] = u['update_id'] + 1
        m = u.get('message') or {}
        if str((m.get('chat') or {}).get('id')) != env('TELEGRAM_CHAT_ID'):
            continue  # ignore everyone else
        text = (m.get('text') or '').strip()
        if text.startswith('/'):
            try:
                reply = handle(text, now)
            except Exception as e:
                reply = f'Error: {notify.esc(short_err(e))}'
            if reply:
                notify.send_telegram(reply)
            handled += 1
    write_json(TSTATE, st)
    update_status('jobs', 'telegram', {'lastRun': iso(now), 'ok': True, 'commands': handled})
    if handled:
        log(f'telegram: {handled} commands')
    return handled


def handle(text, now):
    parts = text.split()
    cmd = parts[0].split('@')[0].lower()
    args = parts[1:]
    ovr = read_json(OVR, {}) or {}
    if cmd in ('/start', '/help'):
        return HELP
    if cmd == '/status':
        s = read_json(LIVE / 'status.json', {}) or {}
        jobs = s.get('jobs', {})
        lines = ['<b>Status</b>']
        for k in ('news', 'market', 'rates', 'translate', 'alerts', 'digest'):
            j = jobs.get(k) or (s.get('translate') if k == 'translate' else None)
            if j:
                lines.append(f'{k}: last run {notify.local_str(parse_iso(j.get("lastRun", iso(now))) or now, load_prefs())}')
        m = parse_iso(ovr.get('mutedUntil') or '')
        lines.append('Alerts: ' + (f'muted until {notify.local_str(m, load_prefs())}' if m and m > now else 'on'))
        return '\n'.join(lines)
    if cmd == '/latest':
        news = (read_json(LIVE / 'news.json', {}) or {}).get('items', [])
        top = [n for n in news if n['importance'] >= 3][:5] or news[:5]
        return '\n'.join(['<b>Latest</b>'] + [f'• <a href="{notify.esc(n["url"])}">{notify.esc(n["headline"])}</a>' for n in top])
    if cmd == '/digest':
        prefs = load_prefs()
        _, _, _, tg = notify.build_digest(prefs, 'telegram', now, 'On-demand')
        for m in tg:
            notify.send_telegram(m)
        return None
    if cmd == '/mute':
        m = re.fullmatch(r'(\d+)([mhd]?)', args[0] if args else '2h')
        if not m:
            return 'Usage: /mute 2h'
        n, unit = int(m.group(1)), m.group(2) or 'h'
        until = now + timedelta(**{'m': {'minutes': n}, 'h': {'hours': n}, 'd': {'days': n}}[unit])
        ovr['mutedUntil'] = iso(until)
        write_json(OVR, ovr, pretty=True)
        return f'Instant alerts muted until {notify.local_str(until, load_prefs())}.'
    if cmd == '/unmute':
        ovr.pop('mutedUntil', None)
        write_json(OVR, ovr, pretty=True)
        return 'Instant alerts resumed.'
    if cmd == '/threshold':
        if len(args) != 2:
            return 'Usage: /threshold VNINDEX 1.5'
        sym, pct = args[0].upper(), float(args[1].replace(',', '.'))
        ovr.setdefault('thresholds', {})[sym] = pct
        write_json(OVR, ovr, pretty=True)
        return f'Price alert for {notify.esc(sym)} set to ±{pct}%' if pct else f'Price alert for {notify.esc(sym)} turned off'
    if cmd == '/importance':
        n = int(args[0]) if args and args[0].isdigit() else 0
        if n not in (1, 2, 3):
            return 'Usage: /importance 1|2|3'
        ovr.setdefault('minImportance', {})['telegram'] = n
        write_json(OVR, ovr, pretty=True)
        return f'Telegram now receives stories with importance ≥ {n}.'
    if cmd == '/desks':
        desks = (read_json(LIVE / 'status.json', {}) or {}).get('desks', {})
        lines = ['<b>Desks (stories, 24h)</b>']
        for _, div, deps in registry_tree():
            lines.append(f'<i>{notify.esc(div)}</i>')
            lines += [f'  {notify.esc(name)}: {desks.get(dep, {}).get("last24h", 0)}' for dep, name in deps]
        return '\n'.join(lines)
    return 'Unknown command. /help'
