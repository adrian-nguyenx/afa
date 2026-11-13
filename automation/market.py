"""Market job (prices, FX, history) and bank-rates job. Rule-based, 0 tokens.

Outputs:
  data/live/quotes.json            { generatedAt, items: [Quote] }  (only symbols fetched live)
  data/live/history/<SYMBOL>.json  { symbol, points: [{t, v}] }     (~1 year of daily closes)
  data/live/bank-rates.json        { banks: [BankRate (deposit only)], changes: [RateChange], updatedAt }
The site fills anything missing (other symbols, lending rates, other banks) from mock data, labelled as such.
"""
from datetime import datetime, timedelta

from common import (CONFIG, LIVE, STATE, http_json, iso, local_tz, log, now_utc, parse_iso,
                    read_json, short_err, update_status, write_json, UTC)

QUOTES = LIVE / 'quotes.json'
HIST_DIR = LIVE / 'history'
MSTATE = STATE / 'market.json'

META = {  # name, assetClass, departmentId, unit, dp  (mirrors assets/js/data/mock-market.js)
    'VNINDEX': ('VN-Index', 'index', 'vn-equities', 'pts', 2), 'VN30': ('VN30', 'index', 'vn-equities', 'pts', 2),
    'HNXINDEX': ('HNX-Index', 'index', 'vn-equities', 'pts', 2), 'UPCOM': ('UPCOM-Index', 'index', 'vn-equities', 'pts', 2),
    'VCB': ('Vietcombank', 'stock', 'vn-banks', 'VND', 0), 'TCB': ('Techcombank', 'stock', 'vn-banks', 'VND', 0),
    'BID': ('BIDV', 'stock', 'vn-banks', 'VND', 0), 'CTG': ('VietinBank', 'stock', 'vn-banks', 'VND', 0),
    'MBB': ('MB Bank', 'stock', 'vn-banks', 'VND', 0), 'ACB': ('ACB', 'stock', 'vn-banks', 'VND', 0),
    'VPB': ('VPBank', 'stock', 'vn-banks', 'VND', 0), 'STB': ('Sacombank', 'stock', 'vn-banks', 'VND', 0),
    'HDB': ('HDBank', 'stock', 'vn-banks', 'VND', 0), 'FPT': ('FPT Corp', 'stock', 'vn-equities', 'VND', 0),
    'HPG': ('Hoa Phat Group', 'stock', 'vn-equities', 'VND', 0), 'VIC': ('Vingroup', 'stock', 'vn-equities', 'VND', 0),
    'VNM': ('Vinamilk', 'stock', 'vn-equities', 'VND', 0), 'MWG': ('Mobile World', 'stock', 'vn-equities', 'VND', 0),
    'SSI': ('SSI Securities', 'stock', 'vn-equities', 'VND', 0),
    'SPX': ('S&P 500', 'index', 'us-equities', 'pts', 2), 'IXIC': ('Nasdaq Composite', 'index', 'us-equities', 'pts', 2),
    'DJI': ('Dow Jones', 'index', 'us-equities', 'pts', 2), 'VIX': ('CBOE VIX', 'indicator', 'us-equities', 'pts', 2),
    'US10Y': ('US 10Y Yield', 'indicator', 'us-equities', '%', 3), 'DXY': ('US Dollar Index', 'indicator', 'us-equities', 'pts', 2),
    'AAPL': ('Apple', 'stock', 'us-equities', 'USD', 2), 'MSFT': ('Microsoft', 'stock', 'us-equities', 'USD', 2),
    'NVDA': ('Nvidia', 'stock', 'us-equities', 'USD', 2), 'AMZN': ('Amazon', 'stock', 'us-equities', 'USD', 2),
    'GOOGL': ('Alphabet', 'stock', 'us-equities', 'USD', 2), 'META': ('Meta Platforms', 'stock', 'us-equities', 'USD', 2),
    'TSLA': ('Tesla', 'stock', 'us-equities', 'USD', 2),
    'USDVND': ('USD/VND', 'fx', 'fx', 'VND', 0), 'EURVND': ('EUR/VND', 'fx', 'fx', 'VND', 0),
    'JPYVND': ('JPY/VND', 'fx', 'fx', 'VND', 2), 'CNYVND': ('CNY/VND', 'fx', 'fx', 'VND', 0),
    'GBPVND': ('GBP/VND', 'fx', 'fx', 'VND', 0), 'EURUSD': ('EUR/USD', 'fx', 'fx', 'USD', 4),
    'USDJPY': ('USD/JPY', 'fx', 'fx', 'JPY', 2),
    'XAUUSD': ('Gold', 'commodity', 'commodities', 'USD/oz', 2), 'XAGUSD': ('Silver', 'commodity', 'commodities', 'USD/oz', 2),
    'WTI': ('WTI Crude', 'commodity', 'commodities', 'USD/bbl', 2), 'BRENT': ('Brent Crude', 'commodity', 'commodities', 'USD/bbl', 2),
    'NG': ('Natural Gas', 'commodity', 'commodities', 'USD/MMBtu', 3), 'HG': ('Copper', 'commodity', 'commodities', 'USD/lb', 3),
}


