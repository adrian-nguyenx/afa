/* Bootstrap: chọn data provider, dựng shell, routing, đồng hồ, theme. */
(function () {
  const AFA = window.AFA;
  const U = AFA.utils;

  // 'auto' → live provider when its JSON is reachable, otherwise mock (decided in boot()).
  const mode = AFA.config.dataMode === 'auto' ? 'api' : AFA.config.dataMode;
  AFA.data = AFA.providers[mode];
  if (!AFA.data) throw new Error('Data provider not found: ' + AFA.config.dataMode);

  const root = document.getElementById('app');

  // Agent details panel: hidden by default, preference remembered per browser
  function setAgentOpen(open) {
    document.documentElement.classList.toggle('agent-open', open);
    document.querySelectorAll('.agent-toggle').forEach(b => b.setAttribute('aria-expanded', String(open)));
    U.storage.set('afa-agent-open', open ? '1' : '0');
  }
  document.documentElement.classList.toggle('agent-open', U.storage.get('afa-agent-open') === '1');
  // AI model routing section inside the Agent Profile: hidden by default, remembered separately
  function setRoutingOpen(open) {
    document.documentElement.classList.toggle('routing-open', open);
    document.querySelectorAll('.routing-toggle').forEach(b => b.setAttribute('aria-expanded', String(open)));
    U.storage.set('afa-routing-open', open ? '1' : '0');
  }
  document.documentElement.classList.toggle('routing-open', U.storage.get('afa-routing-open') === '1');

  // Clocks
  const fmts = AFA.config.clocks.map(c => ({
    label: c.label,
    f: new Intl.DateTimeFormat('en-GB', { timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  }));
  function tickClocks() {
    const el = document.getElementById('clocks');
    if (!el) return;
    const now = new Date();
    el.innerHTML = fmts.map(c => `<span><small>${c.label}</small> <b class="num">${c.f.format(now)}</b></span>`).join('');
  }

  // Routing — mỗi lần chuyển trang render vào container mới; container cũ bị tách khỏi DOM nên
  // các tác vụ async còn dang dở của trang cũ không ghi đè trang mới.
  async function route() {
    const r = AFA.router.resolve(location.hash);
    const main = document.getElementById('main');
    const view = document.createElement('div');
    view.className = 'view';
    view.innerHTML = '<div class="loading">Loading data…</div>';
    main.replaceChildren(view);
    AFA.ui.setActiveNav(r.path);
    document.body.classList.remove('nav-open');
    document.title = `${r.title} · ${AFA.config.appName}`;
    window.scrollTo(0, 0);
    try {
      await r.view.render(view, r.params);
      view.querySelectorAll('.agent-toggle').forEach(b => b.setAttribute('aria-expanded', String(document.documentElement.classList.contains('agent-open'))));
    } catch (err) {
      console.error(err);
      view.innerHTML = AFA.ui.emptyState('Failed to load data: ' + err.message);
    }
    AFA.events.emit('route:change', r);
  }

  async function pickProvider() {
    if (!AFA.data.init) return;
    const ok = await AFA.data.init();
    if (!ok && AFA.config.dataMode === 'auto') AFA.data = AFA.providers.mock;
  }

  function renderBadge() {
    const el = document.querySelector('.data-mode');
    if (!el) return;
    const label = AFA.data.label;
    el.className = 'data-mode' + (label === 'LIVE' ? ' live' : label === 'STALE' ? ' stale' : '');
    el.textContent = '● ' + label;
    const st = AFA.data.status;
    el.title = st && st.generatedAt
      ? `Live data from the automation · updated ${U.timeAgo(st.generatedAt)}. Symbols, banks or desks without a live source use mock data.`
      : 'Mock data (illustrative). Run automation/run.py to generate live data.';
  }

  async function refreshTicker() {
    const tq = await AFA.data.getQuotes(AFA.config.tickerSymbols);
    document.getElementById('ticker').innerHTML = AFA.ui.ticker(tq);
  }

  async function boot() {
    await pickProvider();
    root.innerHTML = `${AFA.ui.topbar()}
      <div id="ticker"></div>
      <div class="shell">${AFA.ui.sidebar()}<main id="main" class="main" tabindex="-1"></main></div>
      <div class="scrim" data-action="toggle-nav"></div>`;

    document.addEventListener('click', e => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      if (a.dataset.action === 'toggle-nav') document.body.classList.toggle('nav-open');
      if (a.dataset.action === 'toggle-agent') setAgentOpen(!document.documentElement.classList.contains('agent-open'));
      if (a.dataset.action === 'toggle-routing') setRoutingOpen(!document.documentElement.classList.contains('routing-open'));
    });

    tickClocks();
    setInterval(tickClocks, 1000);

    renderBadge();
    await refreshTicker();
    // Polling refresh of live data (no-op for mock): ticker + badge; pages listen to 'data:refresh' if needed
    AFA.data.subscribe('live', async () => { renderBadge(); await refreshTicker(); });

    window.addEventListener('hashchange', route);
    await route();
  }

  boot();
})();
