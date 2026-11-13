/* Services — logic nghiệp vụ độc lập với nguồn dữ liệu (dùng chung cho mock & API). */
window.AFA = window.AFA || {};

(function () {
  const RANGES_MS = { '1h': 36e5, '24h': 864e5, '7d': 6048e5, '30d': 2592e6 };

  /** Lọc + sắp xếp tin. filter: { divisionId, departmentId, country, sector, category, importance, timeRange, q, sort, limit } */
  function filterNews(items, f = {}) {
    const now = Date.now();
    const q = (f.q || '').trim().toLowerCase();
    const minImp = Number(f.importance) || 0;
    const span = RANGES_MS[f.timeRange];
    const out = items.filter(n =>
      (!f.divisionId || n.divisionId === f.divisionId) &&
      (!f.departmentId || n.departmentId === f.departmentId) &&
      (!f.country || n.country === f.country) &&
      (!f.sector || n.sector === f.sector) &&
      (!f.category || n.category === f.category) &&
      (!minImp || n.importance >= minImp) &&
      (!span || now - Date.parse(n.publishedAt) <= span) &&
      (!q || (n.headline + ' ' + n.summary + ' ' + n.source + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q))
    );
    const byTime = (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    out.sort(f.sort === 'importance' ? (a, b) => b.importance - a.importance || byTime(a, b) : byTime);
    return f.limit ? out.slice(0, f.limit) : out;
  }

  /** Giá trị duy nhất cho các bộ lọc. */
  function newsFacets(items) {
    const uniq = key => [...new Set(items.map(n => n[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    return { countries: uniq('country'), sectors: uniq('sector'), categories: uniq('category') };
  }

  /** Các mã biến động mạnh nhất theo |%Δ|. */
  function topMovers(quotes, n = 6) {
    return [...quotes].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, n);
  }

  function rangeChange(points) {
    if (!points || points.length < 2) return { change: 0, pct: 0 };
    const a = points[0].v, b = points[points.length - 1].v;
    return { change: b - a, pct: ((b - a) / a) * 100 };
  }

  AFA.services = { filterNews, newsFacets, topMovers, rangeChange };
})();
