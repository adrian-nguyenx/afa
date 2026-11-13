/* MockProvider — triển khai Data Provider Interface bằng dữ liệu giả lập.
 *
 * Data Provider Interface (mọi provider phải tuân theo):
 *   getNews(filter)           -> Promise<NewsItem[]>
 *   getQuotes(symbols?)       -> Promise<Quote[]>      (bỏ symbols = tất cả)
 *   getHistory(symbol, range) -> Promise<PriceHistory> range: '1M'|'3M'|'6M'|'1Y'
 *   getBankRates()            -> Promise<{ terms, lendingTypes, policy, banks, changes, promos, updatedAt }>
 *   getBankFundamentals()     -> Promise<{ period, metrics, banks }>
 *   subscribe(channel, cb)    -> unsubscribe fn         (real-time — Phase 3)
 */
window.AFA = window.AFA || {};
AFA.providers = AFA.providers || {};

(function () {
  const U = AFA.utils;
  const loadedAt = Date.now();
  const RANGE_DAYS = { '1M': 22, '3M': 66, '6M': 130, '1Y': 260 };

  // Chuẩn hóa news theo schema NewsItem
  const news = AFA.mock.news.map((r, i) => {
    const [departmentId, ageMin, importance, country, sector, category, source, headline, summary, markets] = r;
    const dept = AFA.registry.getDepartment(departmentId);
    return {
      id: 'mock-news-' + (i + 1),
      headline, summary, source,
      url: AFA.mock.sources[source] || '#',
      publishedAt: new Date(loadedAt - ageMin * 60000).toISOString(),
      divisionId: dept ? dept.divisionId : null,
      departmentId, country, sector, category,
      markets: markets || [],
      importance,
      tags: [category, sector],
    };
  });

  // Sinh lịch sử giá (business days) bằng random walk có seed, kết thúc tại giá hiện tại
  const historyCache = {};
  function buildHistory(inst) {
    if (historyCache[inst.symbol]) return historyCache[inst.symbol];
    const rnd = U.seeded(U.hash(inst.symbol));
    const vol = AFA.mock.volatility[inst.assetClass] || 0.01;
    const n = RANGE_DAYS['1Y'];
    const vals = new Array(n);
    vals[n - 1] = inst.price;
    vals[n - 2] = inst.price / (1 + inst.changePct / 100);
    for (let i = n - 3; i >= 0; i--) {
      const g = (rnd() + rnd() + rnd() - 1.5) * 1.15; // ~N(0,1) xấp xỉ
      const r = 0.0003 + vol * g;
      vals[i] = vals[i + 1] / (1 + r);
    }
    // ngày giao dịch (bỏ T7/CN)
    const dates = [];
    const d = new Date(loadedAt);
    d.setHours(0, 0, 0, 0);
    while (dates.length < n) {
      const wd = d.getDay();
      if (wd !== 0 && wd !== 6) dates.unshift(d.toISOString());
      d.setDate(d.getDate() - 1);
    }
    const points = vals.map((v, i) => ({ t: dates[i], v: +v.toFixed(Math.max(inst.dp, 2)) }));
    historyCache[inst.symbol] = points;
    return points;
  }

  function toQuote(inst) {
    const prev = inst.price / (1 + inst.changePct / 100);
    return {
      symbol: inst.symbol, name: inst.name, assetClass: inst.assetClass,
      departmentId: inst.departmentId, unit: inst.unit, dp: inst.dp,
      price: inst.price, prevClose: prev, change: inst.price - prev, changePct: inst.changePct,
      volume: inst.volume, updatedAt: new Date(loadedAt).toISOString(), source: 'mock',
    };
  }

  const bySymbol = {};
  AFA.mock.instruments.forEach(i => { bySymbol[i.symbol] = i; });

  AFA.providers.mock = {
    name: 'mock',
    label: 'MOCK DATA',
    async getNews(filter = {}) {
      return AFA.services.filterNews(news, filter);
    },
    async getQuotes(symbols) {
      const list = symbols ? symbols.map(s => bySymbol[s]).filter(Boolean) : AFA.mock.instruments;
      return list.map(toQuote);
    },
    async getHistory(symbol, range = '3M') {
      const inst = bySymbol[symbol];
      if (!inst) return { symbol, points: [] };
      const pts = buildHistory(inst);
      return { symbol, range, points: pts.slice(-(RANGE_DAYS[range] || 66)) };
    },
    /** Lãi suất ngân hàng: { terms, lendingTypes, policy[], banks[], updatedAt } */
    async getBankRates() {
      return {
        terms: AFA.mock.depositTerms,
        lendingTypes: AFA.mock.lendingTypes,
        policy: AFA.mock.policyRates,
        banks: AFA.mock.bankRates,
        changes: AFA.mock.rateChanges.map(c => {
          const b = AFA.mock.bankRates.find(x => x.bankId === c.bankId);
          return { ...c, bank: b ? b.bank : c.bankId, date: new Date(loadedAt - c.ageDays * 864e5).toISOString() };
        }),
        promos: AFA.mock.ratePromos.map(p => {
          const b = AFA.mock.bankRates.find(x => x.bankId === p.bankId);
          return { ...p, bank: b ? b.bank : p.bankId, endsAt: new Date(loadedAt + p.endsInDays * 864e5).toISOString() };
        }),
        updatedAt: new Date(loadedAt).toISOString(),
      };
    },
    /** Chỉ tiêu tài chính ngân hàng: { period, metrics[], banks[] } */
    async getBankFundamentals() {
      return { period: AFA.mock.bankPeriod, metrics: AFA.mock.bankMetrics, banks: AFA.mock.bankFundamentals };
    },
    /** Automation status — none in mock mode. */
    async getStatus() {
      return null;
    },
    subscribe() {
      return function unsubscribe() {};
    },
  };
})();
