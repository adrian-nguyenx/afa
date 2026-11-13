/* Hash router — tương thích GitHub Pages (không cần server-side rewrite).
 * Route được suy ra từ registry: #/<divisionId>/<departmentId>
 */
window.AFA = window.AFA || {};

(function () {
  const staticRoutes = {
    '': { view: 'dashboard', title: 'Dashboard' },
    news: { view: 'news', title: 'News Intelligence' },
    '3d': { view: 'center3d', title: '3D Intelligence Center' },
    settings: { view: 'settings', title: 'Notifications' },
  };

  function resolve(hash) {
    const raw = (hash || '').replace(/^#\/?/, '').split('?')[0];
    const segs = raw.split('/').filter(Boolean).map(decodeURIComponent);
    const path = segs.join('/');

    if (segs.length <= 1 && staticRoutes[segs[0] || '']) {
      const r = staticRoutes[segs[0] || ''];
      return { path, view: AFA.views[r.view], title: r.title, params: {} };
    }

    const division = AFA.registry.getDivision(segs[0]);
    if (division) {
      if (division.status !== 'active') {
        return { path: division.id, view: AFA.views.comingSoon, title: division.nameEn, params: { division } };
      }
      if (segs[1]) {
        const department = division.departments.find(d => d.id === segs[1]);
        if (department) {
          return { path, view: AFA.views.department, title: department.name, params: { division, department } };
        }
      } else {
        return { path, view: AFA.views.division, title: division.nameEn, params: { division } };
      }
    }
    return { path, view: AFA.views.notFound, title: 'Not found', params: {} };
  }

  AFA.router = { resolve };
})();
