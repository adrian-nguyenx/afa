/* ApiProvider — live data written by the Phase 3 automation (automation/run.py → data/live/*.json).
 *
 * api.mode 'static' reads JSON files next to the site (GitHub Pages friendly); 'rest' calls a real API server
 * with the same schemas (see README). Anything missing falls back to MockProvider, piece by piece:
 *   news           live only (mock stories are never mixed with real ones); whole file missing → mock
 *   quotes         live symbols + mock for symbols without a live source (Quote.source = 'mock')
 *   history        live file when it has enough points, else mock
 *   bank rates     live deposit rates for banks with a parser; lending rates, policy rates, promos, other banks → mock
 *   fundamentals   mock (no automated source in Phase 3)
 * init() probes status.json and sets `label`: LIVE · STALE · MOCK DATA.
 */
window.AFA = window.AFA || {};
AFA.providers = AFA.providers || {};

(function () {
  const RANGE_DAYS = { '1M': 22, '3M': 66, '6M': 130, '1Y': 260 };
  const cache = new Map();
  const mock = () => AFA.providers.mock;
  const cfg = () => AFA.config.api;

  function urlFor(key, vars) {
    let path = cfg().endpoints[key];
    if (!path) return null;
    Object.entries(vars || {}).forEach(([k, v]) => { path = path.replace(`{${k}}`, encodeURIComponent(v)); });
    return cfg().baseUrl.replace(/\/$/, '') + path;
  }

  async function fetchJSON(url, params) {
    const u = new URL(url, location.href);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, Array.isArray(v) ? v.join(',') : v);
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg().timeoutMs);
    try {
      const res = await fetch(u, { signal: ctrl.signal, headers: { Accept: 'application/json' }, cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${u.pathname}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /** Cached load of one live file; resolves to null when it is unavailable. */
  function load(key, vars) {
    const url = urlFor(key, vars);
    if (!url) return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, fetchJSON(url).catch(() => null));
    return cache.get(url);
  }

  const ageDays = iso => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 864e5));

  const api = {
    name: 'api',
    label: 'LIVE',
    status: null,

    /** Probe status.json once at boot. Returns false when no live data is reachable. */
    async init() {
      const st = await load('status');
      api.status = st;
      if (!st || !st.generatedAt) { api.label = 'MOCK DATA'; return false; }
      const ageH = (Date.now() - Date.parse(st.generatedAt)) / 36e5;
      api.label = ageH > cfg().staleAfterHours ? 'STALE' : 'LIVE';
      return true;
    },

    async getStatus() {
      return load('status');
    },

    async getNews(filter = {}) {
      const live = await load('news');
      if (!live || !Array.isArray(live.items)) return mock().getNews(filter);
      return AFA.services.filterNews(live.items, filter);
    },

    async getQuotes(symbols) {
      const live = await load('quotes');
      const bySym = {};
      ((live && live.items) || []).forEach(q => { bySym[q.symbol] = q; });
      const base = await mock().getQuotes(symbols);
      if (!symbols) {
        const extra = Object.values(bySym).filter(q => !base.some(b => b.symbol === q.symbol));
        return base.map(q => bySym[q.symbol] || q).concat(extra);
      }
      return base.map(q => bySym[q.symbol] || q);
    },

    async getHistory(symbol, range = '3M') {
      const live = await load('history', { symbol });
      if (!live || !live.points || live.points.length < 10) return mock().getHistory(symbol, range);
      return { symbol, range, points: live.points.slice(-(RANGE_DAYS[range] || 66)), source: 'live' };
    },

    async getBankRates() {
      const [base, live] = await Promise.all([mock().getBankRates(), load('bankRates')]);
      if (!live || !Array.isArray(live.banks) || !live.banks.length) return base;
      const liveBy = {};
      live.banks.forEach(b => { liveBy[b.bankId] = b; });
      const banks = base.banks.map(b => {
        const l = liveBy[b.bankId];
        if (!l) return b;
        const deposit = {};
        base.terms.forEach(t => { deposit[t] = l.deposit[t] != null ? l.deposit[t] : b.deposit[t]; });
        return { ...b, deposit, source: `${l.source} (deposit) · lending: mock`, live: true, stale: !!l.stale };
      });
      const liveChanges = (live.changes || []).map(c => ({ ...c, ageDays: ageDays(c.date) }));
      const changes = liveChanges.concat(base.changes.filter(c => !liveBy[c.bankId]))
        .sort((a, b) => a.ageDays - b.ageDays);
      return { ...base, banks, changes, updatedAt: live.updatedAt || base.updatedAt, liveBanks: Object.keys(liveBy) };
    },

    async getBankFundamentals() {
      return mock().getBankFundamentals();
    },

    /** Polling "real-time": every refreshIntervalMs the cache is cleared and `cb` is called. */
    subscribe(channel, cb) {
      const ms = AFA.config.refreshIntervalMs;
      if (!ms) return function unsubscribe() {};
      const id = setInterval(async () => {
        cache.clear();
        await api.init();
        try { cb(channel); } catch (e) { console.error(e); }
        AFA.events.emit('data:refresh', { channel });
      }, ms);
      return function unsubscribe() { clearInterval(id); };
    },
  };

  AFA.providers.api = api;
})();
