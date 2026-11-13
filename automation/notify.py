"""Distribution: rule-based digests and instant alerts over Email (Gmail SMTP) and Telegram. 0 tokens.

Secrets come from the environment only: GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAIL_TO,
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. With --dry-run nothing is sent; previews go to automation/out/preview/.
"""
import html
import json
import smtplib
import ssl
from datetime import timedelta
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlencode

import common
import email_digest
import telegram_format
from common import (LIVE, PREVIEW, STATE, env, hm, http_get, iso, local_tz, log, now_utc, parse_iso,
                    read_json, registry_tree, short_err, update_status, write_json, write_text)

SENT = STATE / 'sent.json'
SITE_URL = common.SITE_URL
DIGEST_SYMBOLS = ['VNINDEX', 'VN30', 'SPX', 'IXIC', 'DJI', 'USDVND', 'DXY', 'XAUUSD', 'BRENT', 'US10Y']
IMP = {1: 'Low', 2: 'Medium', 3: 'High'}
EMAIL_PER_DESK = 3  # keeps the email under Gmail's ~100 KB clipping limit
esc = html.escape


# ---------- prefs helpers ----------

def channel_configured(ch):
    if ch == 'email':
        return bool(env('GMAIL_USER') and env('GMAIL_APP_PASSWORD') and env('NOTIFY_EMAIL_TO'))
    return bool(env('TELEGRAM_BOT_TOKEN') and env('TELEGRAM_CHAT_ID'))


def passes(item, prefs, min_imp):
    f = prefs.get('filters', {})
    return (item.get('importance', 1) >= min_imp
            and (not f.get('divisions') or item.get('divisionId') in f['divisions'])
            and (not f.get('departments') or item.get('departmentId') in f['departments'])
            and (not f.get('categories') or item.get('category') in f['categories']))


def in_quiet_hours(prefs, now):
    q = prefs.get('quietHours') or {}
    if not q.get('enabled'):
        return False
    t = now.astimezone(local_tz(prefs))
    cur = t.hour * 60 + t.minute
    (sh, sm), (eh, em) = hm(q['start']), hm(q['end'])
    s, e = sh * 60 + sm, eh * 60 + em
    return s <= cur or cur < e if s > e else s <= cur < e


def muted(prefs, now):
    m = parse_iso(prefs.get('_mutedUntil') or '')
    return bool(m and m > now)


def fmt_num(v, dp):
    if v is None:
        return '—'
    return f'{v:,.{dp}f}'


def fmt_pct(p):
    return f'{"+" if p >= 0 else ""}{p:.2f}%'


def local_str(dt, prefs, fmt='%d/%m %H:%M'):
    return dt.astimezone(local_tz(prefs)).strftime(fmt)


# ---------- content ----------

def load_live():
    news = (read_json(LIVE / 'news.json', {}) or {}).get('items', [])
    quotes = {q['symbol']: q for q in (read_json(LIVE / 'quotes.json', {}) or {}).get('items', [])}
    rates = read_json(LIVE / 'bank-rates.json', {}) or {}
    return news, quotes, rates


