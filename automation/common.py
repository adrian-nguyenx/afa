"""Shared helpers for the Phase 3 automation (Python standard library only)."""
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

AUTO = Path(__file__).resolve().parent
SITE_URL = 'https://adrian-nguyenx.github.io/afa/'  # GitHub Pages (Phase 4); links in Email/Telegram point here
REPO = AUTO.parent
LIVE = REPO / 'data' / 'live'
STATE = AUTO / 'state'
PREVIEW = AUTO / 'out' / 'preview'
UTC = timezone.utc

DRY_RUN = False  # set by run.py; when True nothing is sent (previews are written instead)


def log(*parts):
    print(datetime.now().strftime('%H:%M:%S'), *parts, flush=True)


def load_env():
    """Read KEY=VALUE lines from REPO/.env (local only, git-ignored). Existing env vars win."""
    path = REPO / '.env'
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and v and not os.environ.get(k):
            os.environ[k] = v


def env(name):
    return (os.environ.get(name) or '').strip()


def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (FileNotFoundError, ValueError):
        return default


def write_json(path, obj, pretty=False):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    text = json.dumps(obj, ensure_ascii=False, indent=2 if pretty else None, separators=None if pretty else (',', ':'))
    tmp.write_text(text, encoding='utf-8')
    os.replace(tmp, path)


def write_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


CONFIG = read_json(AUTO / 'config.json', {})


def load_prefs():
    """notify-config.json merged with overrides set from Telegram (state/prefs-overrides.json)."""
    prefs = read_json(AUTO / 'notify-config.json', {})
    over = read_json(STATE / 'prefs-overrides.json', {})
    for sym, pct in (over.get('thresholds') or {}).items():
        prefs.setdefault('thresholds', {}).setdefault('prices', {})[sym] = pct
    for ch, imp in (over.get('minImportance') or {}).items():
        if ch in prefs.get('channels', {}):
            prefs['channels'][ch]['minImportance'] = imp
    prefs['_mutedUntil'] = over.get('mutedUntil')
    return prefs


def now_utc():
    return datetime.now(UTC)


def iso(dt):
    return dt.astimezone(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')


def parse_iso(s):
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except (AttributeError, ValueError):
        return None


def local_tz(prefs=None):
    mins = (prefs or {}).get('utcOffsetMinutes', 420)
    return timezone(timedelta(minutes=mins))


def hm(s):
    h, m = s.split(':')
    return int(h), int(m)


def http_get(url, timeout=None, headers=None, data=None, method=None, retries=1):
    """GET (or POST when data is given) with a generic UA; returns bytes. Raises on final failure."""
    h = {'User-Agent': CONFIG.get('userAgent', 'Mozilla/5.0'), 'Accept': '*/*'}
    h.update(headers or {})
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=timeout or CONFIG.get('httpTimeoutSec', 20)) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code < 500 and e.code != 429:
                break
        except Exception as e:  # network/TLS errors
            last = e
        if attempt < retries:
            time.sleep(2 + attempt * 3)
    raise last


def http_json(url, **kw):
    return json.loads(http_get(url, **kw).decode('utf-8-sig'))


def short_err(e):
    s = f'{type(e).__name__}: {e}'
    return s[:160]


def update_status(section, key, value):
    path = LIVE / 'status.json'
    st = read_json(path, {}) or {}
    st.setdefault(section, {})
    if key is None:
        st[section] = value
    else:
        st[section][key] = value
    st['generatedAt'] = iso(now_utc())
    st['mode'] = 'live'
    write_json(path, st, pretty=True)


def registry_tree():
    """[(divisionId, divisionName, [(departmentId, departmentName), ...]), ...] parsed from the site's registry.js,
    in display order. Divisions without desks (Investment = Coming Soon) are left out."""
    text = (REPO / 'assets' / 'js' / 'core' / 'registry.js').read_text(encoding='utf-8')
    tree, cur, pending = [], None, None
    for line in text.splitlines():
        m = re.match(r"^( {6}| {10})(id|name): '([^']+)'", line)
        if not m:
            continue
        depth, field, val = len(m.group(1)), m.group(2), m.group(3)
        if field == 'id':
            pending = (depth, val)
        elif pending and pending[0] == depth:
            if depth == 6:
                cur = (pending[1], val, [])
                tree.append(cur)
            elif cur:
                cur[2].append((pending[1], val))
            pending = None
    return [d for d in tree if d[2]]


def registry_meta():
    """Division and agent identities straight from the site's registry.js (single source of truth):
    {'divisions': {id: {code, color, nameEn}}, 'agents': {departmentId: {name, code, title}}}."""
    text = (REPO / 'assets' / 'js' / 'core' / 'registry.js').read_text(encoding='utf-8')
    divisions = {}
    for m in re.finditer(r"^ {6}id: '([a-z-]+)',\s*\n {6}code: '(\d+)',\s*\n {6}color: '(#[0-9a-fA-F]+)',"
                         r"\s*\n {6}name: '[^']*',\s*\n {6}nameEn: '([^']+)'", text, re.M):
        divisions[m.group(1)] = {'code': m.group(2), 'color': m.group(3), 'nameEn': m.group(4)}
    agents = {}
    for m in re.finditer(r"'([a-z-]+)':\s*\{ name: (['\"])(.+?)\2, alias: .*?code: '([A-Z0-9-]+)', title: '([^']+)'", text):
        agents[m.group(1)] = {'name': m.group(3), 'code': m.group(4), 'title': m.group(5)}
    return {'divisions': divisions, 'agents': agents}


def registry_department_ids():
    """Department ids declared in the site's registry (keeps taxonomy.json in sync)."""
    return {dep for _, _, deps in registry_tree() for dep, _ in deps}
