/* News components: ImportanceBadge, NewsCard, NewsList, NewsExplorer (filter bar + list). */
window.AFA = window.AFA || {};
AFA.ui = AFA.ui || {};

(function () {
  const U = AFA.utils;
  const R = AFA.registry;
  const esc = U.esc;

  AFA.ui.importanceBadge = function (level) {
    const i = R.taxonomy.importance[level] || R.taxonomy.importance[1];
    return `<span class="imp imp-${i.key}" title="Importance: ${esc(i.label)}"><i></i><i></i><i></i>${esc(i.label)}</span>`;
  };

  AFA.ui.newsCard = function (n, opts = {}) {
    const dept = R.getDepartment(n.departmentId);
    const imp = (R.taxonomy.importance[n.importance] || {}).key || 'low';
    const markets = (n.markets || []).slice(0, 3).map(m => `<span class="tag tag-mkt">${esc(m)}</span>`).join('');
    return `<article class="news-card imp-l-${imp} ${opts.compact ? 'compact' : ''}">
      <div class="news-meta">
        <span class="src">${esc(n.source)}</span>
        <time datetime="${esc(n.publishedAt)}" title="${esc(U.fmtDateTime(n.publishedAt))}">${esc(U.timeAgo(n.publishedAt))}</time>
        ${AFA.ui.importanceBadge(n.importance)}
      </div>
      <h3 class="news-title" lang="${esc(n.lang || 'vi')}"><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.headline)}</a></h3>
      ${opts.compact ? '' : `<p class="news-sum" lang="${esc(n.lang || 'vi')}">${esc(n.summary)}</p>`}
      <div class="news-tags">
        ${dept ? `<a class="tag tag-dept" href="#/${esc(dept.divisionId)}/${esc(dept.id)}">${esc(dept.name.replace(/^Phòng /, ''))}</a>` : ''}
        <span class="tag">${esc(n.category)}</span>
        ${opts.compact ? '' : `<span class="tag">${esc(n.sector)}</span>`}
        <span class="tag tag-country">${esc(R.countryLabel(n.country))}</span>
        ${opts.compact ? '' : markets}
      </div>
    </article>`;
  };

  AFA.ui.newsList = (items, opts) =>
    items.length ? `<div class="news-list">${items.map(n => AFA.ui.newsCard(n, opts)).join('')}</div>` : AFA.ui.emptyState('No news matches these filters.');

  function select(key, label, options, value) {
    return `<label class="fld"><span>${esc(label)}</span><select data-f="${key}">
      ${options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(value) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}
    </select></label>`;
  }

  function deptOptions(divisionId) {
    const depts = divisionId ? (R.getDivision(divisionId) || { departments: [] }).departments : R.allDepartments();
    return [{ v: '', l: 'All' }, ...depts.map(p => ({ v: p.id, l: p.name }))];
  }

  /**
   * Bộ lọc + danh sách tin. base: filter cố định (vd. { divisionId } hoặc { departmentId }).
   */
  AFA.ui.newsExplorer = async function (el, base = {}) {
    const all = await AFA.data.getNews(base);
    const facets = AFA.services.newsFacets(all);
    const state = { divisionId: '', departmentId: '', country: '', sector: '', category: '', importance: '', timeRange: 'all', sort: 'time', q: '', ...base };
    const any = [{ v: '', l: 'All' }];

    const fields = [];
    if (!base.divisionId && !base.departmentId) {
      fields.push(select('divisionId', 'Division', [...any, ...R.activeDivisions().map(d => ({ v: d.id, l: d.nameEn }))], state.divisionId));
    }
    if (!base.departmentId) fields.push(select('departmentId', 'Desk', deptOptions(state.divisionId), state.departmentId));
    fields.push(
      select('country', 'Country', [...any, ...facets.countries.map(c => ({ v: c, l: R.countryLabel(c) }))], state.country),
      select('sector', 'Sector', [...any, ...facets.sectors.map(s => ({ v: s, l: s }))], state.sector),
      select('category', 'Topic', [...any, ...facets.categories.map(s => ({ v: s, l: s }))], state.category),
      select('timeRange', 'Time', R.taxonomy.timeRanges, state.timeRange),
      select('importance', 'Importance', [{ v: '', l: 'All' }, { v: 3, l: 'High' }, { v: 2, l: 'Medium & above' }], state.importance),
      select('sort', 'Sort', [{ v: 'time', l: 'Latest' }, { v: 'importance', l: 'Most important' }], state.sort)
    );

    el.innerHTML = `<div class="filter-bar">
        <label class="fld fld-search"><span>Search</span><input type="search" data-f="q" placeholder="Keyword, source, symbol…" /></label>
        ${fields.join('')}
        <button class="btn-ghost" data-reset type="button">Clear filters</button>
      </div>
      <div class="news-count"></div>
      <div class="news-results"></div>`;

    const results = el.querySelector('.news-results'), count = el.querySelector('.news-count');

    async function update() {
      const items = await AFA.data.getNews(state);
      count.textContent = `${items.length} ${items.length === 1 ? 'story' : 'stories'}`;
      results.innerHTML = AFA.ui.newsList(items);
    }

    const bar = el.querySelector('.filter-bar');
    bar.addEventListener('input', e => {
      const k = e.target.dataset.f;
      if (!k) return;
      state[k] = e.target.value;
      if (k === 'divisionId') {
        state.departmentId = '';
        const ds = bar.querySelector('[data-f="departmentId"]');
        if (ds) ds.innerHTML = deptOptions(state.divisionId).map(o => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('');
      }
      update();
    });
    bar.querySelector('[data-reset]').addEventListener('click', () => AFA.ui.newsExplorer(el, base));
    await update();
  };
})();
