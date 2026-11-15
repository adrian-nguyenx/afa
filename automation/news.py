"""News job: collect RSS -> de-duplicate -> rule-based classification -> publish data/live/news.json.

International (non-Vietnamese) items are stored with status 'pending-translation' and published in their original
language; translate.py replaces the headline and summary with Vietnamese for the most important ones (daily cap).
"""
import hashlib
import html
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

from common import (AUTO, CONFIG, LIVE, STATE, http_get, iso, log, now_utc, parse_iso,
                    read_json, registry_department_ids, short_err, update_status, write_json, UTC)

STORE = STATE / 'news-store.json'
TAG_RE = re.compile(r'<[^>]+>')
WS_RE = re.compile(r'\s+')
WORD_RE = re.compile(r'\w+', re.U)


# ---------- parsing ----------

def clean_text(s, limit=None):
    s = html.unescape(TAG_RE.sub(' ', html.unescape(s or '')))
    s = unicodedata.normalize('NFC', WS_RE.sub(' ', s).strip())  # some feeds send decomposed Vietnamese diacritics
    if limit and len(s) > limit:
        s = s[:limit].rsplit(' ', 1)[0].rstrip(',.;:') + '…'
    return s


def norm_url(u):
    try:
        p = urlsplit(u.strip())
        q = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith(('utm_', 'fbclid', 'gclid'))]
        return urlunsplit((p.scheme or 'https', p.netloc.lower(), p.path.rstrip('/'), urlencode(q), ''))
    except ValueError:
        return u


VN_TZ = timezone(timedelta(hours=7))


def parse_date(s, default_tz=UTC):
    """RFC 822, ISO 8601 or US 'MM/DD/YYYY h:mm:ss AM' (Tuổi Trẻ). Naive times use the source's timezone."""
    if not s:
        return None
    s = s.strip()
    d = None
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError, IndexError):
        d = parse_iso(s)
        if d is None:
            for fmt in ('%m/%d/%Y %I:%M:%S %p', '%m/%d/%Y %H:%M:%S', '%d/%m/%Y %H:%M:%S'):
                try:
                    d = datetime.strptime(s, fmt)
                    break
                except ValueError:
                    pass
    if d and d.tzinfo is None:
        d = d.replace(tzinfo=default_tz)
    return d


def local(tag):
    return tag.rsplit('}', 1)[-1]


def parse_feed(raw, default_tz=UTC):
    """RSS 2.0 or Atom -> list of {title, link, summary, published}."""
    text = raw.decode('utf-8-sig', 'replace')
    root = ET.fromstring(text.encode('utf-8'))
    out = []
    for el in root.iter():
        name = local(el.tag)
        if name not in ('item', 'entry'):
            continue
        f = {}
        for c in el:
            n = local(c.tag)
            if n == 'link':
                f['link'] = (c.text or c.get('href') or '').strip() or f.get('link', '')
            elif n in ('title', 'description', 'summary', 'pubDate', 'published', 'updated', 'date') and n not in f:
                f[n] = c.text or ''
        out.append({
            'title': f.get('title', ''),
            'link': f.get('link', ''),
            'summary': f.get('description') or f.get('summary') or '',
            'published': parse_date(f.get('pubDate') or f.get('published') or f.get('updated') or f.get('date'), default_tz),
        })
    return out


# ---------- classification (rule-based, 0 tokens) ----------

