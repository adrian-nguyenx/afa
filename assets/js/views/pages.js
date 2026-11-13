/* Views: News Intelligence, Division, Department, Coming Soon, Not Found. */
window.AFA = window.AFA || {};
AFA.views = AFA.views || {};
AFA.ui = AFA.ui || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;

  /** Pipeline tác vụ + model được định tuyến (đọc từ AFA.config.ai). */
  const RUNTIME = {
    live: ['run-live', 'Live'],
    rules: ['run-rules', 'Live · rule-based for now'],
  };

  AFA.ui.aiPipeline = function (profile) {
    const ai = AFA.config.ai;
    const rt = ai.runtime || {};
    const steps = (ai.profiles[profile] || []).map(k => {
      const t = ai.tasks[k], m = ai.models[t.tier];
      const meta = [t.effort && `effort ${t.effort}`, t.batch && 'Batch API', t.maxTokens && `≤${t.maxTokens} tok`].filter(Boolean).join(' · ');
      const [cls, txt] = RUNTIME[rt[k]] || ['run-planned', 'Planned'];
      return `<li class="${cls}"><span>${esc(t.label)}${meta ? `<small>${esc(meta)}</small>` : ''}<em class="run-state">${esc(txt)}</em></span>
        <span class="model-chip model-${esc(t.tier)}" title="${esc(m.note)}">${esc(m.label)}</span></li>`;
    }).join('');
    return `<ul class="pipeline">${steps}</ul>
      <p class="pipeline-note">Phase 3 automation: collection, de-duplication, prices and alerts run as code (0 tokens);
        classification, scoring and digests are rule-based for now; the only LLM step is translating important
        international stories into Vietnamese with Claude Haiku (Batch API, daily cap). Planned steps keep their model routing.</p>`;
  };

  /** Desk automation status text from data/live/status.json (null in mock mode). */
  AFA.ui.deskAutomation = function (p, st) {
    if (!st || !st.jobs) return { cls: 'muted', text: 'Mock mode — no live data yet (run automation/run.py)' };
    const jobs = st.jobs;
    const d = (st.desks || {})[p.id];
    const parts = [];
    if (d) parts.push(`${d.last24h} ${d.last24h === 1 ? 'story' : 'stories'} in 24h`);
    if (p.symbols && jobs.market) parts.push(`prices ${U.timeAgo(jobs.market.lastRun)}`);
    if (p.features && p.features.includes('bankRates') && jobs.rates) parts.push(`rates ${U.timeAgo(jobs.rates.lastRun)}`);
    if (jobs.news) parts.push(`news run ${U.timeAgo(jobs.news.lastRun)}`);
    const intl = ['global-corporate', 'global-macro', 'us-equities', 'fx'].includes(p.id);
    if (!d && intl && st.translate && !st.translate.enabled) parts.push('international stories wait for translation (no API key)');
    return { cls: AFA.data.label === 'STALE' ? 'warn' : 'ok', text: `${AFA.data.label === 'STALE' ? 'Stale' : 'Active'} · ${parts.join(' · ')}` };
  };

  /** Agent card cho mỗi Phòng. stats: { count, latest } */
  AFA.ui.departmentCard = function (dept, stats = {}) {
    return `<a class="dept-card" href="#/${esc(dept.divisionId)}/${esc(dept.id)}">
      <div class="dept-top"><span class="agent-dot"></span><span class="agent-id">${esc(dept.agent.code)}</span><span class="agent-state">${AFA.data.label === 'MOCK DATA' ? 'MOCK FEED' : 'LIVE FEED'}</span></div>
      <h3>${esc(dept.name)}</h3>
      <div class="dept-en">${esc(dept.nameEn)}</div>
      <div class="agent-name has-avatar">${AFA.ui.agentAvatar(dept, 'sm')}<b>${esc(dept.agent.name.toUpperCase())}</b><small>${esc(dept.agent.title)}</small></div>
      <p>${esc(dept.description)}</p>
      ${AFA.ui.chips(dept.scope, 5)}
      <div class="dept-stats">
        <span><strong class="num">${stats.count || 0}</strong> stories</span>
        ${dept.symbols ? `<span><strong class="num">${dept.symbols.length}</strong> symbols</span>` : ''}
        <span>Updated: ${stats.latest ? esc(U.timeAgo(stats.latest)) : '—'}</span>
      </div>
    </a>`;
  };

  AFA.views.news = {
    async render(el) {
      el.innerHTML = `${AFA.ui.pageHeader({
        kicker: 'News Intelligence',
        title: 'News Center',
        subtitle: 'News classified by division, desk, country, sector, time and importance.',
        crumbs: [{ label: 'News Intelligence' }],
      })}<div class="panel"><div class="panel-body" id="explorer"></div></div>`;
      await AFA.ui.newsExplorer(el.querySelector('#explorer'), {});
    },
  };

  AFA.views.division = {
    async render(el, { division }) {
      const news = await AFA.data.getNews({ divisionId: division.id });
      const cards = division.departments.map(p => {
        const items = news.filter(n => n.departmentId === p.id);
        return AFA.ui.departmentCard(p, { count: items.length, latest: items[0] && items[0].publishedAt });
      }).join('');

      let marketBlock = '';
      if (division.id === 'market') {
        const tables = await Promise.all(division.departments.map(async p => {
          const qs = await AFA.data.getQuotes(p.symbols);
          return AFA.ui.panel({ title: p.name, body: AFA.ui.quoteTable(qs), action: `<a class="link" href="#/market/${esc(p.id)}">Details →</a>` });
        }));
        marketBlock = `${AFA.ui.panel({ title: 'Chart', body: '<div id="div-chart"></div>' })}<div class="grid g-2">${tables.join('')}</div>`;
      }

      el.innerHTML = `${AFA.ui.pageHeader({
        kicker: `Division ${division.code} · ${division.name}`,
        title: division.nameEn,
        subtitle: division.description,
        crumbs: [{ label: division.nameEn }],
      })}
      <div class="dept-grid">${cards}</div>
      ${marketBlock}
      ${AFA.ui.panel({ title: `News — ${division.nameEn}`, body: '<div id="explorer"></div>' })}`;

      if (division.id === 'market') {
        await AFA.ui.chartWidget(el.querySelector('#div-chart'), ['VNINDEX', 'SPX', 'USDVND', 'XAUUSD', 'BRENT'], 'VNINDEX');
      }
      await AFA.ui.newsExplorer(el.querySelector('#explorer'), { divisionId: division.id });
    },
  };

  AFA.views.department = {
    async render(el, { division, department: p }) {
      const quotes = p.symbols ? await AFA.data.getQuotes(p.symbols) : null;
      const feats = (p.features || []).filter(f => AFA.ui.features[f]);
      const steps = (AFA.config.ai.profiles[p.aiProfile] || []).length;
      const ag = p.agent;
      const auto = AFA.ui.deskAutomation(p, AFA.data.getStatus ? await AFA.data.getStatus() : null);
      // Agent Profile first (avatar + identity), with its own collapsible AI model routing section
      const profile = `<section class="panel agent-panel">
          <div class="panel-head">
            <h2>Agent profile</h2>
            <span class="agent-summary small">${AFA.ui.agentAvatar(p, 'xs')}<b>${esc(ag.name)}</b> <span class="num muted">${esc(ag.code)}</span> · <span class="status-dot"></span> Active</span>
            <button class="btn-ghost agent-toggle" data-action="toggle-agent" type="button" aria-expanded="false"></button>
          </div>
          <div class="panel-body agent-body">
            <div class="agent-profile">
              <figure class="avatar-frame" style="--c:${esc(division.color)}">${AFA.ui.agentAvatar(p, 'lg')}</figure>
              <div class="agent-main">
                <div class="agent-hero-name">${esc(ag.name.toUpperCase())}</div>
                <div class="agent-ids"><code>${esc(p.agentId)}</code><span class="num">${esc(ag.code)}</span></div>
                <div class="agent-role">${esc(ag.title)}</div>
                <div class="agent-status"><span class="status-dot"></span> Status: <b>Active</b> <span class="muted">· running on ${esc(AFA.data.label)}</span></div>
                <dl class="agent-info">
                  ${ag.alias ? `<div><dt>Alias</dt><dd>${esc(ag.alias)}</dd></div>` : ''}
                  <div><dt>Division</dt><dd>${esc(division.nameEn)}</dd></div>
                  <div><dt>Desk</dt><dd>${esc(p.name)}</dd></div>
                  <div><dt>Persona</dt><dd class="muted">${esc(ag.persona)}</dd></div>
                  <div><dt>Coverage</dt><dd>${esc(AFA.registry.countryLabel(p.country))}</dd></div>
                  <div><dt>Automation</dt><dd class="auto-${esc(auto.cls)}">${esc(auto.text)} · <a class="link" href="#/settings">Notifications</a></dd></div>
                </dl>
              </div>
            </div>
            <div class="routing">
              <div class="routing-head"><span class="kicker">AI model routing</span><span class="muted small">${steps} steps</span>
                <button class="btn-ghost routing-toggle" data-action="toggle-routing" type="button" aria-expanded="false"></button></div>
              <div class="routing-body">${AFA.ui.aiPipeline(p.aiProfile)}</div>
            </div>
          </div>
        </section>`;

      el.innerHTML = `${AFA.ui.pageHeader({
        kicker: `${division.nameEn} · ${p.nameEn}`,
        title: p.name,
        subtitle: p.description,
        crumbs: [{ label: division.nameEn, href: `#/${division.id}` }, { label: p.name }],
      })}
      ${profile}
      ${AFA.ui.panel({ title: 'Coverage', body: AFA.ui.chips(p.scope) })}
      ${feats.map(f => `<div class="rates-section" data-feature="${esc(f)}"></div>`).join('')}
      ${quotes ? `<div class="grid g-2-1">
        ${AFA.ui.panel({ title: p.chartTitle || 'Chart', body: '<div id="dept-chart"></div>' })}
        ${AFA.ui.panel({ title: p.tableTitle || 'Prices', body: AFA.ui.quoteTable(quotes, { volume: true }) })}
      </div>` : ''}
      ${AFA.ui.panel({ title: 'News', body: '<div id="explorer"></div>' })}`;

      for (const f of feats) await AFA.ui.features[f](el.querySelector(`[data-feature="${f}"]`));
      if (quotes) await AFA.ui.chartWidget(el.querySelector('#dept-chart'), p.chartSymbols || p.symbols.slice(0, 4));
      await AFA.ui.newsExplorer(el.querySelector('#explorer'), { departmentId: p.id });
    },
  };

  AFA.views.comingSoon = {
    async render(el, { division }) {
      el.innerHTML = `${AFA.ui.pageHeader({
        kicker: `Division ${division.code} · ${division.name}`,
        title: division.nameEn,
        crumbs: [{ label: division.nameEn }],
      })}
      <section class="soon-hero">
        <div class="soon-badge">COMING SOON · FUTURE DEVELOPMENT</div>
        <h2>The Investment division is on the roadmap</h2>
        <p>${esc(division.description)} Planned for Phase ${division.plannedPhase}. It will be a paper-trading simulation — no real-money trading.</p>
        <div class="soon-grid">${division.departments.map(p => `<div class="soon-item">
          <div class="soon-name">${esc(p.name)}</div><div class="dept-en">${esc(p.nameEn)}</div><p>${esc(p.description)}</p></div>`).join('')}
        </div>
      </section>`;
    },
  };

  AFA.views.notFound = {
    async render(el) {
      el.innerHTML = `${AFA.ui.pageHeader({ title: 'Page not found', subtitle: 'This link does not exist.' })}<a class="link" href="#/">← Back to Dashboard</a>`;
    },
  };
})();
