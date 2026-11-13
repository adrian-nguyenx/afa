"""Email digest — four design directions over one shared view model.

  refined        the current Intelligence Center layout, with a distinct headline colour and brighter summaries
  terminal       V1 Futuristic Financial Intelligence: dense financial-terminal layout, large agent avatars,
                 amber headlines, bar-chart market table
  cinematic      V2 Cinematic Spider-Verse Intelligence: each story is an "intelligence report" filed by its agent,
                 big portrait banner, halftone/chromatic accents, magenta headlines
  institutional  V3 Premium Institutional Finance: light research-note layout, serif navy headlines,
                 restrained small avatars, gold rules

Identity comes only from the site: logo + agent avatars are PNGs exported from assets/img/logo.svg and
components/avatars.js (automation/tools/export_assets.py) and embedded as inline CID images; agent names/codes and
division names/codes/colours are parsed from assets/js/core/registry.js. Badges, key figures and market impact are
derived by rules from each story's own data (0 tokens). Email clients run no scripts and mostly ignore animation:
depth comes from layered panels, gradients and glow (solid fallbacks); hover/animation are progressive enhancements.
"""
import html
import re
import unicodedata
from pathlib import Path

from common import AUTO, SITE_URL, local_tz, parse_iso, registry_meta

ASSETS = AUTO / 'assets' / 'email'
STYLES = ('refined', 'terminal', 'cinematic', 'institutional')
STYLE_LABELS = {
    'refined': 'Current · refined',
    'terminal': 'V1 · Futuristic Financial Intelligence',
    'cinematic': 'V2 · Cinematic Spider-Verse Intelligence',
    'institutional': 'V3 · Premium Institutional Finance',
}
esc = html.escape
SANS = "'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif"
MONO = "'Cascadia Mono', Consolas, 'SF Mono', Menlo, monospace"
SERIF = "'Noto Serif', Cambria, 'Times New Roman', Times, serif"  # all carry Vietnamese glyphs (Georgia does not)

ANALYSIS_RX = re.compile(r'\?|nhận định|phân tích|dự báo|triển vọng|chuyên gia|góc nhìn|kịch bản', re.I)
FIG_RX = re.compile(
    r'[+-]?\d+(?:[.,]\d+)*\s?(?:%|điểm|tỷ USD|tỉ USD|triệu USD|tỷ đồng|tỉ đồng|nghìn tỷ|triệu đồng/lượng|USD/ounce|USD/thùng|bps)',
    re.I)
WORD = re.compile(r'\w+', re.U)
IMP_LABEL = {3: 'High', 2: 'Medium', 1: 'Low'}


# ---------- shared helpers ----------

def similar(a, b):
    x, y = set(WORD.findall(a.lower())), set(WORD.findall(b.lower()))
    return len(x & y) / len(x | y) if x and y else 0


def badge_for(n, now):
    dep = n['departmentId']
    age_h = (now - (parse_iso(n['publishedAt']) or now)).total_seconds() / 3600
    if n['importance'] >= 3 and age_h <= 8:
        return 'BREAKING'
    if ANALYSIS_RX.search(n['headline']):
        return 'ANALYSIS'
    if dep in ('vn-macro', 'global-macro'):
        return 'MACRO'
    if dep in ('vn-equities', 'us-equities', 'fx', 'commodities'):
        return 'MARKET UPDATE'
    if dep in ('bank-rates', 'vn-banks'):
        return 'BANKING'
    if n.get('category') == 'Investment' or n.get('sector') in ('Industrials', 'Real Estate', 'Energy'):
        return 'INDUSTRY'
    return 'COMPANY'


def key_figures(n, limit=3):
    seen, out = set(), []
    for m in FIG_RX.finditer(n['headline'] + ' ' + (n.get('summary') or '')):
        s = m.group(0).strip()
        if s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
        if len(out) >= limit:
            break
    return out


def fmt_num(v, dp):
    return '—' if v is None else f'{v:,.{dp}f}'


def fmt_pct(p):
    return f'{"+" if p >= 0 else ""}{p:.2f}%'


def arrow(p):
    return '▲' if p > 0 else '▼' if p < 0 else '■'


def rate_txt(v):
    return '—' if v is None else f'{v:.2f}%'


class Images:
    """Inline images a message uses: name -> (cid, path)."""

    def __init__(self):
        self.used = {}

    def src(self, name):
        path = ASSETS / name
        if not path.exists():
            return None
        cid = 'afa-' + name.replace('.png', '')
        self.used[name] = (cid, path)
        return f'cid:{cid}'


def build_view(prefs, now, slot_label, sections, mk, banks, changes, quotes, total, lookback):
    meta = registry_meta()
    imgs = Images()
    tz = local_tz(prefs)

    def story(n):
        d = meta['divisions'].get(n['divisionId'], {})
        s = dict(n)
        s['headline'] = unicodedata.normalize('NFC', n['headline'])
        s['summary'] = unicodedata.normalize('NFC', n.get('summary') or '')
        s['badge'] = badge_for(n, now)
        s['agent'] = meta['agents'].get(n['departmentId'], {'name': n['departmentId'], 'code': '', 'title': ''})
        s['div'] = {'code': d.get('code', ''), 'color': d.get('color', '#00e5ff'), 'name': d.get('nameEn', '')}
        s['desk'] = n.get('_deskName', '')
        p = parse_iso(n['publishedAt'])
        s['time'] = p.astimezone(tz).strftime('%H:%M · %d/%m') if p else ''
        s['figs'] = key_figures(n)
        s['impact'] = [(sym, fmt_num(quotes[sym]['price'], quotes[sym]['dp']), quotes[sym]['changePct'])
                       for sym in (n.get('markets') or []) if sym in quotes]
        s['av'] = imgs.src(f'avatar-{n["departmentId"]}.png')
        return s

    all_rows = [n for _, desks in sections for _, _, rows in desks for n in rows]
    heroes = []
    for n in sorted([n for n in all_rows if n['importance'] >= 3], key=lambda n: n['publishedAt'], reverse=True):
        if all(h['departmentId'] != n['departmentId'] and similar(h['headline'], n['headline']) < 0.4 for h in heroes):
            heroes.append(n)
        if len(heroes) == 2:
            break
    hero_ids = {n['id'] for n in heroes}
    divisions = []
    for div_id, desks in sections:
        d = meta['divisions'].get(div_id, {})
        rows = [story(n) for _, _, r in desks for n in r if n['id'] not in hero_ids]
        divisions.append({'id': div_id, 'code': d.get('code', ''), 'color': d.get('color', '#00e5ff'),
                          'name': d.get('nameEn', div_id), 'rows': rows,
                          'count': sum(len(r) for _, _, r in desks), 'agents': sum(1 for _, _, r in desks if r)})
    active = [dep for _, desks in sections for dep, _, rows in desks if rows]
    rates_agent = meta['agents'].get('bank-rates', {})
    return {
        'now': now, 'slot': slot_label, 'lookback': lookback,
        'date': now.astimezone(tz).strftime('%A %d/%m/%Y · %H:%M'),
        'imgs': imgs, 'logo': imgs.src('logo.png'),
        'heroes': [story(n) for n in heroes], 'divisions': [d for d in divisions if d['rows']],
        'mk': mk, 'banks': banks, 'changes': changes[:6],
        'rates_agent': {**rates_agent, 'av': imgs.src('avatar-bank-rates.png') if (banks or changes) else None},
        'cast': [{'code': meta['agents'].get(dep, {}).get('code', ''), 'name': meta['agents'].get(dep, {}).get('name', ''),
                  'av': imgs.src(f'avatar-{dep}.png')} for dep in active],
        'stats': {'stories': total, 'high': sum(1 for n in all_rows if n['importance'] >= 3),
                  'agents': len(active), 'symbols': len(quotes)},
    }