class Classifier:
    def __init__(self, tax):
        self.tax = tax
        self.dept = {k: (v['divisionId'], self._rx(v['kw'])) for k, v in tax['departments'].items()}
        self.countries = {k: self._rx(v) for k, v in tax['countries'].items()}
        self.sectors = {k: self._rx(v) for k, v in tax['sectors'].items()}
        self.categories = {k: self._rx(v) for k, v in tax['categories'].items()}
        self.high = self._rx(tax['importance']['high'])
        self.medium = self._rx(tax['importance']['medium'])
        self.symbols = {k: self._rx(v) for k, v in tax['symbols'].items()}
        self.pct = re.compile(r'(\d+(?:[.,]\d+)?)\s?%')

    @staticmethod
    def _rx(words):
        words = sorted(set(w.lower() for w in words), key=len, reverse=True)
        return re.compile(r'(?<!\w)(?:' + '|'.join(re.escape(w) for w in words) + r')(?!\w)', re.U)

    @staticmethod
    def _hits(rx, title, body):
        return 2 * len(rx.findall(title)) + len(rx.findall(body))

    def classify(self, title, summary, src):
        t, b = title.lower(), summary.lower()
        scores = {}
        for dep, (_, rx) in self.dept.items():
            s = self._hits(rx, t, b)
            if dep == src.get('departmentId'):
                s += 1.5
            scores[dep] = s
        # International sources never land on Vietnam desks (and vice versa) unless strongly indicated
        intl = src.get('lang') != 'vi'
        for dep in scores:
            if intl and dep in ('vn-corporate', 'vn-macro', 'vn-equities', 'vn-banks', 'bank-rates'):
                scores[dep] -= 3
            if not intl and dep in ('global-corporate',) and scores[dep] < 4:
                scores[dep] -= 1
        dep = max(scores, key=scores.get)
        div = self.dept[dep][0]

        country = src.get('country', 'VN')
        best = 0
        for c, rx in self.countries.items():
            n = self._hits(rx, t, b)
            if n > best and (intl or dep in ('global-corporate', 'global-macro', 'us-equities', 'fx', 'commodities')):
                country, best = c, n
        if dep == 'us-equities':
            country = 'US'

        d = self.tax['departmentDefaults'].get(dep, {})
        sector = self._best(self.sectors, t, b) or d.get('sector', 'General')
        category = self._best(self.categories, t, b) or d.get('category', 'General')

        imp = 1
        if self.medium.search(t) or self.medium.search(b):
            imp += 1
        if self.high.search(t):
            imp += 1
        if any(float(x.replace(',', '.')) >= self.tax['importance']['bigMovePct'] for x in self.pct.findall(t)):
            imp += 1
        imp = max(1, min(3, imp + int(src.get('importanceBoost', 0))))

        markets = [s for s, rx in self.symbols.items() if rx.search(t) or rx.search(b)][:4]
        return {'divisionId': div, 'departmentId': dep, 'country': country, 'sector': sector,
                'category': category, 'importance': imp, 'markets': markets}

    def _best(self, table, t, b):
        best, name = 0, None
        for k, rx in table.items():
            n = self._hits(rx, t, b)
            if n > best:
                best, name = n, k
        return name


# ---------- de-duplication ----------

def tokens(s):
    return set(w for w in WORD_RE.findall(s.lower()) if len(w) > 1)


def is_dup(title, source, recent, threshold):
    """Same story from another source (same-source repeats are caught by URL; formulaic titles such as
    Fed press releases would otherwise collide)."""
    a = tokens(title)
    if len(a) < 4:
        return False
    for src, b in recent:
        if src != source and b and len(a & b) / len(a | b) >= threshold:
            return True
    return False


# ---------- job ----------

