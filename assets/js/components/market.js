/* Market components: Sparkline, KpiCard, QuoteTable, LineChart, ChartWidget. */
window.AFA = window.AFA || {};
AFA.ui = AFA.ui || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;
  let uid = 0;

  AFA.ui.sparkline = function (points, w = 120, h = 34) {
    if (!points || points.length < 2) return '';
    const vs = points.map(p => p.v);
    const mn = Math.min(...vs), mx = Math.max(...vs), span = mx - mn || 1;
    const d = vs.map((v, i) => `${i ? 'L' : 'M'}${((i / (vs.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - mn) / span) * (h - 4)).toFixed(1)}`).join('');
    const cls = vs[vs.length - 1] >= vs[0] ? 'up' : 'down';
    return `<svg class="spark ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
  };

  AFA.ui.kpiCard = function (q, points) {
    const dir = U.dir(q.changePct);
    return `<a class="kpi" href="${esc(AFA.registry.deptHref(q.departmentId))}">
      <div class="kpi-head"><span class="kpi-name">${esc(q.name)}</span><span class="kpi-sym">${esc(q.symbol)}</span></div>
      <div class="kpi-price num">${U.fmtNum(q.price, q.dp)} <small>${esc(q.unit)}</small></div>
      <div class="kpi-chg num ${dir}">${U.arrow(q.changePct)} ${U.fmtSigned(q.change, q.dp)} (${U.fmtPct(q.changePct)})</div>
      <div class="kpi-spark">${AFA.ui.sparkline(points)}</div>
    </a>`;
  };

  AFA.ui.quoteTable = function (quotes, opts = {}) {
    if (!quotes.length) return AFA.ui.emptyState();
    const showVol = opts.volume && quotes.some(q => q.volume);
    const rows = quotes.map(q => {
      const dir = U.dir(q.changePct);
      return `<tr>
        <td><span class="q-sym">${esc(q.symbol)}</span><span class="q-name">${esc(q.name)}</span></td>
        <td class="num">${U.fmtNum(q.price, q.dp)}</td>
        <td class="num ${dir}">${U.fmtSigned(q.change, q.dp)}</td>
        <td class="num ${dir}"><span class="pct-pill ${dir}">${U.fmtPct(q.changePct)}</span></td>
        ${showVol ? `<td class="num muted">${q.volume ? U.fmtCompact(q.volume) : '—'}</td>` : ''}
      </tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="qtable">
      <thead><tr><th>Symbol</th><th class="num">Price</th><th class="num">+/-</th><th class="num">%</th>${showVol ? '<th class="num">Volume</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  };

  /** Vẽ line chart SVG có tooltip vào phần tử box. */
  AFA.ui.lineChart = function (box, points, opts = {}) {
    if (!points || points.length < 2) { box.innerHTML = AFA.ui.emptyState('No price history yet.'); return; }
    const dp = opts.dp == null ? 2 : opts.dp;
    const W = Math.max(box.clientWidth || 600, 280);
    const H = box.clientHeight || 260;
    const P = { l: 8, r: 66, t: 14, b: 24 };
    const vs = points.map(p => p.v);
    let mn = Math.min(...vs), mx = Math.max(...vs);
    const pad = (mx - mn) * 0.08 || Math.abs(mx) * 0.01 || 1;
    mn -= pad; mx += pad;
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const x = i => P.l + (iw * i) / (points.length - 1);
    const y = v => P.t + ih * (1 - (v - mn) / (mx - mn));
    const cls = vs[vs.length - 1] >= vs[0] ? 'up' : 'down';
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${H - P.b}L${P.l},${H - P.b}Z`;
    const gid = 'cg' + (++uid);

    let grid = '';
    for (let k = 0; k <= 4; k++) {
      const v = mn + ((mx - mn) * k) / 4, yy = y(v).toFixed(1);
      grid += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${yy}" y2="${yy}"/><text class="axis" x="${W - P.r + 6}" y="${yy}" dy="4">${U.fmtNum(v, dp)}</text>`;
    }
    for (let k = 0; k <= 4; k++) {
      const i = Math.round(((points.length - 1) * k) / 4);
      const anchor = k === 0 ? 'start' : k === 4 ? 'end' : 'middle';
      grid += `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${U.fmtShortDate(points[i].t)}</text>`;
    }
    const last = points[points.length - 1];

    box.innerHTML = `<svg class="chart ${cls}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Price chart">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity="0.28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#${gid})"/>
      <path class="chart-line" d="${line}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
      <line class="last-line" x1="${P.l}" x2="${W - P.r}" y1="${y(last.v).toFixed(1)}" y2="${y(last.v).toFixed(1)}"/>
      <rect class="last-tag" x="${W - P.r + 2}" y="${(y(last.v) - 9).toFixed(1)}" width="${P.r - 4}" height="18" rx="3"/>
      <text class="last-text" x="${W - P.r + 6}" y="${y(last.v).toFixed(1)}" dy="4">${U.fmtNum(last.v, dp)}</text>
      <line class="xh" y1="${P.t}" y2="${H - P.b}" x1="-10" x2="-10"/>
      <circle class="dot" r="3.5" cx="-10" cy="-10"/>
      <rect class="hit" x="${P.l}" y="${P.t}" width="${iw}" height="${ih}" fill="transparent"/>
    </svg><div class="chart-tip" hidden></div>`;

    const svg = box.querySelector('svg');
    const xh = svg.querySelector('.xh'), dot = svg.querySelector('.dot'), tip = box.querySelector('.chart-tip');
    const hit = svg.querySelector('.hit');
    hit.addEventListener('pointermove', e => {
      const r = svg.getBoundingClientRect();
      const px = (e.clientX - r.left) * (W / r.width);
      const i = Math.min(points.length - 1, Math.max(0, Math.round(((px - P.l) / iw) * (points.length - 1))));
      const p = points[i], cx = x(i), cy = y(p.v);
      xh.setAttribute('x1', cx); xh.setAttribute('x2', cx);
      dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
      tip.hidden = false;
      tip.innerHTML = `<span>${U.fmtDate(p.t)}</span><strong class="num">${U.fmtNum(p.v, dp)}</strong>`;
      const left = (cx / W) * r.width;
      tip.style.left = Math.min(r.width - 120, Math.max(0, left - 60)) + 'px';
    });
    hit.addEventListener('pointerleave', () => {
      tip.hidden = true; xh.setAttribute('x1', -10); xh.setAttribute('x2', -10); dot.setAttribute('cx', -10);
    });
  };

  /** Widget: tab chọn mã + chọn khoảng thời gian + line chart. */
  AFA.ui.chartWidget = async function (el, symbols, defaultSymbol) {
    const quotes = await AFA.data.getQuotes(symbols);
    let sym = defaultSymbol || symbols[0], range = '3M', lastPts = null, lastDp = 2;
    el.innerHTML = `<div class="chart-head">
        <div class="seg chart-tabs">${quotes.map(q => `<button data-sym="${esc(q.symbol)}">${esc(q.name)}</button>`).join('')}</div>
        <div class="seg chart-ranges">${['1M', '3M', '6M', '1Y'].map(r => `<button data-range="${r}">${r}</button>`).join('')}</div>
      </div>
      <div class="chart-info"></div>
      <div class="chart-box"></div>`;
    const box = el.querySelector('.chart-box'), info = el.querySelector('.chart-info');

    async function draw() {
      const q = quotes.find(x => x.symbol === sym) || quotes[0];
      const h = await AFA.data.getHistory(q.symbol, range);
      lastPts = h.points; lastDp = q.dp;
      const rc = AFA.services.rangeChange(h.points), dir = U.dir(rc.pct);
      info.innerHTML = `<span class="ci-name">${esc(q.name)} <small>${esc(q.symbol)} · ${esc(q.unit)}</small></span>
        <span class="num ci-price">${U.fmtNum(q.price, q.dp)}</span>
        <span class="num ${U.dir(q.changePct)}">${U.arrow(q.changePct)} ${U.fmtPct(q.changePct)} today</span>
        <span class="num ${dir} muted-label">${range}: ${U.fmtPct(rc.pct)}</span>`;
      el.querySelectorAll('[data-sym]').forEach(b => b.classList.toggle('on', b.dataset.sym === q.symbol));
      el.querySelectorAll('[data-range]').forEach(b => b.classList.toggle('on', b.dataset.range === range));
      AFA.ui.lineChart(box, lastPts, { dp: lastDp });
    }

    el.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.sym) sym = b.dataset.sym;
      if (b.dataset.range) range = b.dataset.range;
      draw();
    });

    let lastW = 0;
    const ro = new ResizeObserver(() => {
      if (!box.isConnected) { ro.disconnect(); return; }
      if (lastPts && Math.abs(box.clientWidth - lastW) > 4) { lastW = box.clientWidth; AFA.ui.lineChart(box, lastPts, { dp: lastDp }); }
    });
    ro.observe(box);
    await draw();
    lastW = box.clientWidth;
  };
})();
