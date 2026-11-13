/* View: Dashboard (trang chủ). */
window.AFA = window.AFA || {};
AFA.views = AFA.views || {};

AFA.views.dashboard = {
  async render(el) {
    const ui = AFA.ui, D = AFA.data, C = AFA.config.dashboard, U = AFA.utils;

    const [kpis, all, latest, corp, macro, idx, fx, com] = await Promise.all([
      D.getQuotes(C.kpiSymbols),
      D.getQuotes(),
      D.getNews({ limit: 8 }),
      D.getNews({ divisionId: 'corporate', importance: 2, sort: 'importance', limit: 5 }),
      D.getNews({ divisionId: 'macro', importance: 2, sort: 'importance', limit: 5 }),
      D.getQuotes(C.indexTable),
      D.getQuotes(C.fxTable),
      D.getQuotes(C.commodityTable),
    ]);
    const hist = await Promise.all(kpis.map(q => D.getHistory(q.symbol, '1M')));
    const movers = AFA.services.topMovers(all.filter(q => q.assetClass === 'stock' || q.assetClass === 'commodity'), 6);
    const breaking = latest.filter(n => n.importance === 3).slice(0, 1)[0];

    const moverRows = movers.map(q => `<a class="mover" href="${U.esc(AFA.registry.deptHref(q.departmentId))}">
        <span><span class="q-sym">${U.esc(q.symbol)}</span><span class="q-name">${U.esc(q.name)}</span></span>
        <span class="num">${U.fmtNum(q.price, q.dp)}</span>
        <span class="pct-pill ${U.dir(q.changePct)} num">${U.fmtPct(q.changePct)}</span></a>`).join('');

    const ups = all.filter(q => q.changePct > 0).length, downs = all.filter(q => q.changePct < 0).length;

    el.innerHTML = `
      ${ui.pageHeader({
        kicker: 'Financial & Economic Intelligence Center',
        title: 'Market Overview',
        subtitle: 'Financial & economic news and market data from every division and desk.',
        aside: `<div class="head-actions"><a class="btn-3d" href="#/3d">◈ Enter 3D Center</a><div class="breadth"><span class="up num">▲ ${ups}</span><span class="down num">▼ ${downs}</span><small>tracked symbols</small></div></div>`,
      })}

      ${breaking ? `<a class="breaking" href="${U.esc(breaking.url)}" target="_blank" rel="noopener noreferrer">
        <span class="breaking-tag">Breaking</span><span lang="vi">${U.esc(breaking.headline)}</span><small>${U.esc(breaking.source)} · ${U.esc(U.timeAgo(breaking.publishedAt))}</small></a>` : ''}

      <section class="kpi-grid">${kpis.map((q, i) => ui.kpiCard(q, hist[i].points)).join('')}</section>

      <div class="grid g-2-1">
        ${ui.panel({ title: 'Market chart', body: '<div id="dash-chart"></div>' })}
        ${ui.panel({ title: 'Top movers', body: `<div class="movers">${moverRows}</div>`, action: '<span class="muted small">Top |%Δ|</span>' })}
      </div>

      <div class="grid g-3">
        ${ui.panel({ title: 'Latest news', body: ui.newsList(latest, { compact: true }), action: '<a class="link" href="#/news">All →</a>' })}
        ${ui.panel({ title: 'Corporate highlights', body: ui.newsList(corp, { compact: true }), action: '<a class="link" href="#/corporate">Corporate →</a>' })}
        ${ui.panel({ title: 'Key macro news', body: ui.newsList(macro, { compact: true }), action: '<a class="link" href="#/macro">Macro →</a>' })}
      </div>

      <div class="grid g-3">
        ${ui.panel({ title: 'Stock indices', body: ui.quoteTable(idx), action: '<a class="link" href="#/market">Market →</a>' })}
        ${ui.panel({ title: 'Exchange rates', body: ui.quoteTable(fx), action: '<a class="link" href="#/market/fx">FX →</a>' })}
        ${ui.panel({ title: 'Commodities', body: ui.quoteTable(com), action: '<a class="link" href="#/market/commodities">Commodities →</a>' })}
      </div>`;

    await ui.chartWidget(el.querySelector('#dash-chart'), C.kpiSymbols, C.featuredChart);
  },
};