def document(bg, css, body, preheader, scheme='dark', outer_bg=None, maxw=680):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<meta name="color-scheme" content="{scheme}"><meta name="supported-color-schemes" content="{scheme}"><style>{css}'
            f'@media (max-width:620px){{.wrap{{padding:12px 8px!important}}.hide-m{{display:none!important}}}}</style></head>'
            f'<body style="margin:0;padding:0;background:{bg}">'
            f'<div style="display:none;max-height:0;overflow:hidden">{esc(preheader)}</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{bg}" '
            f'style="background:{bg};{outer_bg or ""}"><tr><td align="center" class="wrap" style="padding:28px 14px">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:{maxw}px">'
            f'{"".join(b for b in body if b)}</table></td></tr></table></body></html>')


def row(inner, pad='0 0 14px 0'):
    return f'<tr><td style="padding:{pad}">{inner}</td></tr>'


def preheader(v):
    st = v['stats']
    return f'{st["stories"]} stories · {st["high"]} high impact · {", ".join(c["code"] for c in v["cast"][:4])} reporting'


# =====================================================================================================
# Current · refined
# =====================================================================================================

R = {'bg': '#04050f', 'bg2': '#070a1c', 'panel': '#0b1130', 'panel2': '#111a3f', 'line': '#1c2452', 'line2': '#2a3470',
     'head': '#8eeaff', 'text': '#f1f4ff', 'body': '#d3d9f7', 'meta': '#9aa4d6', 'dim': '#6f79ad',
     'accent': '#00e5ff', 'accent2': '#ff3ec9', 'violet': '#8b5cff', 'up': '#3dffb5', 'down': '#ff4f8b', 'med': '#ffc857'}
R_BADGE = {'BREAKING': R['down'], 'MARKET UPDATE': R['up'], 'MACRO': R['violet'], 'COMPANY': R['accent'],
           'INDUSTRY': R['med'], 'ANALYSIS': '#7aa2ff', 'BANKING': R['accent2'], 'ALERT': R['accent2']}
R_IMP = {3: R['down'], 2: R['med'], 1: R['dim']}