def session_open(session, now):
    """Rough trading-session check (UTC). 'vn' 02:00-08:00 Mon-Fri, 'us' 13:30-21:00 Mon-Fri, '24x5' Mon-Fri."""
    wd, mins = now.weekday(), now.hour * 60 + now.minute
    if session == 'vn':
        return wd < 5 and 120 <= mins <= 480
    if session == 'us':
        return wd < 5 and 810 <= mins <= 1260
    return wd < 5 or (wd == 6 and mins >= 1320)  # Sun 22:00 UTC reopen


# ---------- sources ----------

def yahoo(sym_id, rng):
    d = http_json(f'https://query1.finance.yahoo.com/v8/finance/chart/{sym_id}?range={rng}&interval=1d')
    r = d['chart']['result'][0]
    closes = r['indicators']['quote'][0].get('close') or []
    pts = [(t, c) for t, c in zip(r.get('timestamp') or [], closes) if c is not None]
    meta = r['meta']
    price = meta.get('regularMarketPrice') or (pts[-1][1] if pts else None)
    ts = meta.get('regularMarketTime') or (pts[-1][0] if pts else None)
    return price, ts, pts


def vndirect(sym_id, days):
    now = int(now_utc().timestamp())
    d = http_json(f'https://dchart-api.vndirect.com.vn/dchart/history?resolution=D&symbol={sym_id}&from={now - days * 86400}&to={now}')
    pts = [(t, c) for t, c in zip(d.get('t') or [], d.get('c') or []) if c is not None]
    return (pts[-1][1] if pts else None), (pts[-1][0] if pts else None), pts


def vcb_rates(day):
    d = http_json(f'https://www.vietcombank.com.vn/api/exchangerates?date={day:%Y-%m-%d}')
    out = {}
    for row in d.get('Data', []):
        try:
            out[row['currencyCode']] = float(row['transfer'] or row['sell'])
        except (KeyError, TypeError, ValueError):
            pass
    return out, d.get('UpdatedDate')


# ---------- market job ----------

