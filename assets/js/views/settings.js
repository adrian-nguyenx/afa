/* Notifications & Automation settings (#/settings).
 *
 * The site is static, so it cannot write to the repo. Preferences are edited here, kept as a draft in this browser,
 * and exported as notify-config.json, which replaces automation/notify-config.json in the repo. The automation reads
 * it on its next run. Some settings can also be changed from Telegram (they override the file).
 * No personal data (email address, chat id, tokens) belongs in this file: those are secrets set in .env / GitHub Secrets.
 *
 * Layout: overview tiles → sticky save bar → section nav (left) + numbered sections (right):
 *   1 Channels · 2 Digests · 3 Instant alerts · 4 Thresholds · 5 Coverage · 6 Data collection · 7 System status · 8 Help
 */
window.AFA = window.AFA || {};
AFA.views = AFA.views || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;
  const DRAFT_KEY = 'afa-notify-draft';
  const IMP = [[1, 'All stories (low and above)'], [2, 'Medium and high'], [3, 'High only']];
  const EVERY = [[15, 'Every 15 minutes'], [30, 'Every 30 minutes'], [60, 'Every hour']];
  const STYLES = [['cinematic', 'V2 · Cinematic Spider-Verse'], ['refined', 'Current · refined'],
    ['terminal', 'V1 · Futuristic terminal'], ['institutional', 'V3 · Institutional']];

  const DEFAULTS = {
    version: 1, timezone: 'Asia/Ho_Chi_Minh', utcOffsetMinutes: 420,
    schedule: { newsEveryMin: 30, marketEveryMin: 15, marketHoursOnly: true, ratesTimes: ['08:30', '14:30'] },
    channels: {
      email: { enabled: true, digest: true, instant: true, minImportance: 1 },
      telegram: { enabled: true, digest: true, instant: true, minImportance: 2 },
    },
    digest: { times: ['07:00', '17:00', '22:00'], style: 'cinematic', maxItemsPerDesk: 5, lookbackHours: 14, includeMarkets: true, includeRates: true },
    instant: { enabled: true, minImportance: 3, maxPerRun: 5, news: true, prices: true, rates: true },
    quietHours: { enabled: true, start: '22:30', end: '06:30' },
    filters: { divisions: ['corporate', 'macro', 'market', 'banking'], departments: [], categories: [] },
    thresholds: { defaultPricePct: 0, prices: { VNINDEX: 1.5, VN30: 1.5, SPX: 1.5, IXIC: 2, DJI: 1.5, USDVND: 0.3, DXY: 0.8, XAUUSD: 1.5, BRENT: 3, WTI: 3 }, rateBps: 20 },
  };
  const CATEGORIES = ['Earnings', 'M&A', 'Dividend', 'Leadership Change', 'Deposit Rates', 'Lending Rates', 'Interbank Rates',
    'Interest Rates', 'Credit Growth', 'Asset Quality', 'FED', 'ECB', 'BOJ', 'CPI', 'GDP', 'Trade', 'Government',
    'Foreign Flows', 'Gold', 'Oil', 'Exchange Rate', 'Market Moves', 'Investment', 'IPO / Listing', 'Corporate Event',
    'Economic Policy', 'Commodities', 'Banking'];
  const SECTIONS = [
    ['channels', 'Channels'], ['digest', 'Digests'], ['instant', 'Instant alerts'], ['thresholds', 'Thresholds'],
    ['coverage', 'Coverage'], ['collection', 'Data collection'], ['status', 'System status'], ['help', 'How it works'],
  ];
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  const clone = o => JSON.parse(JSON.stringify(o));
  function set(o, path, v) {
    const ks = path.split('.');
    const last = ks.pop();
    ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v;
  }

  async function loadRepoConfig() {
    try {
      const r = await fetch(AFA.config.notifyConfigUrl, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return { cfg: await r.json(), from: 'repo' };
    } catch (e) {
      return { cfg: clone(DEFAULTS), from: 'defaults' };
    }
  }

  function readDraft() {
    try { return JSON.parse(U.storage.get(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  }

  /** Vietnam-time "HH:MM" of now and the next slot in a list of times. */
  function nextSlot(times, offsetMin = 420) {
    const now = new Date(Date.now() + offsetMin * 6e4);
    const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
    const mins = (times || []).filter(t => TIME_RE.test(t)).map(t => +t.slice(0, 2) * 60 + +t.slice(3)).sort((a, b) => a - b);
    if (!mins.length) return null;
    const n = mins.find(m => m > cur);
    const m = n != null ? n : mins[0];
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}${n != null ? ' today' : ' tomorrow'}`;
  }

  // ---------- controls ----------

  const sw = (path, label, v, hint) => `<label class="set-sw"><input type="checkbox" data-path="${path}" data-type="bool" ${v ? 'checked' : ''}>
    <span class="set-sw-ui" aria-hidden="true"></span><span class="set-sw-txt"><b>${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span></label>`;
  const sel = (path, opts, v, type = 'int') => `<select data-path="${path}" data-type="${type}">${opts.map(([val, lab]) =>
    `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
  const num = (path, v, step = 1, min = 0, unit = '') => `<span class="set-num"><input type="number" data-path="${path}" data-type="float" value="${esc(v)}" step="${step}" min="${min}">${unit ? `<i>${esc(unit)}</i>` : ''}</span>`;
  const time = (path, v) => `<input type="time" data-path="${path}" data-type="time" value="${esc(v)}">`;
  const times = (path, v) => `<input type="text" data-path="${path}" data-type="times" value="${esc((v || []).join(', '))}" placeholder="07:00, 17:00, 22:00">`;
  const fld = (label, ctl, hint) => `<div class="set-fld"><label>${esc(label)}</label>${ctl}${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  const section = (id, n, title, desc, body) => `<section class="set-sec panel" id="set-${id}">
      <header class="set-sec-head"><span class="set-n">${n}</span><div><h2>${esc(title)}</h2><p>${esc(desc)}</p></div></header>
      <div class="set-sec-body">${body}</div></section>`;

  function channelCard(id, label, icon, c, st) {
    const ch = (st && st.channels && st.channels[id]) || {};
    const conn = ch.configured
      ? `<span class="set-badge ok">● Connected</span>`
      : `<span class="set-badge off">○ Secrets missing</span>`;
    const last = ch.lastSent ? `Last sent ${U.timeAgo(ch.lastSent)}` : 'Nothing sent yet';
    return `<div class="set-chan">
      <div class="set-chan-head"><span class="set-chan-ic">${icon}</span><div><b>${esc(label)}</b><small>${esc(last)}</small></div>${conn}</div>
      ${sw(`channels.${id}.enabled`, 'Channel on', c.enabled, 'Master switch for this channel')}
      ${sw(`channels.${id}.digest`, 'Scheduled digests', c.digest, 'Receive the digests at the times in section 2')}
      ${sw(`channels.${id}.instant`, 'Instant alerts', c.instant, 'Receive the alerts defined in section 3')}
      ${fld('Stories included', sel(`channels.${id}.minImportance`, IMP, c.minImportance), 'Lowest importance this channel receives')}
    </div>`;
  }

  function coverage(c) {
    const f = c.filters || {};
    const allDeps = !f.departments || !f.departments.length;
    return AFA.registry.divisions.filter(d => d.status === 'active').map(d => {
      const divOn = !f.divisions || !f.divisions.length || f.divisions.includes(d.id);
      return `<fieldset class="set-div" data-div="${esc(d.id)}" style="--c:${esc(d.color)}"><legend>
          <label class="chk"><input type="checkbox" data-divall="${esc(d.id)}"> ${esc(d.nameEn)}</label></legend>
        ${d.departments.map(p => `<label class="chk"><input type="checkbox" data-dep="${esc(p.id)}" data-depdiv="${esc(d.id)}"
          ${divOn && (allDeps || f.departments.includes(p.id)) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}
      </fieldset>`;
    }).join('');
  }

  function form(c, quotes, st) {
    const th = c.thresholds || {};
    const syms = [...new Set([...Object.keys(th.prices || {}), ...AFA.config.tickerSymbols])];
    const rows = syms.map(s => {
      const q = quotes.find(x => x.symbol === s);
      const v = (th.prices || {})[s];
      return `<tr><td><span class="q-sym">${esc(s)}</span><span class="q-name">${esc(q ? q.name : '')}</span></td>
        <td class="num">${q ? `<span class="${U.dir(q.changePct)}">${U.fmtPct(q.changePct)}</span>` : '—'}</td>
        <td class="num"><input type="number" class="th-in" data-th="${esc(s)}" value="${v != null ? esc(v) : ''}" step="0.1" min="0" placeholder="off"></td></tr>`;
    }).join('');
    const cats = (c.filters && c.filters.categories) || [];

    return [
      section('channels', 1, 'Channels', 'Where messages go. Addresses, bot token and chat id are secrets in .env (local) or GitHub Secrets, never on this page.',
        `<div class="set-chans">${channelCard('email', 'Email · Gmail', '✉', c.channels.email, st)}${channelCard('telegram', 'Telegram', '➤', c.channels.telegram, st)}</div>`),

      section('digest', 2, 'Digests', 'Scheduled summaries of the stories collected since the previous digest, grouped by division.',
        `<div class="set-grid">
          ${fld('Send at (Vietnam time)', times('digest.times', c.digest.times), 'HH:MM, comma-separated, e.g. 07:00, 17:00, 22:00')}
          ${fld('Look-back window', num('digest.lookbackHours', c.digest.lookbackHours, 1, 1, 'hours'), 'Scheduled digests cover the news since the previous slot; this window is for on-demand digests (/digest)')}
          ${fld('Stories per desk', num('digest.maxItemsPerDesk', c.digest.maxItemsPerDesk, 1, 1, 'max'), 'Most important first; email shows up to 3')}
          ${fld('Email design', sel('digest.style', STYLES, c.digest.style || 'cinematic', 'str'), 'Telegram always uses the Brief Card format')}
        </div>
        <div class="set-sws">${sw('digest.includeMarkets', 'Market snapshot', c.digest.includeMarkets, 'Indices, FX, gold, oil at the top')}
        ${sw('digest.includeRates', 'Deposit rates', c.digest.includeRates, 'Live bank rates and changes in the Banking part')}</div>`),

      section('instant', 3, 'Instant alerts', 'Sent as soon as the automation detects them (checked every 15 minutes), outside quiet hours.',
        `<div class="set-sws">${sw('instant.enabled', 'Instant alerts on', c.instant.enabled, 'Master switch for all alert types below')}</div>
        <div class="set-sub">Alert types</div>
        <div class="set-sws">${sw('instant.news', 'Breaking news', c.instant.news, 'Stories at or above the importance below')}
        ${sw('instant.prices', 'Price moves', c.instant.prices, 'Daily move beyond a threshold (section 4)')}
        ${sw('instant.rates', 'Bank rate changes', c.instant.rates, 'Deposit-rate changes beyond the bps threshold')}</div>
        <div class="set-grid">
          ${fld('News importance for alerts', sel('instant.minImportance', IMP, c.instant.minImportance), 'High only keeps alerts rare')}
          ${fld('Max stories per alert', num('instant.maxPerRun', c.instant.maxPerRun, 1, 1, 'stories'), 'Caps one alert burst')}
        </div>
        <div class="set-sub">Quiet hours</div>
        <div class="set-quiet">${sw('quietHours.enabled', 'Hold alerts at night', c.quietHours.enabled, 'Instant alerts only: scheduled digests are always sent')}
          <span class="set-range">${time('quietHours.start', c.quietHours.start)}<i>→</i>${time('quietHours.end', c.quietHours.end)}</span></div>`),

      section('thresholds', 4, 'Thresholds', 'When a price move or a rate change is big enough to trigger an instant alert.',
        `<div class="set-grid">
          ${fld('Deposit-rate change', num('thresholds.rateBps', th.rateBps, 5, 1, 'bps'), '20 bps = 0.20 percentage points')}
          ${fld('Default price move', num('thresholds.defaultPricePct', th.defaultPricePct, 0.1, 0, '%'), '0 = only the symbols set below')}
        </div>
        <div class="table-wrap"><table class="qtable th-table">
          <thead><tr><th>Symbol</th><th class="num">Today</th><th class="num">Alert at ±%</th></tr></thead><tbody>${rows}</tbody></table></div>
        <p class="set-note">Leave a symbol empty to switch its alert off. An alert repeats only if the move grows by another step (e.g. 1.5% → 3%).</p>`),

      section('coverage', 5, 'Coverage', 'Which desks and topics reach you. Applies to digests and alerts on every channel.',
        `<div class="set-sub">Divisions & desks</div><div class="set-divs">${coverage(c)}</div>
        <div class="set-sub">Categories <small>none selected = all categories</small></div>
        <div class="set-cats">${CATEGORIES.map(k => `<label class="set-chip"><input type="checkbox" data-cat="${esc(k)}" ${cats.includes(k) ? 'checked' : ''}><span>${esc(k)}</span></label>`).join('')}</div>
        <p class="set-note">Investment Intelligence joins the automation once it is built (Phase 5).</p>`),

      section('collection', 6, 'Data collection', 'How often the automation fetches data. Advanced: the defaults suit most use.',
        `<div class="set-grid">
          ${fld('News feeds', sel('schedule.newsEveryMin', EVERY, c.schedule.newsEveryMin), 'RSS sources in automation/sources.json')}
          ${fld('Prices & FX', sel('schedule.marketEveryMin', EVERY, c.schedule.marketEveryMin), 'Delayed quotes, VN + US + FX + commodities')}
          ${fld('Bank-rate checks', times('schedule.ratesTimes', c.schedule.ratesTimes), 'Vietnam time, comma-separated')}
        </div>
        <div class="set-sws">${sw('schedule.marketHoursOnly', 'Prices only in trading hours', c.schedule.marketHoursOnly, 'Plus one refresh every 3 hours outside them')}</div>`),
    ].join('');
  }

  function readForm(root, base) {
    const c = clone(base);
    const errors = [];
    root.querySelectorAll('[data-path]').forEach(inp => {
      const p = inp.dataset.path, t = inp.dataset.type;
      let v;
      if (t === 'bool') v = inp.checked;
      else if (t === 'int') v = parseInt(inp.value, 10);
      else if (t === 'float') v = inp.value === '' ? 0 : Number(inp.value);
      else if (t === 'time') { v = inp.value; if (!TIME_RE.test(v)) errors.push(`${p}: invalid time`); }
      else if (t === 'times') {
        v = inp.value.split(',').map(x => x.trim()).filter(Boolean);
        if (v.some(x => !TIME_RE.test(x))) errors.push(`${p}: use HH:MM, comma-separated`);
      } else v = inp.value;
      set(c, p, v);
    });
    const deps = [...root.querySelectorAll('[data-dep]')];
    const on = deps.filter(i => i.checked);
    c.filters.divisions = [...new Set(on.map(i => i.dataset.depdiv))];
    c.filters.departments = on.length === deps.length ? [] : on.map(i => i.dataset.dep);
    c.filters.categories = [...root.querySelectorAll('[data-cat]:checked')].map(i => i.dataset.cat);
    c.thresholds.prices = {};
    root.querySelectorAll('[data-th]').forEach(i => { if (i.value !== '' && Number(i.value) > 0) c.thresholds.prices[i.dataset.th] = Number(i.value); });
    if (!on.length) errors.push('Select at least one desk');
    return { cfg: c, errors };
  }

  function syncDivBoxes(root) {
    root.querySelectorAll('[data-divall]').forEach(box => {
      const deps = [...root.querySelectorAll(`[data-depdiv="${box.dataset.divall}"]`)];
      const n = deps.filter(d => d.checked).length;
      box.checked = n === deps.length;
      box.indeterminate = n > 0 && n < deps.length;
    });
  }

  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- overview + status ----------

  function overview(c, st) {
    const ch = (st && st.channels) || {};
    const tile = (label, value, sub, cls = '') => `<div class="set-tile ${cls}"><span>${esc(label)}</span><b>${value}</b><small>${esc(sub)}</small></div>`;
    const chan = id => {
      const on = c.channels[id] && c.channels[id].enabled;
      const ok = ch[id] && ch[id].configured;
      return !on ? ['Off', 'Switched off in section 1', 'off'] : ok ? ['Connected', ch[id].lastSent ? `Last sent ${U.timeAgo(ch[id].lastSent)}` : 'Ready', 'ok'] : ['Not set up', 'Secrets missing in .env', 'warn'];
    };
    const [eV, eS, eC] = chan('email');
    const [tV, tS, tC] = chan('telegram');
    const next = nextSlot(c.digest.times, c.utcOffsetMinutes || 420);
    const q = c.quietHours || {};
    const alerts = c.instant && c.instant.enabled;
    return `<div class="set-tiles">
      ${tile('Email', eV, eS, eC)}${tile('Telegram', tV, tS, tC)}
      ${tile('Next digest', next ? esc(next.split(' ')[0]) : '—', next ? next.split(' ')[1] + ' · Vietnam time' : 'No digest time set', next ? 'ok' : 'warn')}
      ${tile('Instant alerts', alerts ? 'On' : 'Off', alerts && q.enabled ? `Quiet ${q.start}–${q.end}` : alerts ? 'No quiet hours' : 'Section 3', alerts ? 'ok' : 'off')}
    </div>`;
  }

  function statusPanel(st) {
    if (!st || !st.jobs) {
      return AFA.ui.emptyState('No live data yet — the site runs on mock data. Run "python automation/run.py --job all" to generate it.');
    }
    const ago = s => (s ? U.timeAgo(s) : '—');
    const JOB = { news: 'News collection', market: 'Prices & FX', rates: 'Bank rates', translate: 'Translation', alerts: 'Instant alerts', digest: 'Digest', telegram: 'Telegram commands' };
    const jobs = Object.entries(st.jobs).map(([k, j]) => {
      const detail = k === 'news' ? `${j.newItems} new · ${j.stored} stored`
        : k === 'market' ? `${(j.live || []).length} live symbols${(j.errors || []).length ? ` · ${j.errors.length} errors` : ''}`
        : k === 'rates' ? `${(j.banks || []).join(', ') || 'none'} · ${j.newChanges} changes`
        : k === 'alerts' ? `${j.candidates} candidates${j.skipped ? ` · ${j.skipped}` : ''}`
        : k === 'telegram' ? (j.ok === false ? esc(j.error || 'error') : `${j.commands || 0} commands read`)
        : k === 'digest' ? esc(j.slot || '') : '';
      return `<tr><td>${esc(JOB[k] || k)}</td><td class="num muted">${ago(j.lastRun)}</td><td class="small">${j.ok === false ? '<span class="down">failed</span> ' : ''}${detail}</td></tr>`;
    }).join('');
    const srcs = Object.entries(st.sources || {}).map(([id, s]) => `<tr><td>${esc(s.name)} <small class="muted">${esc(id)}</small></td>
      <td>${s.ok === true ? '<span class="up">OK</span>' : s.ok === false ? '<span class="down">Error</span>' : '<span class="muted">Off</span>'}</td>
      <td class="muted small">${s.ok ? `${s.items} items · ${s.new} new` : esc(s.error || s.note || '')}</td></tr>`).join('');
    const t = st.translate || {};
    return `<div class="grid g-2">
      <div><div class="set-sub">Jobs <small>updated ${ago(st.generatedAt)}</small></div><div class="table-wrap"><table class="qtable"><tbody>${jobs}</tbody></table></div>
        <div class="set-sub">Translation of international news</div>
        <p class="small">${t.enabled ? `On · ${t.today}/${t.dailyCap} today · $${Number(t.monthCostUsd || 0).toFixed(4)} of $${t.monthlyBudgetUsd} this month${t.pending ? ' · batch pending' : ''}`
          : `<span class="muted">Off — ${esc(t.reason || 'not run yet')}</span>`}</p></div>
      <div><div class="set-sub">News sources</div><div class="table-wrap"><table class="qtable"><tbody>${srcs}</tbody></table></div></div>
    </div>`;
  }

  const TG_HELP = [
    ['/status', 'Automation status'], ['/latest', 'Latest high-importance stories'], ['/digest', 'Digest now'],
    ['/mute 2h', 'Pause instant alerts (m/h/d)'], ['/unmute', 'Resume alerts'],
    ['/threshold VNINDEX 1.5', 'Price alert at ±1.5% (0 = off)'], ['/importance 3', 'Min importance for Telegram'], ['/desks', 'Stories per desk (24h)'],
  ];

  // ---------- view ----------

  AFA.views.settings = {
    async render(el) {
      const [{ cfg: repoCfg, from }, st, quotes] = await Promise.all([
        loadRepoConfig(),
        AFA.data.getStatus ? AFA.data.getStatus() : null,
        AFA.data.getQuotes([...new Set([...AFA.config.tickerSymbols, ...Object.keys(DEFAULTS.thresholds.prices)])]),
      ]);
      let cfg = readDraft() || repoCfg;

      el.innerHTML = `${AFA.ui.pageHeader({
        kicker: 'Automation & Intelligence Distribution',
        title: 'Notifications',
        subtitle: 'Choose where intelligence is delivered, when, what it covers and what triggers an alert.',
        crumbs: [{ label: 'Notifications' }],
      })}
      <div id="set-overview"></div>
      <div class="set-bar">
        <div class="set-src small" id="set-src"></div>
        <div class="set-actions">
          <button class="btn-primary" type="button" data-set="export">⬇ Export settings</button>
          <label class="btn-ghost set-import">⬆ Import<input type="file" accept="application/json,.json" data-set="import" hidden></label>
          <button class="btn-ghost" type="button" data-set="reset">Discard draft</button>
        </div>
        <div class="set-msg small" id="set-msg" role="status"></div>
      </div>
      <div class="set-layout">
        <nav class="set-nav" aria-label="Settings sections">${SECTIONS.map(([id, t], i) => `<a href="#/settings" data-jump="${id}"><span>${i + 1}</span>${esc(t)}</a>`).join('')}</nav>
        <div class="set-main">
          <div id="set-form"></div>
          ${section('status', 7, 'System status', 'What the automation did on its last runs. Read-only.', statusPanel(st))}
          ${section('help', 8, 'How it works', 'This website cannot change the automation by itself; settings travel through one file.',
            `<ol class="set-steps">
              <li>Every change on this page is saved as a <b>draft in this browser</b> right away.</li>
              <li>Click <b>Export settings</b> and replace <code>automation/notify-config.json</code> in the project with the downloaded file.</li>
              <li>The automation (<code>python automation/run.py</code>, later the GitHub Actions schedule) applies it on its next run.</li>
              <li>Telegram commands change a few settings instantly and override the file:</li></ol>
            <div class="tg-cmds">${TG_HELP.map(([c, d]) => `<div><code>${esc(c)}</code><span class="muted">${esc(d)}</span></div>`).join('')}</div>`)}
        </div>
      </div>`;

      const formEl = el.querySelector('#set-form');
      const msg = el.querySelector('#set-msg');
      const src = el.querySelector('#set-src');
      const ov = el.querySelector('#set-overview');
      const DRAFT_TXT = '<span class="tag tag-draft">DRAFT</span> Unsaved changes in this browser — export to apply them.';

      function paint() {
        formEl.innerHTML = form(cfg, quotes, st);
        ov.innerHTML = overview(cfg, st);
        syncDivBoxes(formEl);
        src.innerHTML = readDraft() ? DRAFT_TXT
          : from === 'repo' ? '<span class="tag tag-live">SAVED</span> Showing the settings file from the project.' : 'Showing default settings (project file not reachable).';
      }

      function save() {
        const { cfg: next, errors } = readForm(formEl, cfg);
        if (errors.length) { msg.innerHTML = `<span class="down">${esc(errors.join(' · '))}</span>`; return null; }
        cfg = next;
        U.storage.set(DRAFT_KEY, JSON.stringify(cfg));
        msg.textContent = 'Draft saved in this browser.';
        src.innerHTML = DRAFT_TXT;
        ov.innerHTML = overview(cfg, st);
        return cfg;
      }

      formEl.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.divall) {
          formEl.querySelectorAll(`[data-depdiv="${t.dataset.divall}"]`).forEach(d => { d.checked = t.checked; });
        }
        syncDivBoxes(formEl);
        save();
      });

      el.querySelector('.set-nav').addEventListener('click', e => {
        const a = e.target.closest('[data-jump]');
        if (!a) return;
        e.preventDefault();
        const target = el.querySelector(`#set-${a.dataset.jump}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      // highlight the section in view
      const links = [...el.querySelectorAll('[data-jump]')];
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => entries.forEach(en => {
          if (en.isIntersecting) links.forEach(l => l.classList.toggle('on', `set-${l.dataset.jump}` === en.target.id));
        }), { rootMargin: '-20% 0px -70% 0px' });
        setTimeout(() => el.querySelectorAll('.set-sec').forEach(s => io.observe(s)), 0);
      }

      el.querySelector('.set-bar').addEventListener('click', e => {
        const b = e.target.closest('[data-set]');
        if (!b) return;
        if (b.dataset.set === 'export') {
          const c = save();
          if (c) { download('notify-config.json', JSON.stringify(c, null, 2) + '\n'); msg.textContent = 'Exported. Replace automation/notify-config.json with this file.'; }
        }
        if (b.dataset.set === 'reset') {
          U.storage.set(DRAFT_KEY, '');
          cfg = repoCfg;
          paint();
          msg.textContent = 'Draft discarded.';
        }
      });

      el.querySelector('[data-set="import"]').addEventListener('change', async e => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const c = JSON.parse(await f.text());
          if (!c.channels || !c.digest || !c.thresholds) throw new Error('not a notify-config.json file');
          cfg = { ...clone(DEFAULTS), ...c };
          U.storage.set(DRAFT_KEY, JSON.stringify(cfg));
          paint();
          msg.textContent = `Imported ${f.name} as a draft.`;
        } catch (err) {
          msg.innerHTML = `<span class="down">Import failed: ${esc(err.message)}</span>`;
        }
        e.target.value = '';
      });

      paint();
    },
  };
})();