def build_digest(prefs, ch, now, slot_label, style=None, since=None):
    """Return (subject, text, email (html, images), [telegram messages]) for one channel.

    `since`: start of the window. Scheduled digests pass the previous slot (news since the last digest);
    on-demand digests (job=digest, Telegram /digest) look back `digest.lookbackHours`."""
    news, quotes, rates = load_live()
    d = prefs.get('digest', {})
    if since is None:
        since = now - timedelta(hours=d.get('lookbackHours', 14))
    hours = max(1, round((now - since).total_seconds() / 3600))
    min_imp = prefs['channels'][ch].get('minImportance', 1)
    items = [n for n in news if (parse_iso(n['publishedAt']) or now) >= since and passes(n, prefs, min_imp)]
    per = d.get('maxItemsPerDesk', 5)
    sections, rich = [], []  # rich: (div_id, [(dep_id, desk_name, rows)]) for the email layout
    for div_id, div_name, deps in registry_tree():
        desks, rdesks = [], []
        for dep_id, dep_name in deps:
            rows = sorted([dict(n, _deskName=dep_name) for n in items if n['departmentId'] == dep_id],
                          key=lambda n: (n['importance'], n['publishedAt']), reverse=True)[:per]
            if rows:
                desks.append((dep_name, rows))
                rdesks.append((dep_id, dep_name, rows[:EMAIL_PER_DESK]))
        if desks:
            sections.append((div_name, desks))
            rich.append((div_id, rdesks))

    mk = [quotes[s] for s in DIGEST_SYMBOLS if s in quotes] if d.get('includeMarkets', True) else []
    rc = [c for c in rates.get('changes', []) if (parse_iso(c['date']) or now) >= since] if d.get('includeRates', True) else []
    live_banks = rates.get('banks', []) if d.get('includeRates', True) else []

    date = local_str(now, prefs, '%d/%m/%Y')
    subject = f'◈ AFA Intelligence Digest · {slot_label} · {date}'
    total = sum(len(r) for _, ds in sections for _, r in ds)

    # plain text
    t = [subject, f'{total} stories in the last {hours}h', '']
    for div_name, desks in sections:
        t.append(f'== {div_name} ==')
        for dep_name, rows in desks:
            t.append(f'-- {dep_name}')
            for n in rows:
                t.append(f'[{IMP[n["importance"]]}] {n["headline"]} ({n["source"]}, {local_str(parse_iso(n["publishedAt"]), prefs)})')
                t.append(f'   {n["url"]}')
        t.append('')
    if mk:
        t.append('== Markets ==')
        t += [f'{q["name"]}: {fmt_num(q["price"], q["dp"])} ({fmt_pct(q["changePct"])})' for q in mk]
        t.append('')
    if live_banks or rc:
        t.append('== Deposit rates (12M) ==')
        t += [f'{b["bank"]}: {b["deposit"].get("12M")}% p.a.' for b in live_banks]
        t += [f'{c["bank"]} {c["key"]}: {c["from"]}% -> {c["to"]}%' for c in rc]
    t += ['', f'Dashboard: {SITE_URL}']
    text = '\n'.join(t)

    # email html: AI Financial Intelligence Center layout (email_digest.py), inline logo/avatars
    email_html = email_digest.render(prefs, now, slot_label, rich, mk, live_banks, rc, quotes, total,
                                     hours, style or d.get('style', 'cinematic'))

    # telegram: opening brief (markets) + one Brief Card message per division (telegram_format.py)
    tg = [telegram_format.opening_message(prefs, now, slot_label, total, len(rich), mk)]
    tg += telegram_format.division_messages(rich, quotes, prefs, now, slot_label)
    return subject, text, email_html, tg