def run(force=False):
    cfg = CONFIG['market']
    if not cfg.get('enabled'):
        return []
    now = now_utc()
    st = read_json(MSTATE, {'lastFetch': {}, 'historyDay': {}})
    quotes = {q['symbol']: q for q in (read_json(QUOTES, {}) or {}).get('items', [])}
    errors, fetched = [], []
    stale = timedelta(hours=cfg['staleRefetchHours'])
    today = now.strftime('%Y-%m-%d')
    vcb_cache = None

    for sym, sc in cfg['symbols'].items():
        src = sc['src']
        if not cfg['sources'].get(src, {}).get('enabled'):
            continue
        last = parse_iso(st['lastFetch'].get(sym, '')) if st['lastFetch'].get(sym) else None
        due = force or not last or session_open(sc['session'], now) or now - last >= stale
        if not due:
            continue
        need_hist = st['historyDay'].get(sym) != today
        try:
            if src == 'vcb':
                if vcb_cache is None:
                    cur, upd = vcb_rates(now.astimezone(local_tz()))
                    prev_day = now.astimezone(local_tz()) - timedelta(days=1)
                    while prev_day.weekday() >= 5:
                        prev_day -= timedelta(days=1)
                    prev, _ = vcb_rates(prev_day)
                    vcb_cache = (cur, prev, upd)
                cur, prev, upd = vcb_cache
                price, prev_close = cur.get(sc['id']), prev.get(sc['id'])
                ts = parse_iso(upd).timestamp() if upd and parse_iso(upd) else now.timestamp()
                pts = None
                append_history(sym, ts, price)
            else:
                if src == 'yahoo':
                    price, ts, pts = yahoo(sc['id'], '1y' if need_hist else '5d')
                else:
                    price, ts, pts = vndirect(sc['id'], 400 if need_hist else 12)
                scale = sc.get('scale', 1)
                price = price * scale if price is not None else None
                pts = [(t, c * scale) for t, c in pts]
                prev_close = prev_close_from(pts, ts)
                if need_hist and len(pts) > 30:
                    write_history(sym, pts)
                    st['historyDay'][sym] = today
                else:
                    append_history(sym, ts, price)
            if price is None:
                raise ValueError('no price')
            quotes[sym] = make_quote(sym, price, prev_close, ts, cfg['sources'][src]['label'])
            st['lastFetch'][sym] = iso(now)
            fetched.append(sym)
        except Exception as e:
            errors.append({'symbol': sym, 'source': src, 'error': short_err(e)})
            log('  quote failed', sym, short_err(e))

    write_json(QUOTES, {'generatedAt': iso(now), 'items': sorted(quotes.values(), key=lambda q: q['symbol'])})
    write_json(MSTATE, st)
    update_status('jobs', 'market', {'lastRun': iso(now), 'ok': not errors or bool(fetched),
                                     'fetched': len(fetched), 'live': sorted(quotes), 'errors': errors[:10]})
    log(f'market: {len(fetched)} fetched, {len(errors)} errors, {len(quotes)} live symbols')
    return fetched


def prev_close_from(pts, ts):
    """Close of the previous trading day relative to the latest quote."""
    if not pts:
        return None
    last_day = datetime.fromtimestamp(ts or pts[-1][0], UTC).date()
    earlier = [c for t, c in pts if datetime.fromtimestamp(t, UTC).date() < last_day]
    return earlier[-1] if earlier else (pts[-2][1] if len(pts) > 1 else None)


def make_quote(sym, price, prev, ts, source):
    name, ac, dep, unit, dp = META.get(sym, (sym, 'other', None, '', 2))
    prev = prev or price
    ch = price - prev
    return {'symbol': sym, 'name': name, 'assetClass': ac, 'departmentId': dep, 'unit': unit, 'dp': dp,
            'price': round(price, max(dp, 2) + 2), 'prevClose': round(prev, max(dp, 2) + 2),
            'change': round(ch, max(dp, 2) + 2), 'changePct': round(ch / prev * 100, 3) if prev else 0,
            'volume': None, 'updatedAt': iso(datetime.fromtimestamp(ts, UTC)) if ts else iso(now_utc()),
            'source': source}


def day_iso(ts):
    d = datetime.fromtimestamp(ts, UTC)
    return d.strftime('%Y-%m-%dT00:00:00Z')


def write_history(sym, pts):
    by_day = {}
    for t, c in pts:
        by_day[day_iso(t)] = c
    points = [{'t': k, 'v': round(v, 6)} for k, v in sorted(by_day.items())][-270:]
    write_json(HIST_DIR / f'{sym}.json', {'symbol': sym, 'points': points})


