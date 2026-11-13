"""Telegram "Brief Card" format (version A): one message per division, each story a structured brief.

  🏦 BANKING INTELLIGENCE
  3 stories · Evening · 13/11
  ━━━━━━━━━━━━
  🔴 Headline (bold)                       ← most important first
  Summary                                  ← first sentence of the publisher's summary
  📊 Key facts                             ← figures/dates from the rest of the story + live prices of mentioned symbols
  🔗 Source · Read original
(No "why it matters" section: by the user's choice the format stays rule-based and never interprets impact.)

Rules: division only (no agent identity); sections without data are dropped; nothing repeats across sections
(facts already in the headline or summary are skipped); no figure is produced that is not in the source text or
the live quote file. Telegram HTML subset only (b, i, a, code). Each message stays under Telegram's 4096 chars.
"""
import html
import re
import unicodedata

from common import SITE_URL, local_tz, parse_iso, registry_meta

esc = html.escape
MAX_LEN = 3800
DIV_ICON = {'corporate': '🏢', 'macro': '🌐', 'market': '📈', 'banking': '🏦'}
IMP_DOT = {3: '🔴', 2: '🟠', 1: '⚪'}
IMP_LABEL = {3: 'High', 2: 'Medium', 1: 'Low'}
RULE = '━━━━━━━━━━━━'

UNIT = (r'%(?:/năm)?|điểm|bps|lần|'
        r'(?:nghìn |triệu |tỷ |tỉ )?(?:triệu tỷ|nghìn tỷ|tỷ|tỉ|triệu|nghìn)\s?(?:đồng|USD|đô la)|'
        r'USD/ounce|USD/thùng|triệu đồng/lượng|đồng/lượng|tấn|ha|m2|căn')
FIG = re.compile(r'(?<![\w/])[+-]?\d+(?:[.,]\d+)*\s?(?:' + UNIT + r')(?!\w)', re.I)
DATE = re.compile(r'(?:quý\s+[IVX1-4]+(?:/\d{4})?|tháng\s+\d{1,2}(?:/\d{4})?|năm\s+20\d\d|\d{1,2}/\d{4})', re.I)
SENT = re.compile(r'(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ"“\'0-9])')
LEAD = re.compile(r'[\w%/.,+-]+', re.U)


def vn_num(v, dp):
    """1234.5 → 1.234,5 (Vietnamese grouping)."""
    if v is None:
        return '—'
    s = f'{v:,.{dp}f}'
    return s.replace(',', '§').replace('.', ',').replace('§', '.')


def vn_pct(p):
    return f'{abs(p):.2f}'.replace('.', ',') + '%'


def arrow(p):
    return '▲' if p > 0 else '▼' if p < 0 else '■'


def sentences(text):
    return [s.strip() for s in SENT.split(text or '') if s.strip()]


def fact_phrases(text, skip, limit):
    """'… với số dư hơn 2,36 triệu tỷ đồng …' → 'số dư hơn <b>2,36 triệu tỷ đồng</b>' (3 words of context)."""
    out = []
    for m in list(FIG.finditer(text)) + list(DATE.finditer(text)):
        val = m.group(0).strip()
        key = val.lower()
        if any(key in s for s in skip):
            continue
        before = text[:m.start()]
        clause = re.split(r'[,;:()\-–—]|\s(?:và|nhưng|trong khi|với)\s', before)[-1]
        words = LEAD.findall(clause)[-3:]
        lead = ' '.join(words)
        out.append((m.start(), f'{esc(lead)} <b>{esc(val)}</b>'.strip()))
        skip.add(key)
    out.sort()
    return [p for _, p in out[:limit]]