def refined(v):
    P = R
    css = (f'.card{{background:{P["panel"]};background-image:linear-gradient(160deg,{P["panel2"]} 0%,{P["panel"]} 55%,{P["bg2"]} 100%);border-radius:8px}}'
           f'.card:hover{{box-shadow:0 0 0 1px {P["accent"]}88,0 12px 44px {P["accent"]}33!important}}'
           f'.dp{{display:inline-block;background:{P["bg2"]};border:1px solid {P["line2"]};border-radius:4px;padding:5px 9px;margin:0 6px 6px 0;white-space:nowrap}}'
           f'.dpl{{font:600 10px {MONO};color:{P["dim"]};letter-spacing:.08em}}.dpv{{font:700 12px {MONO};color:{P["text"]}}}.dpc{{font:600 11px {MONO}}}'
           f'.chip{{display:inline-block;font:700 10px/1 {MONO};letter-spacing:.12em;border:1px solid;border-radius:3px;padding:4px 7px;margin:0 6px 4px 0;white-space:nowrap}}'
           f'.bar{{display:inline-block;width:14px;height:4px;border-radius:2px;margin-right:3px}}.impl{{font:600 10px {MONO};letter-spacing:.08em;margin-left:4px}}'
           f'.an{{font:700 13px {SANS};color:{P["text"]}}}.ac{{font:600 10px {MONO};letter-spacing:.1em}}'
           f'.ad{{font:500 11px {SANS};color:{P["meta"]};margin-top:2px}}.dim{{color:{P["dim"]}}}'
           f'.hl{{display:block;margin-top:9px;font-weight:700;line-height:1.35;font-family:{SANS};color:{P["head"]};text-decoration:none;letter-spacing:.005em}}'
           f'.lbl{{font:700 9px {MONO};color:{P["dim"]};letter-spacing:.16em;margin:7px 0 5px}}'
           f'.sum{{font:400 13.5px/1.6 {SANS};color:{P["body"]}}}'
           f'.ins{{margin-top:12px;padding-top:6px;border-top:1px dashed {P["line2"]}}}'
           f'.src{{margin-top:12px;font:500 11px {SANS};color:{P["dim"]}}}.src b{{color:{P["meta"]};font-weight:600}}'
           f'.rd{{color:{P["accent"]};text-decoration:none;font-weight:600}}')

    def dp(label, value, pct=None):
        col = P['meta'] if pct is None else (P['up'] if pct > 0 else P['down'] if pct < 0 else P['meta'])
        sub = '' if pct is None else f'<span class="dpc" style="color:{col}">&nbsp;{arrow(pct)} {fmt_pct(pct)}</span>'
        return f'<span class="dp" style="border-left:2px solid {col}"><span class="dpl">{esc(label)}</span>&nbsp; <span class="dpv">{esc(value)}</span>{sub}</span>'

    def chip(text, col, solid=False):
        return f'<span class="chip" style="color:{P["bg"] if solid else col};background:{col if solid else P["panel2"]};border-color:{col}">{esc(text)}</span>'

    def meter(i):
        return ''.join(f'<span class="bar" style="background:{R_IMP[i] if k < i else P["line2"]}"></span>' for k in range(3)) + \
            f'<span class="impl" style="color:{R_IMP[i]}">{IMP_LABEL[i].upper()}</span>'

    def card(s, hero=False):
        col, bcol = s['div']['color'], R_BADGE[s['badge']]
        size = 52 if hero else 42
        av = (f'<img src="{s["av"]}" width="{size}" height="{round(size * 1.2)}" alt="{esc(s["agent"]["name"])}" '
              f'style="display:block;border:1px solid {col};border-radius:6px;box-shadow:0 0 12px {col}55">' if s['av'] else '')
        ins = ''
        if s['figs'] or s['impact']:
            ins = ('<div class="ins">' + ('<div class="lbl">KEY FIGURES</div>' + ''.join(dp('◆', f) for f in s['figs']) if s['figs'] else '')
                   + ('<div class="lbl">MARKET IMPACT · LIVE</div>' + ''.join(dp(a, b, c) for a, b, c in s['impact']) if s['impact'] else '') + '</div>')
        glow = f'box-shadow:0 0 0 1px {bcol}33,0 10px 40px {bcol}26;' if hero else 'box-shadow:0 6px 24px #00000066;'
        return row(
            f'<div class="card" style="border:1px solid {bcol if hero else P["line2"]};{glow}">'
            f'<div style="height:2px;background:{bcol};background-image:linear-gradient(90deg,{bcol},{col},transparent);border-radius:8px 8px 0 0"></div>'
            f'<div style="padding:{18 if hero else 15}px {20 if hero else 17}px">'
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td valign="middle" style="padding-right:12px">{av}</td>'
            f'<td valign="middle"><div class="an">{esc(s["agent"]["name"])}<span class="ac" style="color:{col}">&nbsp;&nbsp;{esc(s["agent"]["code"])}</span></div>'
            f'<div class="ad">{esc(s["div"]["name"])}<span class="dim"> · {esc(s["desk"])} · {esc(s["time"])}</span></div></td></tr></table>'
            f'<div style="margin-top:12px">{chip(s["badge"], bcol, s["badge"] == "BREAKING")}{chip(s.get("category", ""), P["meta"])}'
            f'<span style="display:inline-block;vertical-align:middle;margin-left:4px">{meter(s["importance"])}</span></div>'
            f'<a lang="vi" href="{esc(s["url"])}" class="hl" style="font-size:{19 if hero else 16}px">{esc(s["headline"])}</a>'
            + (f'<div class="lbl" style="color:{col}">SUMMARY</div><div lang="vi" class="sum">{esc(s["summary"])}</div>' if s.get('summary') else '')
            + ins + f'<div class="src">Source: <b>{esc(s["source"])}</b>&nbsp;·&nbsp;<a href="{esc(s["url"])}" class="rd">Read original →</a></div></div></div>')

    st = v['stats']
    stat = lambda val, lab, c, last=False: (f'<td align="center" style="padding:10px 4px;{"" if last else "border-right:1px solid " + P["line"]}">'
                                            f'<div style="font:700 20px {MONO};color:{c}">{val}</div>'
                                            f'<div style="font:600 9px {MONO};color:{P["dim"]};letter-spacing:.14em;margin-top:2px">{lab}</div></td>')
    logo = (f'<img src="{v["logo"]}" width="60" height="60" alt="Adrian Financial Agents" style="display:block;border-radius:14px;'
            f'box-shadow:0 0 22px #00e5ff55,0 0 44px #8b5cff33">' if v['logo'] else '')
    body = [row(
        f'<div style="background:{P["panel"]};background-image:radial-gradient(120% 140% at 0% 0%,#14205a 0%,{P["panel"]} 45%,{P["bg"]} 100%);'
        f'border:1px solid {P["line2"]};border-radius:10px;box-shadow:0 0 0 1px #00e5ff22,0 18px 50px #00000080;overflow:hidden">'
        f'<div style="height:3px;background:{P["accent"]};background-image:linear-gradient(90deg,{P["accent"]},{P["violet"]},{P["accent2"]})"></div>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="76" style="padding:20px 0 18px 20px">{logo}</td>'
        f'<td style="padding:20px 20px 18px 14px"><div style="font:800 20px {SANS};color:{P["text"]};letter-spacing:.04em">ADRIAN FINANCIAL AGENTS</div>'
        f'<div style="font:700 10px {MONO};color:{P["accent"]};letter-spacing:.22em;margin-top:3px">AI FINANCIAL INTELLIGENCE CENTER</div>'
        f'<div style="font:500 12px {SANS};color:{P["meta"]};margin-top:8px">{esc(v["slot"])} Intelligence Digest · {esc(v["date"])}</div></td></tr></table>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid {P["line"]};background:{P["bg2"]}"><tr>'
        + stat(st['stories'], 'STORIES', P['text']) + stat(st['high'], 'HIGH IMPACT', P['down'])
        + stat(st['agents'], 'AGENTS REPORTING', P['accent']) + stat(st['symbols'], 'LIVE SYMBOLS', P['up'], True)
        + f'</tr></table><div style="padding:10px 20px 12px;font:500 11px {SANS};color:{P["dim"]};border-top:1px solid {P["line"]}">'
          f'<span style="color:{P["up"]}">●</span> Collected, classified and distributed automatically by the agent network · last {v["lookback"]}h</div></div>', '0')]
    if v['mk']:
        cells = []
        for q in v['mk']:
            p = q['changePct']
            c = P['up'] if p > 0 else P['down'] if p < 0 else P['meta']
            cells.append(f'<td width="25%" valign="top" style="padding:4px"><div style="background:{P["panel"]};background-image:linear-gradient(180deg,{P["panel2"]},{P["bg2"]});'
                         f'border:1px solid {P["line2"]};border-bottom:2px solid {c};border-radius:6px;padding:10px">'
                         f'<div style="font:600 10px {MONO};color:{P["meta"]};letter-spacing:.06em;white-space:nowrap;overflow:hidden">{esc(q["name"].upper())}</div>'
                         f'<div style="font:700 16px {MONO};color:{P["text"]};margin-top:4px;white-space:nowrap">{fmt_num(q["price"], q["dp"])}</div>'
                         f'<div style="font:700 11px {MONO};color:{c};margin-top:2px">{arrow(p)} {fmt_pct(p)}</div></div></td>')
        rows = ''.join('<tr>' + ''.join(cells[i:i + 4] + ['<td></td>'] * (4 - len(cells[i:i + 4]))) + '</tr>' for i in range(0, len(cells), 4))
        body.append(row(f'<div style="font:700 11px {MONO};color:{P["accent"]};letter-spacing:.18em;margin-bottom:6px">◈ MARKET PULSE '
                        f'<span style="color:{P["dim"]}">· LIVE · MAY BE DELAYED</span></div>'
                        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{rows}</table>', '18px 0 4px 0'))
    if v['heroes']:
        body.append(row(f'<div style="font:700 11px {MONO};color:{P["down"]};letter-spacing:.18em">⚡ PRIORITY INTELLIGENCE</div>', '22px 0 10px 0'))
        body += [card(s, True) for s in v['heroes']]
    for d in v['divisions']:
        body.append(row(
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            f'<td style="font:700 11px {MONO};color:{d["color"]};letter-spacing:.18em;white-space:nowrap">DIVISION {d["code"]}</td>'
            f'<td width="100%" style="padding:0 12px"><div style="height:1px;background:{d["color"]};opacity:.5"></div></td>'
            f'<td style="font:600 10px {MONO};color:{P["dim"]};white-space:nowrap">{d["count"]} STORIES · {d["agents"]} AGENTS</td></tr></table>'
            f'<div style="font:700 20px {SANS};color:{P["text"]};margin-top:6px">{esc(d["name"])}</div>', '22px 0 12px 0'))
        if d['id'] == 'banking':
            body.append(rates_dark(v, P, d['color']))
        body += [card(s) for s in d['rows']]
    body.append(cast_strip(v, P['dim'], P['line2'], 'AGENTS ON DUTY'))
    body.append(footer(P['dim'], P['meta'], P['line']))
    return document(P['bg'], css, body, preheader(v), outer_bg=f'background-image:radial-gradient(80% 50% at 50% 0%,#0f1a4a 0%,{P["bg"]} 70%)')


def rates_dark(v, P, col, title_font=MONO):
    if not v['banks'] and not v['changes']:
        return ''
    a = v['rates_agent']
    av = f'<img src="{a["av"]}" width="34" height="41" alt="" style="display:block;border:1px solid {col};border-radius:5px">' if a.get('av') else ''
    head = ''.join(f'<td align="right" style="font:600 10px {MONO};color:{P["dim"]};letter-spacing:.1em">{t}</td>' for t in ('6M', '12M', '24M'))
    rows = ''.join(f'<tr><td style="padding:7px 0;border-bottom:1px solid {P["line"]};font:600 13px {SANS};color:{P["text"]}">{esc(b["bank"])}</td>'
                   + ''.join(f'<td align="right" style="padding:7px 0 7px 10px;border-bottom:1px solid {P["line"]};font:700 12px {MONO};color:{P["text"]}">'
                             f'{rate_txt(b["deposit"].get(t))}</td>' for t in ('6M', '12M', '24M')) + '</tr>' for b in v['banks'])
    ch = ''.join(f'<div style="font:500 12px {SANS};color:{P["body"]};margin-top:6px"><span style="color:{P["up"] if c["to"] > c["from"] else P["down"]}">'
                 f'{arrow(c["to"] - c["from"])}</span> <b style="color:{P["text"]}">{esc(c["bank"])}</b> {esc(c["key"])}: {c["from"]:.2f}% → {c["to"]:.2f}%</div>'
                 for c in v['changes']) or f'<div style="font:500 12px {SANS};color:{P["dim"]};margin-top:8px">No deposit-rate changes in this window.</div>'
    return row(f'<div style="background:{P["panel"]};border:1px solid {P["line2"]};border-radius:8px;padding:14px 16px">'
               f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-right:10px">{av}</td>'
               f'<td><div style="font:700 11px {title_font};color:{col};letter-spacing:.16em">DEPOSIT RATES · LIVE BANKS</div>'
               f'<div style="font:500 11px {SANS};color:{P["meta"]}">{esc(a.get("name", ""))} · {esc(a.get("code", ""))}</div></td></tr></table>'
               f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px">'
               f'<tr><td style="font:600 10px {MONO};color:{P["dim"]};letter-spacing:.1em">BANK</td>{head}</tr>{rows}</table>{ch}</div>')


def cast_strip(v, dim, line, title, size=40, label_col=None, radius=5):
    cells = ''.join(f'<td align="center" valign="top" style="padding:0 4px"><img src="{c["av"]}" width="{size}" height="{round(size * 1.2)}" '
                    f'alt="{esc(c["name"])}" style="display:block;border:1px solid {line};border-radius:{radius}px">'
                    f'<div style="font:600 8px {MONO};color:{label_col or dim};margin-top:4px;letter-spacing:.06em;white-space:nowrap">{esc(c["code"])}</div></td>'
                    for c in v['cast'] if c['av'])
    if not cells:
        return ''
    return row(f'<div style="font:700 10px {MONO};color:{dim};letter-spacing:.18em;margin-bottom:8px">{title}</div>'
               f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>{cells}</tr></table>', '16px 0 0 0')


def footer(dim, meta, line, font=SANS):
    return row(f'<div style="font:500 11px/1.6 {font};color:{dim};border-top:1px solid {line};padding-top:18px">Rule-based digest generated by the '
               f'Adrian Financial Agents automation. Headlines and summaries come from the original publishers (linked). Prices may be delayed. '
               f'Not investment advice.<br>Change channels, desks, importance and thresholds on the site (<a href="{SITE_URL}#/settings" style="color:{meta};font-weight:700">Notifications</a>) '
               f'or with Telegram commands.</div>', '22px 0 8px 0')


# =====================================================================================================
# V1 · Futuristic Financial Intelligence — terminal
# =====================================================================================================

T = {'bg': '#020409', 'bar': '#000000', 'panel': '#060a14', 'panel2': '#0a1120', 'line': '#142036', 'line2': '#1f3152',
     'amber': '#ffb547', 'cyan': '#00e5ff', 'text': '#edf1fa', 'body': '#cfd7ea', 'meta': '#8a97b8', 'dim': '#5c6a8c',
     'up': '#3dffb5', 'down': '#ff4f8b', 'violet': '#8b5cff', 'pink': '#ff3ec9'}


def terminal(v):
    P = T
    css = (f'.card{{background:{P["panel"]};background-image:linear-gradient(90deg,{P["panel2"]} 0%,{P["panel"]} 60%);}}'
           f'.card:hover{{box-shadow:0 0 0 1px {P["cyan"]}66,0 0 30px {P["cyan"]}22!important}}'
           f'.m{{font-family:{MONO}}}.k{{font:700 9px {MONO};letter-spacing:.18em;color:{P["dim"]}}}'
           f'.hl{{display:block;font:700 17px/1.38 {SANS};color:{P["amber"]};text-decoration:none;margin:8px 0 0}}'
           f'.sum{{font:400 13.5px/1.6 {SANS};color:{P["body"]};margin-top:7px}}'
           f'.tag{{display:inline-block;font:700 9px/1 {MONO};letter-spacing:.14em;padding:4px 6px;margin-right:6px;border:1px solid}}'
           f'.fig{{font:700 12px {MONO};color:{P["text"]}}}.sep{{color:{P["line2"]};padding:0 8px}}'
           f'.src{{font:500 11px {MONO};color:{P["dim"]};margin-top:12px;letter-spacing:.04em}}.src a{{color:{P["cyan"]};text-decoration:none}}')

    def bar(p, width=90, cap=3.0):
        w = max(2, round(min(abs(p), cap) / cap * width))
        c = P['up'] if p > 0 else P['down'] if p < 0 else P['meta']
        return (f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="{width}" style="background:{P["line"]}"><tr>'
                f'<td width="{w}" height="6" style="background:{c};box-shadow:0 0 8px {c}88;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0">&nbsp;</td></tr></table>')

    def impact_rows(items):
        return ''.join(f'<tr><td class="m" style="padding:3px 12px 3px 0;font-size:11px;color:{P["meta"]};font-weight:700">{esc(a)}</td>'
                       f'<td class="m" align="right" style="padding:3px 12px 3px 0;font-size:12px;color:{P["text"]};font-weight:700">{esc(b)}</td>'
                       f'<td class="m" align="right" style="padding:3px 12px 3px 0;font-size:11px;font-weight:700;color:{P["up"] if c > 0 else P["down"] if c < 0 else P["meta"]}">'
                       f'{arrow(c)} {fmt_pct(c)}</td><td style="padding:3px 0">{bar(c, 70)}</td></tr>' for a, b, c in items)

    def card(s, hero=False):
        col = s['div']['color']
        size = 84 if hero else 72
        av = (f'<img src="{s["av"]}" width="{size}" height="{round(size * 1.2)}" alt="{esc(s["agent"]["name"])}" '
              f'style="display:block;border:1px solid {col};box-shadow:0 0 18px {col}44">' if s['av'] else '')
        bcol = P['down'] if s['badge'] == 'BREAKING' else P['cyan']
        figs = ''
        if s['figs']:
            figs = (f'<div style="margin-top:12px"><span class="k">KEY FIGURES</span><br><span style="display:inline-block;margin-top:5px">'
                    + '<span class="sep">│</span>'.join(f'<span class="fig">{esc(f)}</span>' for f in s['figs']) + '</span></div>')
        imp = (f'<div style="margin-top:10px"><span class="k">MARKET IMPACT · LIVE</span>'
               f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px">{impact_rows(s["impact"])}</table></div>') if s['impact'] else ''
        return row(
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" '
            f'style="border:1px solid {P["down"] if hero else P["line2"]};border-left:3px solid {col}"><tr>'
            f'<td width="{size + 24}" valign="top" style="padding:16px 0 14px 14px">{av}'
            f'<div class="m" style="font-size:9px;font-weight:700;color:{col};letter-spacing:.1em;margin-top:6px">{esc(s["agent"]["code"])}</div></td>'
            f'<td valign="top" style="padding:14px 16px 14px 14px">'
            f'<div class="m" style="font-size:10px;color:{P["meta"]};letter-spacing:.12em">{esc(s["div"]["name"].upper())} <span style="color:{P["dim"]}">⟩</span> '
            f'{esc(s["desk"].upper())} <span style="color:{P["dim"]}">⟩</span> {esc(s["time"])}</div>'
            f'<div style="font:700 14px {SANS};color:{P["text"]};margin-top:3px">{esc(s["agent"]["name"])} '
            f'<span style="font:500 11px {SANS};color:{P["dim"]}">— {esc(s["agent"]["title"])}</span></div>'
            f'<div style="margin-top:10px"><span class="tag" style="color:{P["bar"] if s["badge"] == "BREAKING" else bcol};background:{bcol if s["badge"] == "BREAKING" else "transparent"};border-color:{bcol}">{esc(s["badge"])}</span>'
            f'<span class="tag" style="color:{P["meta"]};border-color:{P["line2"]}">{esc(s.get("category", "").upper())}</span>'
            f'<span class="m" style="font-size:10px;font-weight:700;letter-spacing:.1em;color:{P["down"] if s["importance"] == 3 else P["amber"] if s["importance"] == 2 else P["dim"]}">'
            f'IMP {"■" * s["importance"]}{"□" * (3 - s["importance"])}</span></div>'
            f'<a lang="vi" href="{esc(s["url"])}" class="hl" style="{"font-size:20px" if hero else ""}">{esc(s["headline"])}</a>'
            + (f'<div lang="vi" class="sum">{esc(s["summary"])}</div>' if s.get('summary') else '')
            + figs + imp
            + f'<div class="src">SRC {esc(s["source"].upper())} · <a href="{esc(s["url"])}">OPEN ↗</a></div></td></tr></table>')

    st = v['stats']
    logo = f'<img src="{v["logo"]}" width="44" height="44" alt="Adrian Financial Agents" style="display:block;border-radius:10px;box-shadow:0 0 16px #00e5ff66">' if v['logo'] else ''
    kv = lambda k, val, c: f'<td style="padding:8px 14px 8px 0;white-space:nowrap"><span class="k">{k}</span>&nbsp;<span class="m" style="font-size:13px;font-weight:700;color:{c}">{val}</span></td>'
    body = [row(
        f'<div style="background:{P["bar"]};border:1px solid {P["line2"]};box-shadow:0 0 0 1px #00e5ff18,0 20px 60px #000">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td width="56" style="padding:14px 0 14px 16px">{logo}</td>'
        f'<td style="padding:14px 12px"><div style="font:800 16px {SANS};color:{P["text"]};letter-spacing:.08em">ADRIAN FINANCIAL AGENTS</div>'
        f'<div class="m" style="font-size:11px;font-weight:700;color:{P["amber"]};letter-spacing:.16em;margin-top:3px">INTELLIGENCE TERMINAL ⟩ {esc(v["slot"].upper())} DIGEST</div></td>'
        f'<td align="right" class="hide-m" style="padding:14px 16px"><div class="m" style="font-size:11px;color:{P["cyan"]};letter-spacing:.08em">{esc(v["date"].upper())}</div>'
        f'<div class="m" style="font-size:10px;color:{P["up"]};margin-top:4px">● LIVE FEED · {v["lookback"]}H WINDOW</div></td></tr></table>'
        f'<div style="height:1px;background:{P["cyan"]};background-image:linear-gradient(90deg,{P["cyan"]},{P["violet"]},{P["pink"]},transparent)"></div>'
        f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-left:16px"><tr>'
        + kv('STORIES', st['stories'], P['text']) + kv('HIGH IMPACT', st['high'], P['down']) + kv('AGENTS', st['agents'], P['cyan']) + kv('SYMBOLS', st['symbols'], P['up'])
        + '</tr></table></div>', '0')]
    if v['mk']:
        rows = ''.join(
            f'<tr><td class="m" style="padding:7px 10px;border-bottom:1px solid {P["line"]};font-size:12px;font-weight:700;color:{P["amber"]}">{esc(q["symbol"])}</td>'
            f'<td class="hide-m" style="padding:7px 10px;border-bottom:1px solid {P["line"]};font:500 12px {SANS};color:{P["meta"]}">{esc(q["name"])}</td>'
            f'<td class="m" align="right" style="padding:7px 10px;border-bottom:1px solid {P["line"]};font-size:13px;font-weight:700;color:{P["text"]}">{fmt_num(q["price"], q["dp"])}</td>'
            f'<td class="m" align="right" style="padding:7px 10px;border-bottom:1px solid {P["line"]};font-size:12px;font-weight:700;'
            f'color:{P["up"] if q["changePct"] > 0 else P["down"] if q["changePct"] < 0 else P["meta"]}">{arrow(q["changePct"])} {fmt_pct(q["changePct"])}</td>'
            f'<td style="padding:7px 10px;border-bottom:1px solid {P["line"]}">{bar(q["changePct"])}</td></tr>' for q in v['mk'])
        body.append(row(
            f'<div style="background:{P["panel"]};border:1px solid {P["line2"]}">'
            f'<div class="m" style="padding:9px 10px;font-size:10px;font-weight:700;letter-spacing:.18em;color:{P["cyan"]};border-bottom:1px solid {P["line2"]};background:{P["bar"]}">'
            f'MKT ⟩ MARKET MONITOR <span style="color:{P["dim"]}">· DELAYED · BAR = |Δ| UP TO 3%</span></div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{rows}</table></div>', '16px 0 6px 0'))
    if v['heroes']:
        body.append(row(f'<div class="m" style="font-size:11px;font-weight:700;color:{P["down"]};letter-spacing:.2em">▲ PRIORITY ⟩ HIGH-IMPACT INTELLIGENCE</div>', '20px 0 8px 0'))
        body += [card(s, True) for s in v['heroes']]
    for d in v['divisions']:
        body.append(row(f'<div class="m" style="font-size:12px;font-weight:700;color:{d["color"]};letter-spacing:.16em;border-bottom:1px solid {P["line2"]};padding-bottom:7px">'
                        f'■ DIV {d["code"]} ⟩ {esc(d["name"].upper())} <span style="color:{P["dim"]};font-size:10px">· {d["count"]} STORIES · {d["agents"]} AGENTS</span></div>',
                        '20px 0 10px 0'))
        if d['id'] == 'banking':
            body.append(rates_dark(v, P, d['color']))
        body += [card(s) for s in d['rows']]
    body.append(cast_strip(v, P['dim'], P['line2'], 'AGENT NETWORK ⟩ ON DUTY', 40, P['amber'], 0))
    body.append(footer(P['dim'], P['meta'], P['line'], MONO))
    return document(P['bg'], css, body, preheader(v))


# =====================================================================================================
# V2 · Cinematic Spider-Verse Intelligence
# =====================================================================================================

# Orange intelligence accent (≈9:1 contrast on the panel): `or` headline, `or2` key metrics / agent codes,
# `orD` structural accents (rules, borders, glow). Body text stays neutral; metadata recedes to lilac greys.
S = {'bg': '#07030f', 'panel': '#0e0822', 'panel2': '#170d36', 'line': '#2a1d55', 'line2': '#3b2a78',
     'or': '#ff9a4d', 'or2': '#ffbf8a', 'orD': '#d9692a',
     'text': '#f6f3ff', 'body': '#ebe8f8', 'meta': '#a7a1cf', 'dim': '#79729f',
     'cyan': '#00e5ff', 'pink': '#ff3ec9', 'violet': '#8b5cff', 'up': '#3dffb5', 'down': '#ff4f8b'}
HALFTONE = 'radial-gradient(circle at 1px 1px,rgba(255,255,255,.16) 1px,transparent 1.4px)'


def cinematic(v):
    P = S
    css = (f'.rep{{background:{P["panel"]};border-radius:12px;overflow:hidden}}'
           f'.rep:hover{{box-shadow:0 0 0 1px {P["orD"]}aa,0 18px 60px {P["orD"]}2e!important}}'
           f'@keyframes pulse{{0%,100%{{box-shadow:0 0 0 1px {P["orD"]}66,0 0 30px {P["orD"]}26}}50%{{box-shadow:0 0 0 1px {P["or"]}99,0 0 44px {P["or"]}33}}}}'
           f'.hero{{animation:pulse 4s ease-in-out infinite}}'
           f'.rule{{width:30px;height:2px;border-radius:2px;background:{P["or"]};background-image:linear-gradient(90deg,{P["or"]},{P["orD"]}00);margin:14px 0 8px}}'
           f'.hl{{display:block;font:800 18px/1.36 {SANS};color:{P["or"]};text-decoration:none;letter-spacing:.003em;text-shadow:0 0 18px {P["or"]}2b}}'
           f'.hl:hover{{color:{P["or2"]}}}'
           f'.sum{{font:400 14px/1.64 {SANS};color:{P["body"]};margin-top:9px}}'
           f'.pill{{display:inline-block;font:800 10px/1 {SANS};letter-spacing:.12em;padding:5px 10px;border-radius:999px;margin:0 6px 6px 0}}'
           f'.fig{{display:inline-block;font:800 13px {MONO};color:{P["text"]};background:{P["panel2"]};border:1px solid {P["line2"]};border-radius:8px;padding:6px 10px;margin:0 6px 6px 0}}'
           f'.kfig{{color:{P["or2"]};border-color:{P["orD"]}66;background:{P["orD"]}14}}'
           f'.lab{{font:800 9px {SANS};letter-spacing:.2em;color:{P["dim"]};margin:14px 0 6px}}.lab i{{font-style:normal;color:{P["or"]};margin-right:6px}}'
           f'.src{{font:600 11px {SANS};color:{P["dim"]};margin-top:14px}}.src a{{color:{P["meta"]};text-decoration:none;border-bottom:1px solid {P["line2"]}}}'
           f'.src a span{{color:{P["or"]}}}')

    def report(s, hero=False):
        col = s['div']['color']
        size = 100 if hero else 84
        av = (f'<img src="{s["av"]}" width="{size}" height="{round(size * 1.2)}" alt="{esc(s["agent"]["name"])}" '
              f'style="display:block;border:2px solid {P["text"]};border-radius:10px;box-shadow:6px 6px 0 {col},0 0 30px {col}66">' if s['av'] else '')
        badge_col = P['down'] if s['badge'] == 'BREAKING' else col
        imp_col = P['down'] if s['importance'] == 3 else P['or'] if s['importance'] == 2 else P['dim']
        imp = ''.join(f'<span class="fig">{esc(a)} {esc(b)} <span style="color:{P["up"] if c > 0 else P["down"] if c < 0 else P["meta"]}">{arrow(c)} {fmt_pct(c)}</span></span>'
                      for a, b, c in s['impact'])
        return row(
            f'<div class="rep{" hero" if hero else ""}" style="border:1px solid {P["orD"] if hero else P["line2"]};'
            f'{"box-shadow:0 0 0 1px " + P["orD"] + "66,0 0 30px " + P["orD"] + "26" if hero else "box-shadow:0 12px 40px #00000080"}">'
            f'<div style="background:{P["panel2"]};background-image:{HALFTONE},linear-gradient(115deg,{col}cc 0%,{col}55 22%,{P["panel2"]} 55%,{P["panel"]} 100%);'
            f'background-size:6px 6px,100% 100%;padding:16px 18px">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="{size + 18}" valign="bottom">{av}</td>'
            f'<td valign="bottom" style="padding-left:6px"><div style="font:800 9px {SANS};letter-spacing:.24em;color:{P["or2"] if hero else P["text"]};opacity:{1 if hero else .85}">'
            f'{"⚡ PRIORITY REPORT" if hero else "INTELLIGENCE REPORT"} · FILED BY</div>'
            f'<div style="font:900 {22 if hero else 19}px/1.15 {SANS};color:#ffffff;margin-top:4px;text-shadow:-2px 0 {P["cyan"]}88,2px 0 {P["pink"]}88">{esc(s["agent"]["name"])}</div>'
            f'<div style="font:700 10px {MONO};color:{P["or2"]};letter-spacing:.14em;margin-top:4px">{esc(s["agent"]["code"])}</div>'
            f'<div style="font:600 11px {SANS};color:{P["text"]};opacity:.8;margin-top:3px">{esc(s["div"]["name"])} · {esc(s["desk"])} · {esc(s["time"])}</div>'
            f'</td></tr></table></div>'
            f'<div style="padding:16px 20px 18px">'
            f'<span class="pill" style="background:{badge_col};color:#0a0614">{esc(s["badge"])}</span>'
            f'<span class="pill" style="background:{P["panel2"]};color:{P["meta"]};border:1px solid {P["line2"]}">{esc(s.get("category", ""))}</span>'
            f'<span class="pill" style="background:transparent;color:{imp_col};border:1px solid {imp_col}55">{IMP_LABEL[s["importance"]].upper()} IMPACT</span>'
            f'<div class="rule"></div>'
            f'<a lang="vi" href="{esc(s["url"])}" class="hl" style="{"font-size:22px" if hero else ""}">{esc(s["headline"])}</a>'
            + (f'<div lang="vi" class="sum">{esc(s["summary"])}</div>' if s.get('summary') else '')
            + (f'<div class="lab"><i>◆</i>KEY FIGURES</div>' + ''.join(f'<span class="fig kfig">{esc(f)}</span>' for f in s['figs']) if s['figs'] else '')
            + (f'<div class="lab"><i>◆</i>MARKET IMPACT · LIVE</div>{imp}' if imp else '')
            + f'<div class="src">Source: {esc(s["source"])} · <a href="{esc(s["url"])}">Read the original <span>→</span></a></div></div></div>', '0 0 18px 0')

    st = v['stats']
    logo = (f'<img src="{v["logo"]}" width="78" height="78" alt="Adrian Financial Agents" style="display:block;margin:0 auto;border-radius:18px;'
            f'box-shadow:-5px 0 22px {P["cyan"]}77,5px 0 22px {P["pink"]}77,0 0 60px {P["violet"]}55">' if v['logo'] else '')
    cast = ''.join(f'<td align="center" style="padding:0 3px"><img src="{c["av"]}" width="42" height="50" alt="{esc(c["name"])}" '
                   f'style="display:block;border:1px solid {P["line2"]};border-radius:8px"></td>' for c in v['cast'] if c['av'])
    pill = lambda val, lab, c: f'<span style="display:inline-block;margin:0 4px 6px;padding:6px 12px;border-radius:999px;background:{P["panel2"]};border:1px solid {P["line2"]};font:800 12px {SANS};color:{c}">{val} <span style="color:{P["meta"]};font-weight:600">{lab}</span></span>'
    body = [row(
        f'<div style="text-align:center;background:{P["panel"]};background-image:{HALFTONE},radial-gradient(90% 120% at 50% 0%,#3a1470 0%,{P["panel"]} 55%,{P["bg"]} 100%);'
        f'background-size:7px 7px,100% 100%;border:1px solid {P["line2"]};border-radius:16px;padding:30px 20px 22px;box-shadow:0 24px 70px #000000aa">'
        f'{logo}<div style="font:900 26px {SANS};color:#ffffff;letter-spacing:.06em;margin-top:16px;text-shadow:-2px 0 {P["cyan"]}aa,2px 0 {P["pink"]}aa">ADRIAN FINANCIAL AGENTS</div>'
        f'<div style="font:800 11px {SANS};color:{P["or"]};letter-spacing:.3em;margin-top:6px">INTELLIGENCE MULTIVERSE · {esc(v["slot"].upper())} BRIEFING</div>'
        f'<div style="width:64px;height:2px;margin:12px auto 0;border-radius:2px;background:{P["or"]};background-image:linear-gradient(90deg,{P["orD"]}00,{P["or"]},{P["orD"]}00)"></div>'
        f'<div style="font:500 12px {SANS};color:{P["meta"]};margin-top:8px">{esc(v["date"])}</div>'
        f'<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:18px auto 14px"><tr>{cast}</tr></table>'
        f'<div style="font:700 10px {SANS};color:{P["dim"]};letter-spacing:.2em;margin-bottom:12px">THE AGENTS REPORTING IN THIS BRIEFING</div>'
        + pill(st['stories'], 'stories', P['text']) + pill(st['high'], 'high impact', P['down']) + pill(st['agents'], 'agents', P['cyan']) + pill(st['symbols'], 'live symbols', P['up'])
        + '</div>', '0')]
    if v['mk']:
        cells = []
        for q in v['mk']:
            p = q['changePct']
            c = P['up'] if p > 0 else P['down'] if p < 0 else P['meta']
            cells.append(f'<td width="20%" valign="top" style="padding:4px"><div style="background:{P["panel"]};border:1px solid {P["line2"]};border-radius:10px;padding:10px 8px;'
                         f'box-shadow:inset 0 -3px 0 {c}">'
                         f'<div style="font:800 9px {SANS};color:{P["meta"]};letter-spacing:.08em;white-space:nowrap;overflow:hidden">{esc(q["name"].upper())}</div>'
                         f'<div style="font:800 15px {MONO};color:#ffffff;margin-top:5px;white-space:nowrap">{fmt_num(q["price"], q["dp"])}</div>'
                         f'<div style="font:800 11px {MONO};color:{c};margin-top:3px">{arrow(p)} {fmt_pct(p)}</div></div></td>')
        rows = ''.join('<tr>' + ''.join(cells[i:i + 5] + ['<td></td>'] * (5 - len(cells[i:i + 5]))) + '</tr>' for i in range(0, len(cells), 5))
        body.append(row(f'<div style="font:800 11px {SANS};color:{P["cyan"]};letter-spacing:.24em;margin-bottom:8px">◈ MARKET PULSE</div>'
                        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{rows}</table>', '22px 0 8px 0'))
    if v['heroes']:
        body += [report(s, True) for s in v['heroes']]
    for d in v['divisions']:
        body.append(row(
            f'<div style="background:{d["color"]};background-image:linear-gradient(90deg,{d["color"]} 0%,{d["color"]}00 70%);height:3px;border-radius:2px"></div>'
            f'<div style="font:900 22px {SANS};color:#ffffff;margin-top:10px">{esc(d["name"])}'
            f'<span style="font:800 10px {SANS};color:{d["color"]};letter-spacing:.2em;margin-left:10px;vertical-align:middle">DIVISION {d["code"]}</span></div>'
            f'<div style="font:600 11px {SANS};color:{P["dim"]};margin-top:3px">{d["count"]} reports from {d["agents"]} agent{"s" if d["agents"] != 1 else ""}</div>',
            '26px 0 14px 0'))
        if d['id'] == 'banking':
            body.append(rates_dark(v, {**P, 'text': P['text'], 'meta': P['meta'], 'body': P['body']}, d['color'], SANS))
        body += [report(s) for s in d['rows']]
    body.append(footer(P['dim'], P['meta'], P['line']))
    return document(P['bg'], css, body, preheader(v),
                    outer_bg=f'background-image:radial-gradient(70% 40% at 15% 0%,#2a0d4d 0%,transparent 70%),radial-gradient(60% 40% at 90% 10%,#062a46 0%,transparent 70%)')


# =====================================================================================================
# V3 · Premium Institutional Finance (light)
# =====================================================================================================

I = {'bg': '#f3f1ea', 'card': '#ffffff', 'ink': '#121a2c', 'body': '#343e55', 'meta': '#6a7387', 'dim': '#8d93a3',
     'rule': '#e1ddd2', 'navy': '#0e2d6b', 'gold': '#a17a26', 'teal': '#0a6f73', 'up': '#0f7a4a', 'down': '#b42318', 'tint': '#f8f6f0'}


def institutional(v):
    P = I
    css = (f'.card{{background:{P["card"]};border:1px solid {P["rule"]};border-radius:2px}}'
           f'.card:hover{{border-color:{P["gold"]}!important}}'
           f'.sc{{font:700 10px {SANS};letter-spacing:.16em;text-transform:uppercase;color:{P["gold"]}}}'
           f'.hl{{display:block;font:700 18px/1.36 {SERIF};color:{P["navy"]};text-decoration:none;margin-top:8px}}'
           f'.sum{{font:400 14px/1.62 {SANS};color:{P["body"]};margin-top:7px}}'
           f'.meta{{font:500 11.5px {SANS};color:{P["meta"]}}}.meta b{{color:{P["ink"]};font-weight:700}}'
           f'.fig{{font:700 13px {SANS};color:{P["teal"]}}}'
           f'.src{{font:500 11px {SANS};color:{P["dim"]};margin-top:12px}}.src a{{color:{P["navy"]};font-weight:700;text-decoration:none}}')

    def card(s, hero=False):
        size = 34 if hero else 28
        av = (f'<img src="{s["av"]}" width="{size}" height="{round(size * 1.2)}" alt="{esc(s["agent"]["name"])}" '
              f'style="display:block;border-radius:3px;border:1px solid {P["rule"]}">' if s['av'] else '')
        box = ''
        if s['figs'] or s['impact']:
            parts = []
            if s['figs']:
                parts.append(f'<div><span class="sc" style="color:{P["meta"]}">Key figures</span>&nbsp;&nbsp;'
                             + '<span style="color:#c9c3b4">&nbsp;|&nbsp;</span>'.join(f'<span class="fig">{esc(f)}</span>' for f in s['figs']) + '</div>')
            if s['impact']:
                parts.append(f'<div style="margin-top:{6 if s["figs"] else 0}px"><span class="sc" style="color:{P["meta"]}">Market</span>&nbsp;&nbsp;'
                             + '&nbsp;&nbsp;&nbsp;'.join(f'<b style="font:700 12px {SANS};color:{P["ink"]}">{esc(a)}</b> <span style="font:600 12px {SANS};color:{P["ink"]}">{esc(b)}</span> '
                                                         f'<span style="font:700 12px {SANS};color:{P["up"] if c > 0 else P["down"] if c < 0 else P["meta"]}">{fmt_pct(c)}</span>'
                                                         for a, b, c in s['impact']) + '</div>')
            box = f'<div style="background:{P["tint"]};border-left:2px solid {P["teal"]};padding:9px 12px;margin-top:12px">{"".join(parts)}</div>'
        return row(
            f'<div class="card" style="{"border-left:3px solid " + P["gold"] + ";" if hero else ""}padding:{20 if hero else 16}px {22 if hero else 18}px">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
            f'<td width="{size + 10}" valign="middle">{av}</td>'
            f'<td valign="middle" class="meta"><b>{esc(s["agent"]["name"])}</b>&nbsp; {esc(s["agent"]["code"])} &nbsp;·&nbsp; {esc(s["desk"])}, {esc(s["div"]["name"])}</td>'
            f'<td align="right" valign="middle" class="meta" style="white-space:nowrap">{esc(s["time"])}</td></tr></table>'
            f'<div style="margin-top:12px"><span class="sc" style="color:{P["down"] if s["badge"] == "BREAKING" else P["gold"]}">{esc(s["badge"].title() if s["badge"] != "BREAKING" else "Breaking")}</span>'
            f'<span class="sc" style="color:{P["dim"]}">&nbsp;&nbsp;·&nbsp;&nbsp;{esc(s.get("category", ""))}&nbsp;&nbsp;·&nbsp;&nbsp;{IMP_LABEL[s["importance"]]} impact</span></div>'
            f'<a lang="vi" href="{esc(s["url"])}" class="hl" style="{"font-size:23px" if hero else ""}">{esc(s["headline"])}</a>'
            + (f'<div lang="vi" class="sum">{esc(s["summary"])}</div>' if s.get('summary') else '')
            + box + f'<div class="src">{esc(s["source"])} &nbsp;·&nbsp; <a href="{esc(s["url"])}">Read original</a></div></div>', '0 0 12px 0')

    st = v['stats']
    logo = f'<img src="{v["logo"]}" width="44" height="44" alt="Adrian Financial Agents" style="display:block;border-radius:9px">' if v['logo'] else ''
    fig = lambda val, lab, c, last=False: (f'<td width="25%" style="padding:12px 0 2px;{"" if last else "border-right:1px solid " + P["rule"]}" align="center">'
                                           f'<div style="font:400 26px {SERIF};color:{c}">{val}</div><div class="sc" style="color:{P["meta"]};font-size:9px;margin-top:2px">{lab}</div></td>')
    body = [row(
        f'<div style="background:{P["card"]};border:1px solid {P["rule"]};border-top:3px solid {P["navy"]};padding:22px 24px 18px">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td width="56" valign="middle">{logo}</td><td valign="middle">'
        f'<div style="font:400 23px {SERIF};color:{P["ink"]};letter-spacing:.01em">Adrian Financial Agents</div>'
        f'<div class="sc" style="margin-top:4px">Intelligence Digest · {esc(v["slot"])} Edition</div></td>'
        f'<td align="right" valign="middle" class="hide-m" style="font:500 12px {SANS};color:{P["meta"]}">{esc(v["date"])}</td></tr></table>'
        f'<div style="height:1px;background:{P["gold"]};margin:16px 0 4px;opacity:.6"></div>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        + fig(st['stories'], 'Stories', P['ink']) + fig(st['high'], 'High impact', P['down']) + fig(st['agents'], 'Agents reporting', P['navy'])
        + fig(st['symbols'], 'Live symbols', P['teal'], True) + '</tr></table></div>', '0')]
    if v['mk']:
        half = (len(v['mk']) + 1) // 2

        def col(qs):
            return ''.join(f'<tr><td style="padding:8px 0;border-bottom:1px solid {P["rule"]};font:600 13px {SANS};color:{P["ink"]}">{esc(q["name"])}</td>'
                           f'<td align="right" style="padding:8px 0;border-bottom:1px solid {P["rule"]};font:600 13px {SANS};color:{P["ink"]}">{fmt_num(q["price"], q["dp"])}</td>'
                           f'<td align="right" width="70" style="padding:8px 0;border-bottom:1px solid {P["rule"]};font:700 12px {SANS};'
                           f'color:{P["up"] if q["changePct"] > 0 else P["down"] if q["changePct"] < 0 else P["meta"]}">{fmt_pct(q["changePct"])}</td></tr>' for q in qs)
        body.append(row(
            f'<div style="background:{P["card"]};border:1px solid {P["rule"]};padding:16px 24px 10px">'
            f'<div style="font:400 18px {SERIF};color:{P["ink"]}">Markets <span class="sc" style="color:{P["meta"]};font-size:9px;margin-left:8px">Live · may be delayed</span></div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px"><tr>'
            f'<td valign="top" width="48%"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{col(v["mk"][:half])}</table></td>'
            f'<td width="4%"></td><td valign="top" width="48%"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{col(v["mk"][half:])}</table></td>'
            f'</tr></table></div>', '14px 0 6px 0'))
    if v['heroes']:
        body.append(row(f'<div class="sc" style="color:{P["down"]}">Top stories</div>', '20px 0 8px 0'))
        body += [card(s, True) for s in v['heroes']]
    for d in v['divisions']:
        body.append(row(f'<div class="sc">Division {d["code"]}</div>'
                        f'<div style="font:400 21px {SERIF};color:{P["ink"]};margin-top:3px;border-bottom:1px solid {P["ink"]};padding-bottom:8px">{esc(d["name"])}'
                        f'<span style="float:right;font:500 11px {SANS};color:{P["meta"]};margin-top:8px">{d["count"]} stories · {d["agents"]} agents</span></div>', '24px 0 12px 0'))
        if d['id'] == 'banking' and (v['banks'] or v['changes']):
            a = v['rates_agent']
            rws = ''.join(f'<tr><td style="padding:7px 0;border-bottom:1px solid {P["rule"]};font:600 13px {SANS};color:{P["ink"]}">{esc(b["bank"])}</td>'
                          + ''.join(f'<td align="right" style="padding:7px 0 7px 12px;border-bottom:1px solid {P["rule"]};font:600 13px {SANS};color:{P["ink"]}">'
                                    f'{rate_txt(b["deposit"].get(t))}</td>' for t in ('6M', '12M', '24M')) + '</tr>' for b in v['banks'])
            body.append(row(f'<div class="card" style="padding:16px 18px"><div class="sc">Deposit rates · {esc(a.get("name", ""))}, {esc(a.get("code", ""))}</div>'
                            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px"><tr>'
                            f'<td class="sc" style="color:{P["meta"]};font-size:9px">Bank</td>'
                            + ''.join(f'<td align="right" class="sc" style="color:{P["meta"]};font-size:9px">{t}</td>' for t in ('6M', '12M', '24M'))
                            + f'</tr>{rws}</table></div>', '0 0 12px 0'))
        body += [card(s) for s in d['rows']]
    body.append(cast_strip(v, P['meta'], P['rule'], 'CONTRIBUTING AGENTS', 30, P['meta'], 3))
    body.append(footer(P['meta'], P['ink'], P['rule']))
    return document(P['bg'], css, body, preheader(v), scheme='light')


RENDERERS = {'refined': refined, 'terminal': terminal, 'cinematic': cinematic, 'institutional': institutional}


def render(prefs, now, slot_label, sections, mk, banks, changes, quotes, total, lookback, style='cinematic'):
    """sections: [(div_id, [(dep_id, desk_name, [news...]), ...]), ...] → (html, images)."""
    v = build_view(prefs, now, slot_label, sections, mk, banks, changes, quotes, total, lookback)
    doc = RENDERERS.get(style, cinematic)(v)
    return doc, v['imgs'].used


def preview_html(doc, used):
    """cid: → paths relative to automation/out/preview/ so a dry-run preview opens in a browser."""
    for name, (cid, path) in used.items():
        doc = doc.replace(f'cid:{cid}', f'../../assets/email/{Path(path).name}')
    return doc