def collect_alerts(prefs, now, sent, new_rate_changes):
    """Instant alerts not yet sent: high-importance news, price moves over threshold, rate changes."""
    news, quotes, _ = load_live()
    ins = prefs.get('instant', {})
    tz_day = now.astimezone(local_tz(prefs)).strftime('%Y-%m-%d')
    out = {'news': [], 'prices': [], 'rates': []}
    if ins.get('news', True):
        recent = now - timedelta(hours=6)
        for n in news:
            if (n['id'] not in sent['news'] and (parse_iso(n['publishedAt']) or now) >= recent
                    and passes(n, prefs, ins.get('minImportance', 3))):
                out['news'].append(n)
        out['news'] = out['news'][:ins.get('maxPerRun', 5)]
    if ins.get('prices', True):
        th = prefs.get('thresholds', {})
        for sym, q in quotes.items():
            lim = th.get('prices', {}).get(sym, th.get('defaultPricePct', 0))
            if not lim or abs(q['changePct']) < lim:
                continue
            bucket = int(abs(q['changePct']) // lim)
            key = f'{sym}:{tz_day}:{bucket}:{"up" if q["changePct"] >= 0 else "down"}'
            if key not in sent['prices']:
                out['prices'].append((key, q, lim))
    if ins.get('rates', True):
        bps = prefs.get('thresholds', {}).get('rateBps', 20)
        for c in new_rate_changes:
            if abs(c['to'] - c['from']) * 100 >= bps:
                out['rates'].append(c)
    return out


def alert_messages(alerts, prefs, ch):
    min_imp = prefs['channels'][ch].get('minImportance', 1)
    news = [n for n in alerts['news'] if n['importance'] >= min_imp]
    if not (news or alerts['prices'] or alerts['rates']):
        return None
    lines_t, lines_h = ['Adrian Financial Agents · Alert'], ['<b>⚡ Adrian Financial Agents · Alert</b>']
    tg_market = []
    for n in news:
        lines_t += [f'[{IMP[n["importance"]]}] {n["headline"]} ({n["source"]})', f'  {n["url"]}']
        lines_h.append(f'🔴 <a href="{esc(n["url"])}">{esc(n["headline"])}</a> · {esc(n["source"])}')
    for _, q, lim in alerts['prices']:
        s = f'{q["name"]} {fmt_pct(q["changePct"])} → {fmt_num(q["price"], q["dp"])} (threshold ±{lim}%)'
        lines_t.append(s)
        lines_h.append(('📈 ' if q['changePct'] >= 0 else '📉 ') + esc(s))
        tg_market.append(f'{"📈" if q["changePct"] >= 0 else "📉"} <b>{esc(q["name"])}</b> {telegram_format.arrow(q["changePct"])} '
                         f'<b>{telegram_format.vn_pct(q["changePct"])}</b> → {telegram_format.vn_num(q["price"], q["dp"])} <i>(±{lim}%)</i>')
    for c in alerts['rates']:
        s = f'{c["bank"]} {c["kind"]} {c["key"]}: {c["from"]}% → {c["to"]}%'
        lines_t.append(s)
        lines_h.append('🏦 ' + esc(s))
        tg_market.append(f'🏦 <b>{esc(c["bank"])}</b> {esc(c["key"])}: {c["from"]:.2f}% → <b>{c["to"]:.2f}%</b>'.replace('.', ','))
    _, quotes, _ = load_live()
    tg = ([('⚡ <b>Market alert</b>\n' + '\n'.join(tg_market))] if tg_market else []) + \
        telegram_format.alert_division_messages(news, quotes, prefs, now_utc())
    subject = f'AFA alert · {len(news)} news · {len(alerts["prices"])} price · {len(alerts["rates"])} rate'
    return subject, '\n'.join(lines_t), '<br>'.join(lines_h), tg


# ---------- transport ----------

def send_email(subject, text, html_body, images=None):
    """multipart/related (html + inline CID images) inside multipart/alternative with a plain-text part."""
    msg = MIMEMultipart('related')
    msg['Subject'] = subject
    msg['From'] = f'Adrian Financial Agents <{env("GMAIL_USER")}>'
    to = [a.strip() for a in env('NOTIFY_EMAIL_TO').split(',') if a.strip()]
    msg['To'] = ', '.join(to)
    alt = MIMEMultipart('alternative')
    alt.attach(MIMEText(text, 'plain', 'utf-8'))
    alt.attach(MIMEText(html_body, 'html', 'utf-8'))
    msg.attach(alt)
    for name, (cid, path) in (images or {}).items():
        img = MIMEImage(path.read_bytes(), 'png')
        img.add_header('Content-ID', f'<{cid}>')
        img.add_header('Content-Disposition', 'inline', filename=name)
        msg.attach(img)
    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ssl.create_default_context(), timeout=30) as s:
        s.login(env('GMAIL_USER'), env('GMAIL_APP_PASSWORD'))
        s.sendmail(env('GMAIL_USER'), to, msg.as_string())


def tg_call(method, **params):
    url = f'https://api.telegram.org/bot{env("TELEGRAM_BOT_TOKEN")}/{method}'
    raw = http_get(url, data=urlencode(params).encode(), headers={'Content-Type': 'application/x-www-form-urlencoded'}, retries=1)
    res = json.loads(raw)
    if not res.get('ok'):
        raise RuntimeError(f'Telegram {method}: {res.get("description")}')
    return res['result']