def run():
    cfg = CONFIG['news']
    sources = read_json(AUTO / 'sources.json', {}).get('sources', [])
    tax = read_json(AUTO / 'taxonomy.json')
    missing = set(tax['departments']) - registry_department_ids()
    if missing:
        raise SystemExit(f'taxonomy.json has departments not in registry.js: {sorted(missing)}')
    clf = Classifier(tax)

    store = read_json(STORE, {'items': []})
    items = store['items']
    by_url = {it['_key'] for it in items}
    now = now_utc()
    window = now - timedelta(hours=cfg['dedupeWindowHours'])
    recent = [(it['source'], tokens(it.get('orig', {}).get('headline') or it['headline'])) for it in items
              if (parse_iso(it['publishedAt']) or now) >= window]

    src_status, new_count = {}, 0
    for src in sources:
        if not src.get('enabled'):
            src_status[src['id']] = {'name': src['name'], 'ok': None, 'note': src.get('note', 'disabled')}
            continue
        try:
            entries = parse_feed(http_get(src['url']), VN_TZ if src.get('country') == 'VN' else UTC)
        except Exception as e:
            log('  news source failed', src['id'], short_err(e))
            src_status[src['id']] = {'name': src['name'], 'ok': False, 'error': short_err(e), 'at': iso(now)}
            continue
        added = 0
        for en in entries:
            title = clean_text(en['title'])
            link = en['link']
            if not title or not link:
                continue
            key = norm_url(link)
            if key in by_url or is_dup(title, src['name'], recent, cfg['dedupeJaccard']):
                continue
            pub = en['published'] or now
            if pub > now + timedelta(minutes=10):
                pub = now
            if pub < now - timedelta(days=cfg['retentionDays']):
                continue
            summary = clean_text(en['summary'], cfg['maxSummaryChars'])
            if summary.lower().startswith(title.lower()[:40]):
                summary = summary[len(title):].strip(' -–:') or summary
            c = clf.classify(title, summary, src)
            item = {
                'id': 'n-' + hashlib.sha1(key.encode()).hexdigest()[:12],
                '_key': key,
                'headline': title, 'summary': summary, 'source': src['name'], 'url': link,
                'publishedAt': iso(pub), 'collectedAt': iso(now), **c,
                'tags': [c['category'], c['sector']], 'lang': src['lang'],
            }
            if src['lang'] != 'vi':
                item['orig'] = {'headline': title, 'summary': summary, 'lang': src['lang']}
                item['status'] = 'pending-translation'
            items.append(item)
            by_url.add(key)
            recent.append((src['name'], tokens(title)))
            added += 1
        new_count += added
        src_status[src['id']] = {'name': src['name'], 'ok': True, 'items': len(entries), 'new': added, 'at': iso(now)}
        log(f'  {src["id"]}: {len(entries)} entries, {added} new')

    # retention + cap
    cutoff = now - timedelta(days=cfg['retentionDays'])
    items = [it for it in items if (parse_iso(it['publishedAt']) or now) >= cutoff]
    items.sort(key=lambda it: it['publishedAt'], reverse=True)
    store['items'] = items[:cfg['storeMax']]
    write_json(STORE, store)
    publish(store['items'])
    update_status('sources', None, src_status)
    update_status('jobs', 'news', {'lastRun': iso(now), 'ok': any(s.get('ok') for s in src_status.values()),
                                   'newItems': new_count, 'stored': len(store['items'])})
    log(f'news: {new_count} new, {len(store["items"])} stored')
    return new_count


PUBLIC_FIELDS = ('id', 'headline', 'summary', 'source', 'url', 'publishedAt', 'divisionId', 'departmentId',
                 'country', 'sector', 'category', 'markets', 'importance', 'tags')


def publishable(it):
    # International stories are published in their original language while (or if never) translated:
    # translation stays within the daily cap, so more sources add no token cost.
    return True


def publish(items):
    """Write the site-facing news.json (Vietnamese headline/summary only) and per-desk stats."""
    now = now_utc()
    pub = [it for it in items if publishable(it)][:CONFIG['news']['publishMax']]
    out = []
    for it in pub:
        o = {k: it[k] for k in PUBLIC_FIELDS if k in it}
        if it.get('status') == 'translated':
            o['translated'] = True
            o['origLang'] = it['orig']['lang']
        elif it.get('lang', 'vi') != 'vi':
            o['lang'] = it['lang']
        out.append(o)
    write_json(LIVE / 'news.json', {'generatedAt': iso(now), 'count': len(out), 'items': out})

    day = now - timedelta(hours=24)
    desks = {}
    for it in pub:
        d = desks.setdefault(it['departmentId'], {'total': 0, 'last24h': 0, 'lastItemAt': None})
        d['total'] += 1
        if (parse_iso(it['publishedAt']) or now) >= day:
            d['last24h'] += 1
        d['lastItemAt'] = max(d['lastItemAt'] or '', it['publishedAt'])
    update_status('desks', None, desks)
