/* Banking components — Phòng Ngân hàng Việt Nam:
 * SectorKpis, FundamentalsTable (theo nhóm chỉ tiêu, sắp xếp), MetricBars (so sánh trực quan), BankProfiles.
 */
window.AFA = window.AFA || {};
AFA.ui = AFA.ui || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;
  const GROUPS = [
    { id: 'scale', label: 'Scale & credit' },
    { id: 'efficiency', label: 'Profitability' },
    { id: 'quality', label: 'Asset quality' },
  ];
  const BIG = ['VCB', 'BID', 'CTG', 'AGR', 'TCB', 'MBB', 'ACB'];

  const fmt = (m, v) => U.fmtNum(v, m.dp);
  const sum = (list, k) => list.reduce((s, b) => s + b[k], 0);
  const wavg = (list, k, w) => list.reduce((s, b) => s + b[k] * b[w], 0) / (sum(list, w) || 1);

  AFA.ui.sectorKpis = function (data) {
    const b = data.banks;
    const cards = [
      ['Total assets', U.fmtNum(sum(b, 'totalAssets'), 0), 'VND tn'],
      ['Total loans', U.fmtNum(sum(b, 'loans'), 0), 'VND tn'],
      ['Credit growth', U.fmtNum(wavg(b, 'creditGrowth', 'loans'), 1), '% YTD'],
      ['Average NIM', U.fmtNum(wavg(b, 'nim', 'loans'), 2), '%'],
      ['Average NPL', U.fmtNum(wavg(b, 'npl', 'loans'), 2), '%'],
      ['Average ROE', U.fmtNum(wavg(b, 'roe', 'totalAssets'), 1), '%'],
    ];
    return `<section class="kpi-grid">${cards.map(([n, v, u]) => `<div class="kpi">
      <div class="kpi-head"><span class="kpi-name">${esc(n)}</span><span class="kpi-sym">${b.length} banks</span></div>
      <div class="kpi-price num">${v}<small> ${esc(u)}</small></div>
      <div class="kpi-chg muted">${esc(data.period)} · weighted average</div>
    </div>`).join('')}</section>`;
  };

  /** Bảng chỉ tiêu: tab nhóm chỉ tiêu, lọc nhóm NH, bấm tiêu đề cột để sắp xếp. */
  AFA.ui.fundamentalsTable = function (el, data) {
    const state = { tab: 'scale', group: '', sortBy: 'totalAssets', dir: -1 };
    el.innerHTML = `<div class="chart-head">
        <div class="seg" data-g="tab">${GROUPS.map(g => `<button data-v="${g.id}">${esc(g.label)}</button>`).join('')}</div>
        <div class="seg" data-g="group"><button data-v="">All</button><button data-v="state">State-owned</button><button data-v="private">Private</button></div>
      </div><div class="fund-body"></div>
      <p class="pipeline-note">Period ${esc(data.period)} · Click a column header to sort · Cyan = best, red = worst in column (NPL: lower is better) · Illustrative data.</p>`;
    const body = el.querySelector('.fund-body');

    function draw() {
      const cols = data.metrics.filter(m => m.group === state.tab);
      if (!cols.some(c => c.id === state.sortBy)) { state.sortBy = cols[0].id; state.dir = cols[0].better === 'low' ? 1 : -1; }
      const rows = data.banks.filter(b => !state.group || b.group === state.group)
        .sort((a, b) => state.dir * (a[state.sortBy] - b[state.sortBy]));
      const ext = {};
      cols.forEach(m => {
        const vs = rows.map(r => r[m.id]);
        const hi = Math.max(...vs), lo = Math.min(...vs);
        ext[m.id] = m.better === 'low' ? { best: lo, worst: hi } : { best: hi, worst: lo };
      });
      body.innerHTML = `<div class="table-wrap"><table class="qtable fund-table">
        <thead><tr><th class="num">#</th><th>Bank</th>${cols.map(m =>
          `<th class="num ${m.id === state.sortBy ? 'sorted' : ''}" data-sort="${m.id}" title="${esc(m.unit)}">${esc(m.label)}${m.id === state.sortBy ? (state.dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((b, i) => `<tr>
          <td class="num muted">${i + 1}</td>
          <td><span class="q-sym">${esc(b.bankId)}</span><span class="q-name">${esc(b.bank)}</span>${b.group === 'state' ? '<span class="tag tag-state">SOE</span>' : ''}</td>
          ${cols.map(m => {
            const v = b[m.id], cls = rows.length > 1 ? (v === ext[m.id].best ? 'best' : v === ext[m.id].worst ? 'worst' : '') : '';
            return `<td class="num ${cls}">${fmt(m, v)}</td>`;
          }).join('')}
        </tr>`).join('')}</tbody></table></div>`;
      el.querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(btn =>
        btn.classList.toggle('on', btn.dataset.v === state[s.dataset.g])));
    }

    el.addEventListener('click', e => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        if (state.sortBy === th.dataset.sort) state.dir *= -1; else { state.sortBy = th.dataset.sort; state.dir = -1; }
        return draw();
      }
      const btn = e.target.closest('.seg button');
      if (btn) { state[btn.parentElement.dataset.g] = btn.dataset.v; draw(); }
    });
    draw();
  };

  /** Biểu đồ thanh ngang so sánh một chỉ tiêu giữa các ngân hàng. */
  AFA.ui.metricBars = function (el, data) {
    let metric = 'nim';
    el.innerHTML = `<label class="fld" style="max-width:none;margin-bottom:10px"><span>Metric</span><select data-m>
        ${GROUPS.map(g => `<optgroup label="${esc(g.label)}">${data.metrics.filter(m => m.group === g.id).map(m =>
          `<option value="${m.id}" ${m.id === metric ? 'selected' : ''}>${esc(m.label)} (${esc(m.unit)})</option>`).join('')}</optgroup>`).join('')}
      </select></label><div class="bar-list"></div>`;
    const list = el.querySelector('.bar-list');
    function draw() {
      const m = data.metrics.find(x => x.id === metric);
      const rows = [...data.banks].sort((a, b) => (m.better === 'low' ? 1 : -1) * (a[metric] - b[metric]));
      const max = Math.max(...rows.map(r => r[metric])) || 1;
      list.innerHTML = rows.map(b => `<div class="bar-row ${b.group}" title="${esc(b.bank)}">
        <span class="q-sym">${esc(b.bankId)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${((b[metric] / max) * 100).toFixed(1)}%"></span></span>
        <span class="num">${fmt(m, b[metric])}</span></div>`).join('') +
        `<p class="pipeline-note">${m.better === 'low' ? 'Lower is better' : 'Higher is better'} · Pink bars = state-owned banks.</p>`;
    }
    el.querySelector('[data-m]').addEventListener('change', e => { metric = e.target.value; draw(); });
    draw();
  };

  /** Thẻ hồ sơ các ngân hàng lớn. */
  AFA.ui.bankProfiles = function (data) {
    const pick = ['nim', 'casa', 'npl', 'car', 'roe', 'roa'].map(id => data.metrics.find(m => m.id === id));
    return `<div class="dept-grid">${BIG.map(id => data.banks.find(b => b.bankId === id)).filter(Boolean).map(b => `
      <div class="dept-card">
        <div class="dept-top"><span class="agent-dot"></span><span class="agent-id">${esc(b.bankId)}</span><span class="agent-state">${b.group === 'state' ? 'STATE-OWNED' : 'PRIVATE'}</span></div>
        <h3>${esc(b.bank)}</h3>
        <div class="dept-en">Assets ${U.fmtNum(b.totalAssets, 0)} · Loans ${U.fmtNum(b.loans, 0)} VND tn</div>
        <p>PBT ${esc(b.period)}: <b class="num">${U.fmtNum(b.pbt, 1)}</b> VND tn
          <span class="pct-pill ${U.dir(b.pbtYoY)} num">${U.fmtPct(b.pbtYoY)} YoY</span> · Credit <b class="num">+${U.fmtNum(b.creditGrowth, 1)}%</b></p>
        <div class="dept-stats">${pick.map(m => `<span>${esc(m.label.replace(' ratio', ''))} <strong class="num">${fmt(m, b[m.id])}%</strong></span>`).join('')}</div>
      </div>`).join('')}</div>`;
  };

  AFA.ui.bankFundamentalsSection = async function (el) {
    const data = await AFA.data.getBankFundamentals();
    el.innerHTML = `
      <div class="section-title"><span class="kicker">Bank financial health</span><span class="muted small">${data.banks.length} banks · period ${esc(data.period)}</span></div>
      ${AFA.ui.sectorKpis(data)}
      <div class="grid g-2-1">
        ${AFA.ui.panel({ title: 'Financial metrics', body: '<div id="fund-table"></div>' })}
        ${AFA.ui.panel({ title: 'Visual comparison', body: '<div id="fund-bars"></div>' })}
      </div>
      ${AFA.ui.panel({ title: 'Major banks', body: AFA.ui.bankProfiles(data) })}`;
    AFA.ui.fundamentalsTable(el.querySelector('#fund-table'), data);
    AFA.ui.metricBars(el.querySelector('#fund-bars'), data);
  };

  AFA.ui.features = AFA.ui.features || {};
  AFA.ui.features.bankFundamentals = AFA.ui.bankFundamentalsSection;
})();