def send_telegram(text, chat_id=None):
    chunks, cur = [], ''
    for line in text.split('\n'):
        if len(cur) + len(line) + 1 > 3800:
            chunks.append(cur)
            cur = ''
        cur += line + '\n'
    if cur.strip():
        chunks.append(cur)
    for c in chunks:
        tg_call('sendMessage', chat_id=chat_id or env('TELEGRAM_CHAT_ID'), text=c, parse_mode='HTML',
                disable_web_page_preview='true')


def deliver(kind, ch, subject, text, html_body, tg_html, now):
    """Send one message on one channel (or write a preview in dry-run). Records channel status."""
    stamp = now.strftime('%Y%m%d-%H%M%S')
    st = (read_json(LIVE / 'status.json', {}) or {}).get('channels', {}).get(ch, {})
    st['configured'] = channel_configured(ch)
    images = {}
    if isinstance(html_body, tuple):
        html_body, images = html_body
    try:
        if common.DRY_RUN:
            if ch == 'email':
                write_text(PREVIEW / f'{stamp}-{kind}-email.html', email_digest.preview_html(html_body, images) if images
                           else f'<!doctype html><meta charset="utf-8"><title>{esc(subject)}</title>{html_body}')
                write_text(PREVIEW / f'{stamp}-{kind}-email.txt', text)
            else:
                write_text(PREVIEW / f'{stamp}-{kind}-telegram.txt',
                           ('\n\n═══════ next message ═══════\n\n'.join(tg_html) if isinstance(tg_html, list) else tg_html))
            log(f'  [dry-run] {kind} {ch} preview written')
            st['lastPreview'] = iso(now)
        elif not st['configured']:
            log(f'  {ch} not configured (secrets missing), skipped')
            st['lastSkipped'] = iso(now)
        else:
            if ch == 'email':
                send_email(subject, text, html_body, images)
            else:
                for m in (tg_html if isinstance(tg_html, list) else [tg_html]):
                    send_telegram(m)
            st['lastSent'] = iso(now)
            st['lastKind'] = kind
            st.pop('lastError', None)
            log(f'  {kind} sent via {ch}')
    except Exception as e:
        st['lastError'] = short_err(e)
        log(f'  {ch} send failed', short_err(e))
    update_status('channels', ch, st)


# ---------- jobs ----------

def run_digest(prefs, slot_label, since=None):
    """Scheduled digests are not held by quiet hours or /mute (those only hold instant alerts)."""
    now = now_utc()
    for ch, cfg in prefs.get('channels', {}).items():
        if cfg.get('enabled') and cfg.get('digest'):
            subject, text, h, tg = build_digest(prefs, ch, now, slot_label, since=since)
            deliver('digest', ch, subject, text, h, tg, now)
    update_status('jobs', 'digest', {'lastRun': iso(now), 'slot': slot_label})


def run_alerts(prefs, new_rate_changes=()):
    now = now_utc()
    sent = read_json(SENT, None)
    first = sent is None
    sent = sent or {'news': [], 'prices': [], 'rates': []}
    alerts = collect_alerts(prefs, now, sent, list(new_rate_changes))
    n_total = len(alerts['news']) + len(alerts['prices']) + len(alerts['rates'])
    skip_reason = None
    if first:
        skip_reason = 'first run: existing items marked as seen'
    elif not prefs.get('instant', {}).get('enabled', True):
        skip_reason = 'instant alerts disabled'
    elif in_quiet_hours(prefs, now):
        skip_reason = 'quiet hours'
    elif muted(prefs, now):
        skip_reason = 'muted from Telegram'
    if n_total and not skip_reason:
        for ch, cfg in prefs.get('channels', {}).items():
            if cfg.get('enabled') and cfg.get('instant'):
                m = alert_messages(alerts, prefs, ch)
                if m:
                    deliver('alert', ch, *m, now)
    if first:  # seed with everything currently visible so the first run does not flood
        news, _, _ = load_live()
        sent['news'] = [n['id'] for n in news]
    sent['news'] = (sent['news'] + [n['id'] for n in alerts['news']])[-3000:]
    sent['prices'] = (sent['prices'] + [k for k, _, _ in alerts['prices']])[-500:]
    write_json(SENT, sent)
    update_status('jobs', 'alerts', {'lastRun': iso(now), 'candidates': n_total, 'skipped': skip_reason})
    log(f'alerts: {n_total} candidates' + (f' (not sent: {skip_reason})' if skip_reason and n_total else ''))


