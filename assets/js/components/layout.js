/* Layout components: TopBar, TickerTape, Sidebar/NavTree, Breadcrumb, PageHeader, Panel, EmptyState. */
window.AFA = window.AFA || {};
AFA.ui = AFA.ui || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;

  AFA.ui.topbar = function () {
    const mode = (AFA.data && AFA.data.label) || 'MOCK DATA';
    return `
    <header class="topbar">
      <button class="icon-btn menu-btn" data-action="toggle-nav" aria-label="Open menu">☰</button>
      <a class="brand" href="#/">
        <img class="brand-mark brand-logo" src="assets/img/logo.svg" alt="" width="38" height="38" />
        <span class="brand-text"><strong>${esc(AFA.config.appName)}</strong><small>${esc(AFA.config.tagline)}</small></span>
      </a>
      <div class="topbar-right">
        <div class="clocks" id="clocks"></div>
        <a class="top-link" href="#/settings" data-top="settings" title="Notifications: Email & Telegram digests and alerts" aria-label="Notifications">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-1.7 1.7A1 1 0 0 0 4 19.4h16a1 1 0 0 0 .7-1.7Z"/></svg>
          <span>Notifications</span></a>
        <span class="data-mode ${mode === 'LIVE' ? 'live' : ''}" title="${esc(AFA.config.disclaimer)}">● ${esc(mode)}</span>
      </div>
    </header>`;
  };

  AFA.ui.ticker = function (quotes) {
    const item = q => `<a class="tick" href="${esc(AFA.registry.deptHref(q.departmentId))}">
      <span class="tick-sym">${esc(q.name)}</span>
      <span class="num">${U.fmtNum(q.price, q.dp)}</span>
      <span class="num ${U.dir(q.changePct)}">${U.arrow(q.changePct)} ${U.fmtPct(q.changePct)}</span></a>`;
    const row = quotes.map(item).join('');
    return `<div class="ticker" aria-label="Price ticker"><div class="ticker-track">${row}${row}</div></div>`;
  };

  AFA.ui.sidebar = function () {
    const R = AFA.registry;
    const groups = R.divisions.map(d => {
      if (d.status !== 'active') {
        return `<div class="nav-group">
          <a class="nav-div soon" href="#/${esc(d.id)}" data-path="${esc(d.id)}">
            <span class="nav-code">${esc(d.code)}</span>
            <span class="nav-label">${esc(d.nameEn)}<small>${esc(d.name)}</small></span>
            <span class="badge-soon">Soon</span>
          </a></div>`;
      }
      const depts = d.departments.map(p => `
        <a class="nav-dept" href="#/${esc(d.id)}/${esc(p.id)}" data-path="${esc(d.id)}/${esc(p.id)}">
          <span class="agent-dot" title="Agent: ${esc(p.agent ? `${p.agent.name} · ${p.agent.code}` : p.agentId)}"></span>${esc(p.name.replace(/^Phòng /, ''))}
        </a>`).join('');
      return `<div class="nav-group">
        <a class="nav-div" href="#/${esc(d.id)}" data-path="${esc(d.id)}">
          <span class="nav-code">${esc(d.code)}</span>
          <span class="nav-label">${esc(d.nameEn)}<small>${esc(d.name)}</small></span>
        </a>${depts}</div>`;
    }).join('');

    return `
    <nav class="sidebar" id="sidebar" aria-label="Main navigation">
      <div class="nav-group">
        <a class="nav-top" href="#/" data-path="">▦ Dashboard</a>
        <a class="nav-top" href="#/news" data-path="news">☰ News Intelligence</a>
        <a class="nav-top nav-3d" href="#/3d" data-path="3d">◈ 3D Intelligence Center</a>
      </div>
      <div class="nav-title">Divisions</div>
      ${groups}
      <div class="sidebar-foot">v${esc(AFA.config.version)} · Phase ${AFA.config.phase}<small class="disclaimer">${esc(AFA.config.disclaimer)}</small></div>
    </nav>`;
  };

  AFA.ui.setActiveNav = function (path) {
    document.querySelectorAll('.sidebar a[data-path]').forEach(a => {
      const p = a.dataset.path;
      a.classList.toggle('active', p === path);
      a.classList.toggle('in-path', p !== '' && p !== path && path.startsWith(p + '/'));
    });
    document.querySelectorAll('.topbar [data-top]').forEach(a => a.classList.toggle('active', a.dataset.top === path));
  };

  AFA.ui.breadcrumb = function (items) {
    const all = [{ label: 'Adrian Financial Agents', href: '#/' }, ...items];
    return `<nav class="crumbs" aria-label="Breadcrumb">${all.map((it, i) =>
      i === all.length - 1 || !it.href
        ? `<span>${esc(it.label)}</span>`
        : `<a href="${esc(it.href)}">${esc(it.label)}</a>`).join('<i>/</i>')}</nav>`;
  };

  AFA.ui.pageHeader = function ({ kicker, title, subtitle, crumbs, aside }) {
    return `<header class="page-head">
      ${crumbs ? AFA.ui.breadcrumb(crumbs) : ''}
      <div class="page-head-row">
        <div>
          ${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}
          <h1>${esc(title)}</h1>
          ${subtitle ? `<p class="subtitle">${esc(subtitle)}</p>` : ''}
        </div>
        ${aside || ''}
      </div>
    </header>`;
  };

  /** body là HTML đã escape sẵn. */
  AFA.ui.panel = function ({ title, body, action, id, cls }) {
    return `<section class="panel ${cls || ''}" ${id ? `id="${esc(id)}"` : ''}>
      ${title ? `<div class="panel-head"><h2>${esc(title)}</h2>${action || ''}</div>` : ''}
      <div class="panel-body">${body || ''}</div>
    </section>`;
  };

  AFA.ui.emptyState = msg => `<div class="empty">${esc(msg || 'No matching data.')}</div>`;

  AFA.ui.chips = (list, max) => {
    const shown = max ? list.slice(0, max) : list;
    const more = max && list.length > max ? `<span class="chip chip-more">+${list.length - max}</span>` : '';
    return `<div class="chips">${shown.map(s => `<span class="chip">${esc(s)}</span>`).join('')}${more}</div>`;
  };
})();