def append_history(sym, ts, price):
    if price is None:
        return
    path = HIST_DIR / f'{sym}.json'
    h = read_json(path, {'symbol': sym, 'points': []})
    k = day_iso(ts or now_utc().timestamp())
    if h['points'] and h['points'][-1]['t'] == k:
        h['points'][-1]['v'] = round(price, 6)
    else:
        h['points'].append({'t': k, 'v': round(price, 6)})
    h['points'] = h['points'][-270:]
    write_json(path, h)


# ---------- bank rates job ----------

TERMS = ['1M', '3M', '6M', '9M', '12M', '18M', '24M', '36M']
BANK_NAMES = {'VCB': ('Vietcombank', 'state'), 'BIDV': ('BIDV', 'state')}


def parse_vcb(url):
    d = http_json(url)
    out = {}
    for r in d.get('Data', []):
        if r.get('currencyCode') == 'VND' and r.get('tenorType') == 'Savings':
            t = r.get('tenor', '')
            if t.endswith('-months'):
                out[t.split('-')[0] + 'M'] = round(float(r['rates']) * 100, 2)
    return {k: out.get(k) for k in TERMS}, d.get('UpdatedDate')


def parse_bidv(url):
    d = http_json(url)
    out = {}
    for r in (d.get('hcm') or d.get('hanoi') or {}).get('data', []):
        en = (r.get('title_en') or '').lower()
        parts = en.split()
        if len(parts) == 2 and parts[1].startswith('month') and r.get('VND'):
            out[parts[0] + 'M'] = float(r['VND'])
    return {k: out.get(k) for k in TERMS}, None


PARSERS = {'vcb': parse_vcb, 'bidv': parse_bidv}


def run_rates():
    cfg = CONFIG['bankRates']
    if not cfg.get('enabled'):
        return []
    now = now_utc()
    path = LIVE / 'bank-rates.json'
    prev = read_json(path, {'banks': [], 'changes': []}) or {'banks': [], 'changes': []}
    prev_by = {b['bankId']: b for b in prev['banks']}
    banks, changes, errors = [], list(prev.get('changes', [])), []
    new_changes = []
    for bank_id, bc in cfg['banks'].items():
        if not bc.get('enabled'):
            continue
        try:
            dep, upd = PARSERS[bc['parser']](bc['url'])
            if sum(v is not None for v in dep.values()) < 4:
                raise ValueError('too few terms parsed')
            name, group = BANK_NAMES.get(bank_id, (bank_id, 'private'))
            row = {'bankId': bank_id, 'bank': name, 'group': group, 'deposit': dep,
                   'source': f'{name} website', 'updatedAt': upd or iso(now), 'live': True}
            old = prev_by.get(bank_id)
            if old:
                for k in TERMS:
                    a, b = old['deposit'].get(k), dep.get(k)
                    if a is not None and b is not None and abs(a - b) >= 0.001:
                        c = {'bankId': bank_id, 'bank': name, 'kind': 'deposit', 'key': k, 'from': a, 'to': b,
                             'date': iso(now), 'source': row['source']}
                        changes.insert(0, c)
                        new_changes.append(c)
            banks.append(row)
        except Exception as e:
            errors.append({'bankId': bank_id, 'error': short_err(e)})
            log('  bank rate failed', bank_id, short_err(e))
            if bank_id in prev_by:  # keep last good
                banks.append({**prev_by[bank_id], 'stale': True})
    cutoff = now - timedelta(days=90)
    changes = [c for c in changes if (parse_iso(c['date']) or now) >= cutoff][:200]
    write_json(path, {'updatedAt': iso(now), 'banks': banks, 'changes': changes})
    update_status('jobs', 'rates', {'lastRun': iso(now), 'ok': bool(banks), 'banks': [b['bankId'] for b in banks],
                                    'newChanges': len(new_changes), 'errors': errors})
    log(f'rates: {len(banks)} banks live, {len(new_changes)} changes')
    return new_changes