def story_card(n, quotes, prefs):
    head = unicodedata.normalize('NFC', n['headline']).strip()
    summ = sentences(unicodedata.normalize('NFC', n.get('summary') or ''))
    lead = summ[0] if summ else ''
    if lead and lead.lower().rstrip('.…') in head.lower():
        lead = summ[1] if len(summ) > 1 else ''
    if len(lead) > 260:
        lead = lead[:257].rsplit(' ', 1)[0] + '…'
    rest = ' '.join(s for s in summ if s != lead)
    skip = {m.group(0).strip().lower() for m in list(FIG.finditer(head + ' ' + lead)) + list(DATE.finditer(head + ' ' + lead))}
    facts = fact_phrases(rest, skip, 3)
    for sym in (n.get('markets') or [])[:2]:
        q = quotes.get(sym)
        if q:
            facts.append(f'{esc(sym)} <b>{vn_num(q["price"], q["dp"])}</b> {arrow(q["changePct"])} {vn_pct(q["changePct"])}')
    parts = [f'{IMP_DOT[n["importance"]]} <b>{esc(head)}</b>']
    if lead:
        parts.append(esc(lead))
    if facts:
        parts.append('📊 <b>Key facts</b>\n' + '\n'.join(f'• {f}' for f in facts))
    parts.append(f'🔗 {esc(n["source"])} · <a href="{esc(n["url"])}">Đọc bài gốc</a>')
    return '\n\n'.join(parts)


def division_messages(rich, quotes, prefs, now, slot_label, per_division=6):
    """rich: [(div_id, [(dep_id, desk_name, rows)])] → list of Telegram HTML messages (one or more per division)."""
    meta = registry_meta()
    date = now.astimezone(local_tz(prefs)).strftime('%d/%m')
    msgs = []
    for div_id, desks in rich:
        rows = sorted([n for _, _, r in desks for n in r], key=lambda n: (n['importance'], n['publishedAt']), reverse=True)[:per_division]
        if not rows:
            continue
        name = meta['divisions'].get(div_id, {}).get('nameEn', div_id).upper()
        head = f'{DIV_ICON.get(div_id, "◈")} <b>{esc(name)}</b>\n<i>{len(rows)} {"story" if len(rows) == 1 else "stories"} · {esc(slot_label)} · {date}</i>'
        cur = head
        for n in rows:
            card = story_card(n, quotes, prefs)
            if len(cur) + len(card) + 20 > MAX_LEN:
                msgs.append(cur)
                cur = head + ' <i>(cont.)</i>'
            cur += f'\n{RULE}\n\n{card}'
        msgs.append(cur)
    return msgs


def opening_message(prefs, now, slot_label, total, divisions, mk):
    """Short first message: what is coming + market snapshot (monospace, aligned)."""
    date = now.astimezone(local_tz(prefs)).strftime('%d/%m/%Y · %H:%M')
    lines = [f'◈ <b>AFA · {esc(slot_label)} Brief</b>', f'<i>{date} · {total} stories · {divisions} divisions</i>']
    if mk:
        w = max(len(q['name']) for q in mk[:8])
        rows = [f'{q["name"]:<{w}}  {vn_num(q["price"], q["dp"]):>10}  {arrow(q["changePct"])}{vn_pct(q["changePct"]):>6}' for q in mk[:8]]
        lines.append('\n📈 <b>Market pulse</b>\n<code>' + esc('\n'.join(rows)) + '</code>')
    lines.append(f'\n🌐 <a href="{SITE_URL}">Open the dashboard</a>')
    return '\n'.join(lines)


def alert_division_messages(news, quotes, prefs, now):
    """Instant news alerts in the same card format, grouped one message per division."""
    meta = registry_meta()
    by_div = {}
    for n in news:
        by_div.setdefault(n['divisionId'], []).append(n)
    msgs = []
    for div_id, rows in by_div.items():
        name = meta['divisions'].get(div_id, {}).get('nameEn', div_id).upper()
        cards = f'\n{RULE}\n\n'.join(story_card(n, quotes, prefs) for n in rows)
        msgs.append(f'⚡ {DIV_ICON.get(div_id, "◈")} <b>{esc(name)}</b> · <i>Alert</i>\n{RULE}\n\n{cards}'[:4000])
    return msgs
