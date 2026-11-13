/* Rate components — theo dõi lãi suất NH TMCP (Phòng Vĩ mô Việt Nam):
 * PolicyRateCards, RateBoard (so sánh & xếp hạng), RateSummary (trung bình & chênh lệch),
 * RateAlerts (cảnh báo thay đổi), RateHistory (lịch sử điều chỉnh), RatesSection (ghép tất cả).
 */
window.AFA = window.AFA || {};
AFA.ui = AFA.ui || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;
  const pct = v => (v == null ? '—' : U.fmtNum(v, 2));
  const ALERT_DAYS = 7;   // cảnh báo: thay đổi trong 7 ngày
  const MARK_DAYS = 30;   // đánh dấu ô đã đổi trong 30 ngày

  const keyLabel = (data, kind, key) => kind === 'deposit'
    ? `${key} deposit`
    : `${((data.lendingTypes.find(t => t.id === key) || {}).label || key)} loan`;

  AFA.ui.policyRateCards = function (policy) {
    return `<section class="kpi-grid">${policy.map(r => {
      const d = r.value - r.prev;
      return `<div class="kpi">
        <div class="kpi-head"><span class="kpi-name">${esc(r.name)}</span><span class="kpi-sym">NHNN</span></div>
        <div class="kpi-price num">${pct(r.value)}<small> ${esc(r.unit)}</small></div>
        <div class="kpi-chg num ${U.dir(d)}">${d ? `${U.arrow(d)} ${U.fmtSigned(d, 2)} pp` : '■ Unchanged'}</div>
      </div>`;
    }).join('')}</section>`;
  };

  /** Bảng so sánh: lọc nhóm, chuyển huy động/cho vay, sắp xếp; tô sáng mức tốt nhất mỗi cột. */
  AFA.ui.rateBoard = function (el, data) {
    const state = { kind: 'deposit', group: '', sortBy: '12M' };
    const cols = {
      deposit: data.terms.map(t => ({ id: t, label: t.replace('M', 'T') })),
      lending: data.lendingTypes.map(t => ({ id: t.id, label: t.label })),
    };
    const recent = {};
    data.changes.filter(c => c.ageDays <= MARK_DAYS).forEach(c => { recent[`${c.bankId}|${c.kind}|${c.key}`] = c; });

    el.innerHTML = `<div class="chart-head">
        <div class="seg" data-g="kind"><button data-v="deposit">Deposit</button><button data-v="lending">Lending</button></div>
        <div class="seg" data-g="group"><button data-v="">All</button><button data-v="state">State-owned</button><button data-v="private">Private</button></div>
        <label class="fld rate-sort"><span>Rank by</span><select data-sort></select></label>
      </div>
      <div class="rate-body"></div>
      <p class="pipeline-note">% p.a. · Highlighted = best in column (deposit: highest, lending: lowest) · ▲▼ = changed in the last ${MARK_DAYS} days · Illustrative data.</p>`;

    const body = el.querySelector('.rate-body'), sortSel = el.querySelector('[data-sort]');

    function draw() {
      const cs = cols[state.kind], asc = state.kind === 'lending';
      if (!cs.some(c => c.id === state.sortBy)) state.sortBy = asc ? 'home' : '12M';
      sortSel.innerHTML = cs.map(c => `<option value="${esc(c.id)}" ${c.id === state.sortBy ? 'selected' : ''}>${esc(c.label)}</option>`).join('');
      const get = (b, k) => b[state.kind][k];
      const rows = data.banks.filter(b => !state.group || b.group === state.group)
        .sort((a, b) => (asc ? 1 : -1) * (get(a, state.sortBy) - get(b, state.sortBy)));
      const best = {};
      cs.forEach(c => { const vs = rows.map(r => get(r, c.id)); best[c.id] = asc ? Math.min(...vs) : Math.max(...vs); });

      body.innerHTML = `<div class="table-wrap"><table class="qtable rate-table">
        <thead><tr><th class="num">#</th><th>Bank</th>${cs.map(c => `<th class="num ${c.id === state.sortBy ? 'sorted' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((b, i) => `<tr>
          <td class="num muted">${i + 1}</td>
          <td><span class="q-sym">${esc(b.bankId)}</span><span class="q-name">${esc(b.bank)}</span>${b.group === 'state' ? '<span class="tag tag-state">SOE</span>' : ''}${b.live ? `<span class="tag tag-live" title="${esc(b.source)}">LIVE</span>` : ''}</td>
          ${cs.map(c => {
            const v = get(b, c.id), ch = recent[`${b.bankId}|${state.kind}|${c.id}`];
            const mark = ch ? `<i class="chg ${U.dir(ch.to - ch.from)}" title="${esc(U.fmtSigned(ch.to - ch.from, 2))} pp · ${esc(U.timeAgo(ch.date))}">${U.arrow(ch.to - ch.from)}</i>` : '';
            return `<td class="num ${v === best[c.id] ? 'best' : ''}">${pct(v)}${mark}</td>`;
          }).join('')}
        </tr>`).join('')}</tbody></table></div>`;
      el.querySelectorAll('.seg').forEach(s => s.querySelectorAll('button').forEach(btn =>
        btn.classList.toggle('on', btn.dataset.v === state[s.dataset.g])));
    }

    el.addEventListener('click', e => {
      const btn = e.target.closest('.seg button');
      if (!btn) return;
      state[btn.parentElement.dataset.g] = btn.dataset.v;
      draw();
    });
    sortSel.addEventListener('change', () => { state.sortBy = sortSel.value; draw(); });
    draw();
  };

  /** Trung bình theo nhóm + chênh lệch cho vay – huy động (ước tính biên lãi). */
  AFA.ui.rateSummary = function (data) {
    const avg = (list, f) => list.reduce((s, b) => s + f(b), 0) / (list.length || 1);
    const groups = [
      { label: 'State-owned', list: data.banks.filter(b => b.group === 'state') },
      { label: 'Private', list: data.banks.filter(b => b.group === 'private') },
      { label: 'Whole market', list: data.banks },
    ];
    const dep = b => b.deposit['12M'], lend = b => b.lending.business;
    const top = [...data.banks].sort((a, b) => dep(b) - dep(a))[0];
    const rows = groups.map(g => {
      const d = avg(g.list, dep), l = avg(g.list, lend);
      return `<tr><td>${esc(g.label)} <span class="muted small">(${g.list.length})</span></td>
        <td class="num">${pct(d)}</td><td class="num">${pct(l)}</td><td class="num accent">${U.fmtSigned(l - d, 2)}</td></tr>`;
    }).join('');
    return `<div class="table-wrap"><table class="qtable">
        <thead><tr><th>Group</th><th class="num">12M deposit</th><th class="num">Business loan</th><th class="num">Spread</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="pipeline-note">Spread = avg short-term business lending rate − avg 12M deposit rate (pp), a rough proxy for the interest margin.
        Highest 12M: <b>${esc(top.bank)} ${pct(dep(top))}%</b>.</p>`;
  };

  /** Cảnh báo: các điều chỉnh trong ALERT_DAYS ngày. */
  AFA.ui.rateAlerts = function (data) {
    const items = data.changes.filter(c => c.ageDays <= ALERT_DAYS).sort((a, b) => a.ageDays - b.ageDays);
    if (!items.length) return AFA.ui.emptyState(`No rate changes in the last ${ALERT_DAYS} days.`);
    return `<div class="alert-list">${items.map(c => {
      const d = c.to - c.from, dir = U.dir(d);
      return `<div class="alert-item ${dir}">
        <span class="alert-icon">${d > 0 ? '▲' : '▼'}</span>
        <span><b>${esc(c.bank)}</b> ${d > 0 ? 'raised' : 'cut'} its ${esc(keyLabel(data, c.kind, c.key).toLowerCase())} rate
          <small>${pct(c.from)}% → <b class="num">${pct(c.to)}%</b> · ${esc(U.timeAgo(c.date))}</small></span>
        <span class="pct-pill ${dir} num">${U.fmtSigned(d, 2)}</span>
      </div>`;
    }).join('')}</div>
    <p class="pipeline-note">Rate changes of ${AFA.config.dataMode === 'mock' ? '' : 'live banks are detected by the automation and '}trigger Email/Telegram alerts above your threshold — <a class="link" href="#/settings">Notification settings</a>.</p>`;
  };

  /** Lịch sử điều chỉnh lãi suất có lọc loại. */
  AFA.ui.rateHistory = function (el, data) {
    let kind = '';
    el.innerHTML = `<div class="chart-head"><div class="seg"><button data-k="">All</button><button data-k="deposit">Deposit</button><button data-k="lending">Lending</button></div></div><div class="rh-body"></div>`;
    const body = el.querySelector('.rh-body');
    function draw() {
      const rows = data.changes.filter(c => !kind || c.kind === kind).sort((a, b) => a.ageDays - b.ageDays);
      body.innerHTML = rows.length ? `<div class="table-wrap"><table class="qtable">
        <thead><tr><th>Date</th><th>Bank</th><th>Product</th><th class="num">Old</th><th class="num">New</th><th class="num">+/-</th></tr></thead>
        <tbody>${rows.map(c => {
          const d = c.to - c.from;
          return `<tr><td class="num muted">${esc(U.fmtDate(c.date))}</td><td><span class="q-sym">${esc(c.bankId)}</span><span class="q-name">${esc(c.bank)}</span></td>
            <td>${esc(keyLabel(data, c.kind, c.key))}</td><td class="num muted">${pct(c.from)}</td><td class="num">${pct(c.to)}</td>
            <td class="num"><span class="pct-pill ${U.dir(d)}">${U.fmtSigned(d, 2)}</span></td></tr>`;
        }).join('')}</tbody></table></div>` : AFA.ui.emptyState();
      el.querySelectorAll('[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === kind));
    }
    el.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { kind = b.dataset.k; draw(); } });
    draw();
  };

  /** Chương trình ưu đãi lãi suất đang áp dụng. */
  AFA.ui.ratePromos = function (data) {
    const items = [...data.promos].sort((a, b) => a.endsInDays - b.endsInDays);
    return `<div class="promo-grid">${items.map(p => `<div class="promo">
        <div class="promo-top"><span class="q-sym">${esc(p.bankId)}</span><span class="tag">${p.product === 'deposit' ? 'Deposit' : 'Lending'}</span>
          <span class="promo-rate num">${pct(p.rate)}%</span></div>
        <div class="promo-title">${esc(p.title)}</div>
        <small>${esc(p.condition)}</small>
        <small class="promo-end ${p.endsInDays <= 21 ? 'soon' : ''}">${p.endsInDays} days left · ends ${esc(U.fmtDate(p.endsAt))}</small>
      </div>`).join('')}</div>`;
  };

  /** Ghép toàn bộ khu vực lãi suất vào el. */
  AFA.ui.ratesSection = async function (el) {
    const data = await AFA.data.getBankRates();
    el.innerHTML = `
      <div class="section-title"><span class="kicker">Vietnamese commercial bank rates</span><span class="muted small">${data.banks.length} banks · updated ${esc(U.timeAgo(data.updatedAt))}</span></div>
      ${AFA.ui.policyRateCards(data.policy)}
      <div class="grid g-2-1">
        ${AFA.ui.panel({ title: 'Rate comparison & ranking', body: '<div id="rate-board"></div>' })}
        <div class="stack">
          ${AFA.ui.panel({ title: `Rate change alerts (${ALERT_DAYS} days)`, body: AFA.ui.rateAlerts(data) })}
          ${AFA.ui.panel({ title: 'Averages & spread', body: AFA.ui.rateSummary(data) })}
        </div>
      </div>
      ${AFA.ui.panel({ title: 'Promotional rate programmes', body: AFA.ui.ratePromos(data) })}
      ${AFA.ui.panel({ title: 'Rate change history', body: '<div id="rate-history"></div>' })}`;
    AFA.ui.rateBoard(el.querySelector('#rate-board'), data);
    AFA.ui.rateHistory(el.querySelector('#rate-history'), data);
  };

  // Đăng ký khu vực chức năng cho trang Phòng (registry: department.features)
  AFA.ui.features = AFA.ui.features || {};
  AFA.ui.features.bankRates = AFA.ui.ratesSection;
})();