def write_style_previews(prefs, slot_label='Evening'):
    """Render the email digest in every design direction from the same data, plus a comparison page:
    automation/out/preview/digest-<style>.html and automation/out/preview/compare.html."""
    now = now_utc()
    names = []
    for style in email_digest.STYLES:
        _, _, (doc, used), _ = build_digest(prefs, 'email', now, slot_label, style)
        page = email_digest.preview_html(doc, used)
        write_text(PREVIEW / f'digest-{style}.html', page)
        names.append((style, len(doc.encode('utf-8'))))
        log(f'  preview digest-{style}.html  {len(doc.encode("utf-8")) // 1024} KB html')
    tabs = ''.join(f'<button data-s="{s}">{esc(email_digest.STYLE_LABELS[s])}<small>{kb // 1024} KB</small></button>' for s, kb in names)
    frames = ''.join(f'<figure><figcaption>{esc(email_digest.STYLE_LABELS[s])}</figcaption><iframe src="digest-{s}.html" loading="lazy"></iframe></figure>'
                     for s, _ in names)
    write_text(PREVIEW / 'compare.html', f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Digest design directions</title>
<style>
:root{{color-scheme:dark}}body{{margin:0;background:#04050f;color:#e8ecff;font:14px 'Segoe UI',Inter,system-ui,sans-serif}}
header{{position:sticky;top:0;z-index:2;background:#070a1c;border-bottom:1px solid #2a3470;padding:12px 16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}}
h1{{font-size:15px;margin:0 12px 0 0;letter-spacing:.04em}}
button{{background:#0b1130;color:#cfd6f6;border:1px solid #2a3470;border-radius:6px;padding:7px 12px;cursor:pointer;font:600 12px inherit}}
button small{{margin-left:8px;color:#6f79ad;font-weight:500}}button.on{{border-color:#00e5ff;color:#fff;box-shadow:0 0 0 1px #00e5ff55}}
main{{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px;padding:16px}}
main.single{{grid-template-columns:1fr;max-width:760px;margin:0 auto}}main.single figure:not(.on){{display:none}}
figure{{margin:0;background:#070a1c;border:1px solid #1c2452;border-radius:10px;overflow:hidden}}
figcaption{{padding:9px 12px;font:700 12px 'Cascadia Mono',Consolas,monospace;letter-spacing:.08em;color:#8eeaff;border-bottom:1px solid #1c2452}}
iframe{{display:block;width:100%;height:1600px;border:0;background:#04050f}}
</style></head><body><header><h1>Digest · design directions</h1><button data-s="all" class="on">Side by side</button>{tabs}</header>
<main id="m">{frames}</main>
<script>
const m=document.getElementById('m'),figs=[...m.querySelectorAll('figure')],keys={[repr(s) for s, _ in names]};
document.querySelector('header').addEventListener('click',e=>{{const b=e.target.closest('button');if(!b)return;
document.querySelectorAll('header button').forEach(x=>x.classList.toggle('on',x===b));
if(b.dataset.s==='all'){{m.classList.remove('single');figs.forEach(f=>f.classList.remove('on'));}}
else{{m.classList.add('single');figs.forEach((f,i)=>f.classList.toggle('on',keys[i]===b.dataset.s));}}}});
</script></body></html>""")
    log('  preview compare.html')
