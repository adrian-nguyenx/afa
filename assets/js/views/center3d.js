/* View: Adrian Financial Agents HQ — Living Intelligence Office (Phase 2).
 *
 * A real-scale headquarters generated from the registry:
 *   Lobby + Intelligence Hub (hero operator, holographic globe, division panels, market video walls)
 *   → central corridor → one office wing per active division.
 * Each wing: a team pod per desk (6 workstations, a 3D holographic data visualisation for that desk,
 * a wall-sized live display), a division data wall, a ticker band, a glass meeting room and a coffee point.
 * Staff follow varied routines; walkers move between areas; data streams flow from the hub to every wing.
 * Camera levels: Overview → Division → Desk → Employee / Display.
 * Faces: two separate, original face design systems built into the head model — one for Adrian (main character),
 *   one shared by every other agent (with per-person variation).
 * Three.js r128 (classic build) is loaded lazily. No external models or assets.
 */
window.AFA = window.AFA || {};
AFA.views = AFA.views || {};

(function () {
  const U = AFA.utils;
  const esc = U.esc;
  const CLOSE = '<button class="c3d-close" data-close type="button" aria-label="Close panel">×</button>';
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rr = i => { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const FONT = 'Inter, Segoe UI, sans-serif', MONO = 'Consolas, monospace';

  const ACT_LABEL = {
    type: 'working on a computer', read: 'reading reports', chat: 'discussing with a colleague', meet: 'in a team meeting',
    present: 'presenting / briefing', talk: 'talking with a colleague', analyse: 'analysing charts on a data wall',
    watch: 'monitoring market & intelligence feeds', walk: 'walking between areas', idle: 'reviewing data on the floor',
  };
  const SEATED = new Set(['type', 'read', 'chat', 'meet']);
  const NAMES = ['Minh Anh', 'Quang Huy', 'Thu Trang', 'Hoàng Nam', 'Lan Chi', 'Đức Anh', 'Bảo Ngọc', 'Tuấn Kiệt', 'Hải Yến', 'Gia Bảo',
    'Ngọc Hân', 'Thành Long', 'Mai Phương', 'Khánh Linh', 'Việt Hùng', 'Phương Thảo', 'Anh Tú', 'Diệu Linh', 'Minh Khoa', 'Thanh Hà',
    'Emily Carter', 'James Lee', 'Sophie Martin', 'Daniel Kim', 'Olivia Brown', 'Lucas Tran', 'Hana Sato', 'Noah Park'];
  const ROLES = {
    corporate: ['Equity Research Analyst', 'Corporate Analyst', 'M&A Analyst', 'Earnings Analyst'],
    macro: ['Economist', 'Macro Strategist', 'Policy Analyst', 'FX Economist'],
    market: ['Market Analyst', 'Quant Analyst', 'Market Data Specialist', 'Trading Desk Analyst'],
    banking: ['Banking Analyst', 'Rates Analyst', 'Credit Analyst', 'Bank Financials Analyst'],
    _: ['Intelligence Analyst', 'Data Engineer', 'Operations Associate', 'Research Associate'],
  };

  async function deskMetric(p) {
    if (p.symbols && p.symbols.length) {
      const [q] = await AFA.data.getQuotes([p.symbols[0]]);
      if (q) return { main: `${q.name}  ${U.fmtNum(q.price, q.dp)}`, sub: `${U.arrow(q.changePct)} ${U.fmtPct(q.changePct)} today`, dir: U.dir(q.changePct), price: q.price, dp: q.dp, label: q.name };
    }
    const news = await AFA.data.getNews({ departmentId: p.id });
    return { main: `${news.length} stories tracked`, sub: news[0] ? `Latest ${U.timeAgo(news[0].publishedAt)}` : 'No stories yet', dir: 'flat' };
  }

  // ---------------------------------------------------------------- view
  AFA.views.center3d = {
    async render(el) {
      el.classList.add('view-3d');
      const divisions = AFA.registry.activeDivisions();
      const H = AFA.config.center3d.hero;
      el.innerHTML = `<section class="c3d">
        <div class="c3d-canvas" aria-hidden="true"></div>
        <div class="c3d-hud">
          <div class="c3d-title"><span class="kicker">Phase 2 · Living Intelligence Office</span><h1>Adrian Financial Agents HQ</h1></div>
          <nav class="c3d-nav" aria-label="3D navigation">
            <button data-go="overview" class="on">Overview</button>
            <button data-go="hero" style="--c:#ffc857">★ ${esc(H.name)}</button>
            ${divisions.map(d => `<button data-go="div:${esc(d.id)}" style="--c:${esc(d.color)}">${esc(d.nameEn)}</button>`).join('')}
            <button data-tour class="c3d-tour" title="Adrian walks through every division and inspects it">▶ Supervisor Tour</button>
            <button data-fs class="c3d-fs" title="Full screen (F)">⛶ Full screen</button>
          </nav>
        </div>
        <aside class="c3d-info" hidden></aside>
        <div class="c3d-sup-banner" hidden aria-live="polite"></div>
        <div class="c3d-sup-status" hidden></div>
        <div class="c3d-sup" hidden></div>
        <div class="c3d-tip" hidden></div>
        <div class="c3d-hint">Drag to orbit · Scroll to zoom · Click a division, desk, person or screen · F full screen · Esc for overview</div>
        <div class="c3d-loading">Opening the headquarters…</div>
      </section>`;
      const root = el.querySelector('.c3d');
      const loadingEl = root.querySelector('.c3d-loading');
      try {
        for (const src of AFA.config.center3d.libs) await U.loadScript(src);
      } catch (e) {
        loadingEl.textContent = '3D engine could not be loaded (offline?). The 2D pages still work.';
        return;
      }
      if (!el.isConnected) return;
      const D = AFA.data;
      const metrics = {};
      await Promise.all(divisions.flatMap(d => d.departments).map(async p => { metrics[p.id] = await deskMetric(p); }));
      const histSyms = ['VNINDEX', 'SPX', 'XAUUSD', 'BRENT', 'XAGUSD', 'WTI', 'NG', 'HG'];
      const hist = {};
      await Promise.all(histSyms.map(async s => { hist[s] = (await D.getHistory(s, '3M')).points.map(p => p.v); }));
      const data = {
        metrics, hist,
        ticker: await D.getQuotes(AFA.config.tickerSymbols),
        stocks: (await D.getQuotes()).filter(q => q.assetClass === 'stock'),
        fx: await D.getQuotes(['USDVND', 'EURVND', 'JPYVND', 'CNYVND', 'GBPVND', 'EURUSD', 'USDJPY']),
        comm: await D.getQuotes(['XAUUSD', 'XAGUSD', 'WTI', 'BRENT', 'NG', 'HG']),
        rates: D.getBankRates ? await D.getBankRates() : null,
        funds: D.getBankFundamentals ? await D.getBankFundamentals() : null,
        news: await D.getNews({}),
      };
      if (!el.isConnected) return;
      build(window.THREE, root, divisions, data, el);
      loadingEl.remove();
    },
  };

  // ---------------------------------------------------------------- scene
  function build(THREE, root, divisions, data, viewEl) {
    const host = root.querySelector('.c3d-canvas');
    const info = root.querySelector('.c3d-info');
    const tip = root.querySelector('.c3d-tip');
    const CFG = AFA.config.center3d;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rng = U.seeded(20261113);
    const pick = arr => arr[Math.floor(rng() * arr.length)];
    const rand = (a, b) => a + rng() * (b - a);
    const { metrics } = data;

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) {
      host.innerHTML = '<div class="empty">WebGL is not available in this browser.</div>';
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a16);
    scene.fog = new THREE.Fog(0x0a1126, 200, 820); // atmospheric haze: far towers fade into the city glow
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2400);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, maxPolarAngle: 1.42, minDistance: 2.5, maxDistance: 320, autoRotateSpeed: 0.2 });

    const hemi = new THREE.HemisphereLight(0xe6eeff, 0x1a1f2b, 0.85);
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.5); sun.position.set(60, 120, 50);
    scene.add(hemi, sun, new THREE.AmbientLight(0x404a66, 0.35));

    // ---- caches & primitives
    const geoCache = {}, matCache = {};
    const boxGeo = (w, h, d) => geoCache[`b${w}|${h}|${d}`] || (geoCache[`b${w}|${h}|${d}`] = new THREE.BoxGeometry(w, h, d));
    const M = (color, o = {}) => {
      const k = color + JSON.stringify(o);
      return matCache[k] || (matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, o)));
    };
    const box = (parent, w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(boxGeo(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const frameMat = M(0x9aa3b5, { metalness: 0.6, roughness: 0.35 });
    const animators = [];            // functions (t, dt) run every frame
    const animated = [];             // canvas textures redrawn on an interval
    const pickables = { coarse: [], fine: [] }; // coarse: wings/desks; fine: people/screens

    function canvasTex(w, h, draw, every) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
      draw(g, w, h, 0);
      if (every) animated.push({ g, w, h, tex, draw, every, next: rng() * every });
      return tex;
    }
    function roundRect(g, x, y, w, h, r) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    /** Glass panel background with title. */
    function glass(g, w, h, col, title, sub) {
      g.clearRect(0, 0, w, h);
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(20,36,82,0.80)'); grd.addColorStop(1, 'rgba(6,12,32,0.66)');
      g.fillStyle = grd; roundRect(g, 4, 4, w - 8, h - 8, Math.min(w, h) * 0.04); g.fill();
      g.strokeStyle = col; g.lineWidth = Math.max(3, w / 400); g.globalAlpha = 0.85; roundRect(g, 4, 4, w - 8, h - 8, Math.min(w, h) * 0.04); g.stroke(); g.globalAlpha = 1;
      const fs = Math.round(Math.min(h * 0.075, w * 0.04));
      if (title) {
        g.fillStyle = col; g.fillRect(w * 0.025, h * 0.05, fs * 0.18, fs * 1.1);
        g.fillStyle = '#ffffff'; g.font = `700 ${fs}px ${FONT}`; g.fillText(title, w * 0.025 + fs * 0.5, h * 0.05 + fs * 0.92);
      }
      if (sub) { g.fillStyle = '#8fa2d9'; g.font = `500 ${Math.round(fs * 0.55)}px ${MONO}`; g.fillText(sub, w * 0.025 + fs * 0.5, h * 0.05 + fs * 1.75); }
      return fs;
    }
    function spark(g, x, y, w, h, vals, col, fill) {
      const mn = Math.min(...vals), mx = Math.max(...vals), n = vals.length;
      const P = vals.map((v, i) => [x + (i / (n - 1)) * w, y + h - ((v - mn) / (mx - mn || 1)) * h]);
      if (fill) {
        const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, col + '66'); grd.addColorStop(1, col + '00');
        g.fillStyle = grd; g.beginPath(); g.moveTo(x, y + h); P.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(x + w, y + h); g.closePath(); g.fill();
      }
      g.strokeStyle = col; g.lineWidth = Math.max(2, h / 60); g.shadowColor = col; g.shadowBlur = 8;
      g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.shadowBlur = 0;
    }
    const dirCol = v => (v >= 0 ? '#3dffb5' : '#ff4f8b');
    const hex = c => '#' + new THREE.Color(c).getHexString();

    /** Floating holographic glass panel (viewer on +z). */
    function holoPanel(parent, w, h, draw, every, o = {}) {
      const g = new THREE.Group(); parent.add(g);
      const cw = o.cw || 1024, ch = Math.round(cw * h / w);
      const tex = canvasTex(cw, ch, draw, every);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: o.opacity || 0.96 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); g.add(mesh);
      if (o.frame !== false) {
        const fr = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), new THREE.LineBasicMaterial({ color: o.color || 0x00e5ff, transparent: true, opacity: 0.7 }));
        fr.position.z = 0.01; g.add(fr);
      }
      if (o.pick) { mesh.userData = Object.assign({ type: 'display', w }, o.pick); pickables.fine.push(mesh); }
      if (o.bob && !reduceMotion) { const ph = rng() * 6; animators.push(t => { g.userData.y0 = g.userData.y0 ?? g.position.y; g.position.y = g.userData.y0 + Math.sin(t * 0.7 + ph) * o.bob; }); }
      return g;
    }
    function screenMesh(parent, w, h, tex, x, y, z, ry = 0, pickData) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
      if (pickData) { m.userData = Object.assign({ type: 'display', w }, pickData); pickables.fine.push(m); }
      return m;
    }
    function label(text, sub, color, scale = 1) {
      const c = document.createElement('canvas'); c.width = 1024; c.height = 220;
      const g = c.getContext('2d');
      g.textAlign = 'center';
      g.fillStyle = 'rgba(6,10,26,0.78)'; roundRect(g, 40, 20, 944, 180, 40); g.fill();
      g.strokeStyle = color; g.lineWidth = 6; roundRect(g, 40, 20, 944, 180, 40); g.stroke();
      g.font = `700 70px ${FONT}`; g.fillStyle = '#ffffff'; g.fillText(text, 512, 108);
      g.font = `600 36px ${MONO}`; g.fillStyle = color; g.fillText(sub, 512, 165);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false, sizeAttenuation: false }));
      s.scale.set(0.2 * scale, 0.043 * scale, 1);
      return s;
    }

    // ---------------------------------------------------------------- 3D data visualisation builders (viewer on +z)
    /** 3D bar grid: columns along x, rows in depth. rows: [{ name, values[], color }] — each row normalised to its own max. */
    function holoBars(parent, cols, rows, o = {}) {
      const W = o.w || 5, Hh = o.h || 2.6, depthStep = o.step || 0.9;
      const g = new THREE.Group(); parent.add(g);
      const base = new THREE.Mesh(boxGeo(W + 0.6, 0.06, rows.length * depthStep + 0.5), new THREE.MeshStandardMaterial({ color: 0x0d1838, emissive: 0x0a1a44, transparent: true, opacity: 0.75 }));
      base.position.set(0, 0, -(rows.length - 1) * depthStep / 2); g.add(base);
      const gridL = new THREE.LineSegments(new THREE.EdgesGeometry(base.geometry), new THREE.LineBasicMaterial({ color: 0x5aa9ff, transparent: true, opacity: 0.5 }));
      gridL.position.copy(base.position); g.add(gridL);
      const bars = [];
      const bw = Math.min(0.55, (W / cols.length) * 0.55);
      rows.forEach((r, ri) => {
        const mx = Math.max(...r.values.map(Math.abs)) || 1;
        const col = new THREE.Color(r.color);
        r.values.forEach((v, ci) => {
          const neg = v < 0;
          const mat = new THREE.MeshStandardMaterial({ color: neg ? 0xff4f8b : col, emissive: (neg ? new THREE.Color(0xff4f8b) : col).clone().multiplyScalar(0.55), transparent: true, opacity: 0.82, roughness: 0.3 });
          const m = new THREE.Mesh(boxGeo(1, 1, 1), mat);
          const x = -W / 2 + (ci + 0.5) * (W / cols.length), z = -ri * depthStep;
          const h = Math.max(0.08, (Math.abs(v) / mx) * Hh);
          m.scale.set(bw, h, bw * 0.9); m.position.set(x, h / 2 + 0.03, z); g.add(m);
          const cap = new THREE.Mesh(boxGeo(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
          cap.scale.set(bw * 1.04, 0.025, bw * 0.94); cap.position.set(x, h + 0.04, z); g.add(cap);
          bars.push({ m, cap, h, ph: rng() * 6 });
        });
      });
      // labels strip in front + legend
      const lab = holoPanel(g, W + 0.6, 0.62, (lg, w, h) => {
        lg.clearRect(0, 0, w, h); lg.textAlign = 'center';
        lg.font = `700 ${Math.round(h * 0.36)}px ${MONO}`; lg.fillStyle = '#dfe7ff';
        cols.forEach((c, i) => lg.fillText(c, ((i + 0.5) / cols.length) * w * (W / (W + 0.6)) + w * (0.3 / (W + 0.6)), h * 0.42));
        lg.textAlign = 'left'; lg.font = `600 ${Math.round(h * 0.24)}px ${FONT}`;
        let x = 12; rows.forEach(r => { lg.fillStyle = hex(r.color); lg.fillRect(x, h * 0.66, 18, 18); lg.fillStyle = '#9fb0de'; lg.fillText(r.name, x + 26, h * 0.66 + 16); x += lg.measureText(r.name).width + 60; });
      }, 0, { frame: false, cw: 1024 });
      lab.position.set(0, 0.05, 0.62); lab.rotation.x = -0.55;
      if (!reduceMotion) {
        let nextRefresh = 0;
        animators.push(t => {
          if (t > nextRefresh) { nextRefresh = t + 4; bars.forEach(b => { b.h *= 1 + (rng() - 0.5) * 0.06; b.h = Math.max(0.08, Math.min(Hh * 1.05, b.h)); }); }
          bars.forEach(b => { const h = b.h * (1 + Math.sin(t * 1.1 + b.ph) * 0.03); b.m.scale.y = h; b.m.position.y = h / 2 + 0.03; b.cap.position.y = h + 0.04; });
        });
      }
      return g;
    }
    /** Animated 3D line chart with glowing line, ribbon fill and a depth echo. */
    function holoLine(parent, values, color, o = {}) {
      const W = o.w || 5.2, Hh = o.h || 2.4, n = 60;
      const g = new THREE.Group(); parent.add(g);
      let vals = values.slice(-n); while (vals.length < n) vals.unshift(vals[0]);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.4, Hh + 0.6), new THREE.MeshBasicMaterial({ color: 0x0a1636, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
      back.position.set(0, Hh / 2 + 0.1, -0.5); g.add(back);
      const gridPts = [];
      for (let i = 0; i <= 4; i++) { const y = 0.1 + (Hh * i) / 4; gridPts.push(-W / 2, y, -0.49, W / 2, y, -0.49); }
      const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gridPts, 3));
      g.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x2a4a8a, transparent: true, opacity: 0.6 })));
      const linePos = new Float32Array(n * 3), echoPos = new Float32Array(n * 3), ribPos = new Float32Array(n * 6);
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(echoPos, 3));
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
      const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } rg.setIndex(idx);
      const col = new THREE.Color(color);
      g.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: col })));
      g.add(new THREE.Line(eg, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.3 })));
      g.add(new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); g.add(head);
      function update() {
        const mn = Math.min(...vals), mx = Math.max(...vals);
        vals.forEach((v, i) => {
          const x = -W / 2 + (i / (n - 1)) * W, y = 0.15 + ((v - mn) / (mx - mn || 1)) * Hh;
          linePos.set([x, y, 0], i * 3); echoPos.set([x, y, -0.35], i * 3); ribPos.set([x, y, 0, x, 0.1, 0], i * 6);
          if (i === n - 1) head.position.set(x, y, 0);
        });
        lg.attributes.position.needsUpdate = eg.attributes.position.needsUpdate = rg.attributes.position.needsUpdate = true;
      }
      update();
      if (!reduceMotion) {
        let next = 0;
        animators.push(t => {
          if (t > next) { next = t + 0.7; const last = vals[vals.length - 1]; vals = vals.slice(1).concat(last * (1 + (rng() - 0.49) * 0.006)); update(); }
          head.scale.setScalar(1 + Math.sin(t * 5) * 0.25);
        });
      }
      if (o.title) {
        const tp = holoPanel(g, W + 0.4, 0.55, (cg, w, h) => {
          cg.clearRect(0, 0, w, h); cg.font = `700 ${Math.round(h * 0.5)}px ${FONT}`; cg.fillStyle = '#ffffff'; cg.fillText(o.title, 10, h * 0.62);
          if (o.sub) { cg.textAlign = 'right'; cg.fillStyle = o.subColor || '#3dffb5'; cg.font = `600 ${Math.round(h * 0.42)}px ${MONO}`; cg.fillText(o.sub, w - 10, h * 0.62); }
        }, 0, { frame: false });
        tp.position.set(0, Hh + 0.75, -0.5);
      }
      return g;
    }
    /** Ring gauges (value / max) with centre labels. items: [{ label, value, max, text, color }] */
    function holoGauges(parent, items, o = {}) {
      const g = new THREE.Group(); parent.add(g);
      const R = o.r || 0.85, gap = R * 2.6;
      items.forEach((it, i) => {
        const x = (i - (items.length - 1) / 2) * gap;
        const ring = new THREE.Group(); ring.position.set(x, R + 0.5, 0); g.add(ring);
        ring.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0x1d2a50 })));
        const arc = new THREE.Mesh(new THREE.TorusGeometry(R, 0.09, 10, 64, Math.PI * 2 * Math.min(1, it.value / it.max)), new THREE.MeshBasicMaterial({ color: new THREE.Color(it.color) }));
        arc.rotation.z = Math.PI / 2; ring.add(arc);
        const p = holoPanel(ring, R * 1.6, R * 1.0, (cg, w, h) => {
          cg.clearRect(0, 0, w, h); cg.textAlign = 'center';
          cg.fillStyle = '#ffffff'; cg.font = `800 ${Math.round(h * 0.36)}px ${MONO}`; cg.fillText(it.text, w / 2, h * 0.5);
          cg.fillStyle = '#9fb0de'; cg.font = `600 ${Math.round(h * 0.15)}px ${FONT}`; cg.fillText(it.label, w / 2, h * 0.78);
        }, 0, { frame: false, cw: 512 });
        p.position.z = 0.02;
        if (!reduceMotion) animators.push(t => { arc.rotation.z = Math.PI / 2 + Math.sin(t * 0.6 + i) * 0.05; });
      });
      return g;
    }
    /** Wireframe globe with country markers (height = value). markers: [{ lat, lon, value, max, label, color }] */
    function holoGlobe(parent, markers, o = {}) {
      const R = o.r || 1.5;
      const g = new THREE.Group(); g.position.y = R + 0.4; parent.add(g);
      const spin = new THREE.Group(); g.add(spin);
      spin.add(new THREE.Mesh(new THREE.SphereGeometry(R, 28, 18), new THREE.MeshBasicMaterial({ color: 0x3f7bff, wireframe: true, transparent: true, opacity: 0.28 })));
      spin.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.98, 28, 18), new THREE.MeshBasicMaterial({ color: 0x0a1a44, transparent: true, opacity: 0.45 })));
      markers.forEach(mk => {
        const phi = (90 - mk.lat) * Math.PI / 180, th = (mk.lon + 180) * Math.PI / 180;
        const dir = new THREE.Vector3(-Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
        const h = 0.15 + (mk.value / mk.max) * 0.9;
        const bar = new THREE.Mesh(boxGeo(0.07, 1, 0.07), new THREE.MeshBasicMaterial({ color: new THREE.Color(mk.color) }));
        bar.scale.y = h; bar.position.copy(dir.clone().multiplyScalar(R + h / 2)); bar.lookAt(dir.clone().multiplyScalar(R * 3)); bar.rotateX(Math.PI / 2);
        spin.add(bar);
        const lb = label(mk.label, mk.sub || '', mk.color, 0.42); lb.position.copy(dir.clone().multiplyScalar(R + h + 0.35)); spin.add(lb);
      });
      g.add(new THREE.Mesh(new THREE.TorusGeometry(R * 1.25, 0.02, 6, 80), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 }))).rotation.x = Math.PI / 2.2;
      if (!reduceMotion) animators.push(t => { spin.rotation.y = t * 0.12; });
      return g;
    }
    /** Rotating carousel of small quote panels. items: [{ title, value, sub, dir }] */
    function holoCarousel(parent, items, color) {
      const g = new THREE.Group(); g.position.y = 1.6; parent.add(g);
      const R = 2.1;
      items.forEach((it, i) => {
        const a = (i / items.length) * Math.PI * 2;
        const p = holoPanel(g, 1.5, 0.9, (cg, w, h) => {
          glass(cg, w, h, color);
          cg.fillStyle = '#9fb0de'; cg.font = `600 ${Math.round(h * 0.16)}px ${MONO}`; cg.fillText(it.title, w * 0.07, h * 0.28);
          cg.fillStyle = '#ffffff'; cg.font = `800 ${Math.round(h * 0.26)}px ${MONO}`; cg.fillText(it.value, w * 0.07, h * 0.6);
          cg.fillStyle = it.dir === 'down' ? '#ff4f8b' : '#3dffb5'; cg.font = `700 ${Math.round(h * 0.17)}px ${MONO}`; cg.fillText(it.sub, w * 0.07, h * 0.84);
        }, 0, { frame: false, cw: 512 });
        p.position.set(Math.sin(a) * R, 0, Math.cos(a) * R); p.rotation.y = a;
      });
      if (!reduceMotion) animators.push(t => { g.rotation.y = t * 0.18; });
      return g;
    }
    /** Scrolling headline feed (Vietnamese headlines keep their language). */
    function feedPanel(parent, w, h, title, items, color, pickData) {
      return holoPanel(parent, w, h, (cg, cw, ch, t) => {
        const fs = glass(cg, cw, ch, color, title, 'LIVE FEED · MOCK');
        const start = Math.floor(t / 3) % Math.max(1, items.length);
        cg.font = `500 ${Math.round(fs * 0.62)}px ${FONT}`;
        for (let i = 0; i < Math.min(5, items.length); i++) {
          const n = items[(start + i) % items.length], y = ch * 0.3 + i * fs * 1.35;
          cg.fillStyle = i === 0 ? color : '#3a4a78'; cg.fillRect(cw * 0.03, y - fs * 0.5, 6, fs * 0.7);
          cg.fillStyle = i === 0 ? '#ffffff' : '#b9c4e8';
          cg.fillText(fit(cg, n.headline, cw * 0.9), cw * 0.05, y);
          cg.fillStyle = '#6f80b5'; cg.font = `500 ${Math.round(fs * 0.45)}px ${MONO}`; cg.fillText(`${n.source} · ${U.timeAgo(n.publishedAt)}`, cw * 0.05, y + fs * 0.5);
          cg.font = `500 ${Math.round(fs * 0.62)}px ${FONT}`;
        }
      }, 3, { color, pick: pickData });
    }
    function fit(g, txt, maxW) { if (g.measureText(txt).width <= maxW) return txt; let s = txt; while (s.length > 4 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1); return s + '…'; }

    // ---------------------------------------------------------------- people
    const SKIN = [0xf1c9a5, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xd9a066];
    const HAIR = [0x2b1d14, 0x4a3020, 0x111111, 0x6b4a2b, 0x9a7b4f, 0x3b3b3b, 0x1c1c22];
    const SHIRT = [0xf4f6fb, 0xcfe0f5, 0x1f2a44, 0x3a4660, 0xe8e1d5, 0x5b6b8a, 0x2d3a52, 0x7a2e3b, 0xdfe7ee, 0x34495e];
    const PANTS = [0x1b2233, 0x2a2f3a, 0x3b3f46, 0x23262d, 0x30384a];
    const TIES = [0x8b1e3f, 0x1e3a8a, 0x0f766e, 0x6b21a8];
    const PG = {};
    const limbGeo = (k, r1, r2, len) => PG[k] || (PG[k] = new THREE.CylinderGeometry(r1, r2, len, 10).translate(0, -len / 2, 0));
    PG.torso = new THREE.CylinderGeometry(0.2, 0.17, 0.6, 12).translate(0, 0.31, 0);
    PG.shoulders = new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 0.65);
    PG.head = new THREE.SphereGeometry(0.125, 18, 14);
    PG.face3 = new THREE.SphereGeometry(0.13, 36, 26);                       // head with the face texture wrapped on it
    PG.hood = new THREE.SphereGeometry(0.152, 28, 16, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.66); // open at the front
    PG.neckG = new THREE.CylinderGeometry(0.062, 0.072, 0.14, 14);
    PG.shoe = new THREE.BoxGeometry(0.11, 0.07, 0.24).translate(0, -0.035, 0.05);
    PG.tie = new THREE.BoxGeometry(0.05, 0.3, 0.01);
    PG.blob = new THREE.CircleGeometry(0.5, 20);
    PG.doc = new THREE.PlaneGeometry(0.24, 0.32);
    const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
    const docMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f2, side: THREE.DoubleSide });
    const shoeMat = M(0x15171c, { roughness: 0.4 });
    // ---------------------------------------------------------------- face design systems
    // Original designs (not copies of any existing character). Faces are painted onto the head sphere itself:
    // sphere UV u = 0.25 is the front of the head, v runs top → bottom.
    const FW = 512, FH = 256, FX = FW * 0.25, EYE_Y = FH * 0.46;
    const css = (c, k = 1) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
    function lensPath(g, cx, cy, w, h, side, shape) {
      g.beginPath();
      if (shape === 'almond') g.ellipse(cx, cy, w, h, side * 0.32, 0, Math.PI * 2);
      else if (shape === 'tear') {
        g.moveTo(cx - side * w * 0.95, cy + h * 0.35);
        g.quadraticCurveTo(cx - side * w * 0.9, cy - h * 1.15, cx + side * w * 1.1, cy - h * 0.55);
        g.quadraticCurveTo(cx + side * w * 0.65, cy + h * 1.15, cx - side * w * 0.95, cy + h * 0.35);
      } else if (shape === 'sweep') { // Adrian: long angular sweep
        g.moveTo(cx - side * w * 0.9, cy + h * 0.1);
        g.lineTo(cx - side * w * 0.55, cy - h * 0.75); g.lineTo(cx + side * w * 1.25, cy - h * 0.95);
        g.quadraticCurveTo(cx + side * w * 0.9, cy + h * 0.9, cx - side * w * 0.9, cy + h * 0.1);
      } else { // 'shield'
        g.moveTo(cx - side * w, cy - h * 0.25); g.lineTo(cx + side * w * 1.05, cy - h * 0.9);
        g.lineTo(cx + side * w * 0.7, cy + h * 0.85); g.lineTo(cx - side * w * 0.75, cy + h * 0.7);
      }
      g.closePath();
    }
    function hexGrid(g, size) {
      const hh = size * Math.sqrt(3) / 2;
      for (let y = -size, r = 0; y < FH + size; y += hh, r++) for (let x = -size + (r % 2) * size * 0.75; x < FW + size; x += size * 1.5) {
        g.beginPath(); for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2; const px = x + Math.cos(a) * size / 2, py = y + Math.sin(a) * size / 2; k ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      }
    }
    // --- AI agents: smooth full-head masks, large rimmed lenses (rim = division colour), varied base / pattern / lens / hood
    const AGENT_BASES = [{ c: 0x1c1e26, line: '#c9d2ea', a: 0.28, light: false }, { c: 0xe8e5f1, line: '#9a92b8', a: 0.45, light: true },
      { c: 0x2b3449, line: '#b8c6ea', a: 0.3, light: false }, { c: 0x3b404c, line: '#d0d6e4', a: 0.26, light: false }];
    const AGENT_SHAPES = ['almond', 'tear', 'shield'], AGENT_PATTERNS = ['hex', 'panel', 'mesh'];
    function drawAgentFace(g, v) {
      const grd = g.createLinearGradient(0, 0, 0, FH); grd.addColorStop(0, css(v.base.c, 1.18)); grd.addColorStop(1, css(v.base.c, 0.72));
      g.fillStyle = grd; g.fillRect(0, 0, FW, FH);
      g.strokeStyle = v.base.line; g.globalAlpha = v.base.a; g.lineWidth = 1.4;
      if (v.pattern === 'hex') hexGrid(g, 20);
      else if (v.pattern === 'panel') {
        for (let x = 0; x < FW; x += 32) { g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, FH * 0.4, x - 8, FH * 0.7, x, FH); g.stroke(); }
        [0.24, 0.7].forEach(f => { g.beginPath(); g.moveTo(0, FH * f); g.lineTo(FW, FH * f); g.stroke(); });
      } else {
        for (let x = -FH; x < FW; x += 14) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + FH, FH); g.stroke(); g.beginPath(); g.moveTo(x + FH, 0); g.lineTo(x, FH); g.stroke(); }
      }
      g.globalAlpha = 1;
      g.strokeStyle = v.base.light ? 'rgba(80,70,110,0.35)' : 'rgba(0,0,0,0.35)'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(FX, FH * 0.18); g.lineTo(FX, FH * 0.86); g.stroke();                 // centre seam
      g.beginPath(); g.moveTo(FX - 52, EYE_Y - 30); g.quadraticCurveTo(FX, EYE_Y - 14, FX + 52, EYE_Y - 30); g.stroke(); // brow line
      [-1, 1].forEach(side => {
        const cx = FX + side * 36, w = 29, h = 21;
        lensPath(g, cx, EYE_Y, w, h, side, v.shape);
        g.lineJoin = 'round'; g.strokeStyle = '#08080c'; g.lineWidth = 13; g.stroke();
        g.strokeStyle = v.rim; g.lineWidth = 7; g.stroke();
        const lg = g.createLinearGradient(cx, EYE_Y - h, cx, EYE_Y + h); lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, v.base.light ? '#e3def5' : '#cfd6e6');
        g.fillStyle = lg; g.fill();
        if (v.meshLens) { g.save(); g.clip(); g.fillStyle = 'rgba(40,40,60,0.22)'; for (let y = EYE_Y - h; y < EYE_Y + h; y += 4) for (let x = cx - w * 1.3; x < cx + w * 1.3; x += 4) g.fillRect(x + ((y / 4) % 2) * 2, y, 1.5, 1.5); g.restore(); }
        g.strokeStyle = '#08080c'; g.lineWidth = 1.5; g.stroke();
      });
    }
    const agentLooks = {};
    function agentLook(divId, color) {
      const list = agentLooks[divId] || (agentLooks[divId] = AGENT_BASES.map((base, i) => {
        const v = { base, rim: color, shape: AGENT_SHAPES[i % 3], pattern: AGENT_PATTERNS[(i + 1) % 3], meshLens: i % 2 === 0 };
        const tex = canvasTex(FW, FH, g => drawAgentFace(g, v));
        return {
          v, head: new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.16, roughness: 0.5, metalness: 0.12 }),
          hood: M(base.light ? 0xdedaea : 0x23252e, { roughness: 0.85, side: THREE.DoubleSide }),
          neck: M(css(base.c, 0.85).replace('#', '0x') * 1),
        };
      }));
      return pick(list);
    }
    // --- Adrian: midnight-navy integrated helmet, gold circuit lattice, forehead chevron, angular glowing cyan lenses
    function drawAdrianFace(g, glow) {
      if (glow) { g.fillStyle = '#000'; g.fillRect(0, 0, FW, FH); }
      else {
        const grd = g.createLinearGradient(0, 0, 0, FH); grd.addColorStop(0, '#1d2c58'); grd.addColorStop(0.55, '#111b3a'); grd.addColorStop(1, '#070c1e');
        g.fillStyle = grd; g.fillRect(0, 0, FW, FH);
        // gold circuit traces (avoid the lens area)
        const cr = U.seeded(7);
        g.strokeStyle = 'rgba(255,200,87,0.55)'; g.fillStyle = 'rgba(255,200,87,0.8)'; g.lineWidth = 2;
        for (let i = 0; i < 46; i++) {
          let x = cr() * FW, y = cr() * FH;
          if (Math.abs(x - FX) < 80 && Math.abs(y - EYE_Y) < 34) continue;
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 4; k++) { if (cr() < 0.5) x += (cr() - 0.5) * 70; else y += (cr() - 0.5) * 50; g.lineTo(x, y); }
          g.stroke(); g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill();
        }
        g.strokeStyle = 'rgba(255,200,87,0.85)'; g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(FX - 70, FH * 0.74); g.quadraticCurveTo(FX, FH * 0.84, FX + 70, FH * 0.74); g.stroke();       // jaw seam
        g.beginPath(); g.moveTo(FX, FH * 0.56); g.lineTo(FX - 10, FH * 0.66); g.lineTo(FX + 10, FH * 0.66); g.closePath(); g.stroke(); // nose plate
      }
      // forehead chevron ("A" mark)
      g.strokeStyle = glow ? '#6b4a10' : '#ffc857'; g.lineWidth = 5; g.lineJoin = 'miter';
      g.beginPath(); g.moveTo(FX - 16, FH * 0.3); g.lineTo(FX, FH * 0.17); g.lineTo(FX + 16, FH * 0.3); g.moveTo(FX - 8, FH * 0.26); g.lineTo(FX + 8, FH * 0.26); g.stroke();
      [-1, 1].forEach(side => {
        const cx = FX + side * 38, w = 33, h = 19;
        lensPath(g, cx, EYE_Y, w, h, side, 'sweep');
        if (!glow) { g.lineJoin = 'round'; g.strokeStyle = '#04060c'; g.lineWidth = 14; g.stroke(); g.strokeStyle = '#ffc857'; g.lineWidth = 4; g.stroke(); }
        const lg = g.createRadialGradient(cx, EYE_Y, 2, cx, EYE_Y, w * 1.2);
        lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.45, '#9ff6ff'); lg.addColorStop(1, '#00b8d4');
        g.fillStyle = lg; g.fill();
      });
    }
    const adrianTex = canvasTex(FW, FH, g => drawAdrianFace(g, false));
    const adrianGlow = canvasTex(FW, FH, g => drawAdrianFace(g, true));
    const ADRIAN_HEAD = new THREE.MeshStandardMaterial({ map: adrianTex, emissive: 0xffffff, emissiveMap: adrianGlow, emissiveIntensity: 1.15, roughness: 0.28, metalness: 0.5 });
    const ADRIAN_NECK = M(0x0d1430, { roughness: 0.4, metalness: 0.4 });

    const people = [];
    let nameIdx = 0;
    function person(parent, x, z, ry, meta) {
      const div = meta.division ? meta.division.id : '_';
      const shirt = M(meta.shirt || pick(SHIRT)), skin = M(pick(SKIN)), pants = M(meta.pants || pick(PANTS));
      const rootG = new THREE.Group(); rootG.position.set(x, 0, z); rootG.rotation.y = ry; rootG.scale.setScalar(meta.scale || 1.12); parent.add(rootG);
      const hips = new THREE.Group(); hips.position.y = 0.95; rootG.add(hips);
      const torso = new THREE.Mesh(PG.torso, shirt); hips.add(torso);
      const shoulders = new THREE.Mesh(PG.shoulders, shirt); shoulders.position.y = 0.6; hips.add(shoulders);
      if (meta.tie || rng() > 0.6) { const tie = new THREE.Mesh(PG.tie, M(meta.tie || pick(TIES))); tie.position.set(0, 0.42, 0.185); tie.rotation.x = -0.12; hips.add(tie); }
      const neck = new THREE.Group(); neck.position.y = 0.64; hips.add(neck);
      const look = meta.hero ? null : agentLook(div, meta.division ? meta.division.color : '#9fb4ff');
      const head = new THREE.Mesh(PG.face3, meta.hero ? ADRIAN_HEAD : look.head);
      head.position.y = 0.14; head.scale.set(1, 1.13, 1.04); neck.add(head);
      const neckM = new THREE.Mesh(PG.neckG, meta.hero ? ADRIAN_NECK : look.neck); neckM.position.y = 0.01; neck.add(neckM);
      let hood = null;
      if (look && (look.v.base.light || rng() < 0.3)) { hood = new THREE.Mesh(PG.hood, look.hood); hood.position.set(0, 0.145, -0.004); hood.scale.set(1, 1.12, 1.05); neck.add(hood); }
      const sh = [], el = [], th = [], kn = [];
      [1, -1].forEach(side => {
        const s = new THREE.Group(); s.position.set(0.25 * side, 0.57, 0); hips.add(s);
        s.add(new THREE.Mesh(limbGeo('up', 0.058, 0.052, 0.3), shirt));
        const e = new THREE.Group(); e.position.y = -0.3; s.add(e);
        e.add(new THREE.Mesh(limbGeo('fo', 0.05, 0.042, 0.28), shirt));
        const hnd = new THREE.Mesh(PG.head, skin); hnd.scale.set(0.4, 0.46, 0.32); hnd.position.y = -0.31; e.add(hnd);
        const t = new THREE.Group(); t.position.set(0.1 * side, 0, 0); hips.add(t);
        t.add(new THREE.Mesh(limbGeo('th', 0.085, 0.07, 0.45), pants));
        const k = new THREE.Group(); k.position.y = -0.45; t.add(k);
        k.add(new THREE.Mesh(limbGeo('sh', 0.066, 0.052, 0.45), pants));
        const shoe = new THREE.Mesh(PG.shoe, shoeMat); shoe.position.y = -0.45; k.add(shoe);
        sh.push(s); el.push(e); th.push(t); kn.push(k);
      });
      const doc = new THREE.Mesh(PG.doc, docMat); doc.position.set(0.0, 0.62, 0.36); doc.rotation.x = -0.9; doc.visible = false; hips.add(doc);
      const blob = new THREE.Mesh(PG.blob, blobMat); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02; rootG.add(blob);
      const p = Object.assign({
        root: rootG, hips, neck, head, sh, el, th, kn, doc, near: true, lod: [shoulders, neckM, blob, ...sh, ...th].concat(hood ? [hood] : []), ph: rng() * 10, act: 'idle', lookYaw: 0, side: rng() > 0.5 ? 1 : -1,
        name: meta.name || NAMES[nameIdx++ % NAMES.length], role: meta.role || pick(ROLES[div] || ROLES._),
      }, meta);
      torso.userData = head.userData = { type: 'person', p };
      pickables.fine.push(torso, head);
      people.push(p);
      return p;
    }
    function setRoutine(p, list) { p.routine = list; p.ri = 0; p.act = list[0][0]; p.until = rand(list[0][1], list[0][2]); }

    function pose(p, t) {
      const s = Math.sin, k = t + p.ph, a = p.act;
      const [shL, shR] = p.sh, [elL, elR] = p.el, [thL, thR] = p.th, [knL, knR] = p.kn;
      for (const g of [shL, shR, elL, elR, thL, thR, knL, knR, p.neck]) g.rotation.set(0, 0, 0);
      p.hips.rotation.set(0, 0, 0); p.doc.visible = false;
      p.hips.position.y = SEATED.has(a) ? 0.5 : 0.95;
      if (SEATED.has(a)) { thL.rotation.x = thR.rotation.x = -Math.PI / 2; knL.rotation.x = knR.rotation.x = Math.PI / 2; }
      if (a === 'type') {
        shL.rotation.x = shR.rotation.x = -0.55; shL.rotation.z = 0.1; shR.rotation.z = -0.1;
        elL.rotation.x = -1.0 + s(k * 13) * 0.09; elR.rotation.x = -1.0 + s(k * 13 + 1.7) * 0.09;
        p.neck.rotation.x = 0.1; p.neck.rotation.y = s(k * 0.35) * 0.28;
        if (s(k * 0.17) > 0.85) { elR.rotation.x = -1.35; shR.rotation.x = -0.25; } // reaches for the mouse / coffee
      } else if (a === 'read') {
        shL.rotation.x = shR.rotation.x = -0.75; shL.rotation.z = -0.22; shR.rotation.z = 0.22;
        elL.rotation.x = elR.rotation.x = -1.2; p.neck.rotation.x = 0.42 + s(k * 0.8) * 0.05; p.doc.visible = true;
        if (s(k * 0.5) > 0.92) elR.rotation.x = -1.6; // turns a page
      } else if (a === 'chat') {
        p.hips.rotation.y = 0.65 * p.side; p.neck.rotation.y = 0.35 * p.side;
        shR.rotation.x = -0.6 + s(k * 3) * 0.3; elR.rotation.x = -0.9; shL.rotation.x = -0.3; elL.rotation.x = -0.6;
        p.neck.rotation.x = s(k * 2.2) * 0.08;
      } else if (a === 'meet') {
        shL.rotation.x = shR.rotation.x = -0.55; elL.rotation.x = elR.rotation.x = -0.85;
        p.neck.rotation.y = p.lookYaw + s(k * 0.3) * 0.12; p.neck.rotation.x = Math.max(0, s(k * 1.7)) * 0.12;
        if (s(k * 0.23) > 0.8) { shR.rotation.x = -1.0 + s(k * 4) * 0.25; elR.rotation.x = -0.6; }
      } else if (a === 'present') {
        shR.rotation.x = -1.5 + s(k * 1.1) * 0.35; shR.rotation.z = -0.35; elR.rotation.x = -0.35;
        shL.rotation.x = -0.45 + s(k * 1.7) * 0.15; elL.rotation.x = -0.9;
        p.neck.rotation.y = s(k * 0.5) * 0.45; p.hips.rotation.y = s(k * 0.28) * 0.35;
      } else if (a === 'talk') {
        if (p.speaking) {
          shR.rotation.x = -0.7 + s(k * 3.1) * 0.35; elR.rotation.x = -1.0; shL.rotation.x = -0.5 + s(k * 2.5 + 1) * 0.25; elL.rotation.x = -0.9;
          p.neck.rotation.x = s(k * 2.3) * 0.07;
        } else {
          shL.rotation.x = shR.rotation.x = -0.32; elL.rotation.x = elR.rotation.x = -1.8; shL.rotation.z = -0.5; shR.rotation.z = 0.5;
          p.neck.rotation.x = Math.max(0, s(k * 1.4)) * 0.14;
        }
      } else if (a === 'analyse') {
        shR.rotation.x = -2.15 + s(k * 0.9) * 0.25; shR.rotation.z = s(k * 0.6) * 0.25; elR.rotation.x = -0.2;
        shL.rotation.x = -0.25; elL.rotation.x = -1.4; p.neck.rotation.x = -0.18; p.hips.rotation.y = s(k * 0.25) * 0.25;
      } else if (a === 'watch') {
        shL.rotation.x = shR.rotation.x = -0.35; elL.rotation.x = elR.rotation.x = -1.9; shL.rotation.z = -0.55; shR.rotation.z = 0.55;
        p.neck.rotation.y = s(k * 0.33) * 0.35; p.neck.rotation.x = -0.12;
        if (s(k * 0.21) > 0.75) { shR.rotation.set(-0.95, 0, 0.2); elR.rotation.x = -2.25; }
      } else if (a === 'walk') {
        const w = p.walkPhase;
        thL.rotation.x = s(w) * 0.5; thR.rotation.x = -s(w) * 0.5;
        knL.rotation.x = Math.max(0, -s(w)) * 0.8 + 0.05; knR.rotation.x = Math.max(0, s(w)) * 0.8 + 0.05;
        shL.rotation.x = -s(w) * 0.45; shR.rotation.x = s(w) * 0.45; elL.rotation.x = elR.rotation.x = -0.3;
        p.hips.position.y = 0.95 + Math.abs(Math.cos(w)) * 0.03;
      } else {
        p.neck.rotation.y = s(k * 0.4) * 0.5; shL.rotation.x = shR.rotation.x = -0.1; elL.rotation.x = elR.rotation.x = -0.25;
      }
    }

    // ---------------------------------------------------------------- furniture
    function plant(parent, x, z, h = 1.2) {
      box(parent, 0.6, 0.6, 0.6, x, 0.3, z, M(0xd9d4c7));
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62 * h, 0), M(0x2f6b3a, { flatShading: true }));
      f.position.set(x, 0.6 + 0.62 * h, z); f.scale.y = 1.35; parent.add(f);
    }
    function chair(parent, x, z, ry) {
      const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; parent.add(c);
      const dark = M(0x23272f);
      box(c, 0.54, 0.08, 0.52, 0, 0.5, 0, dark); box(c, 0.52, 0.65, 0.07, 0, 0.86, -0.25, dark);
      box(c, 0.06, 0.45, 0.06, 0, 0.24, 0, frameMat); box(c, 0.58, 0.04, 0.08, 0, 0.04, 0, frameMat); box(c, 0.08, 0.04, 0.58, 0, 0.04, 0, frameMat);
      return c;
    }
    const MON_TITLES = { line: 'VNINDEX · 1D', candle: 'PRICE ACTION', table: 'WATCHLIST', news: 'NEWS FEED', heat: 'SECTOR HEATMAP', terminal: 'AGENT LOG' };
    function drawMonitor(kind) {
      return (g, w, h, t) => {
        g.fillStyle = '#0a1120'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#17223d'; g.fillRect(0, 0, w, 18);
        g.fillStyle = '#7f8fc0'; g.font = `11px ${MONO}`; g.fillText(MON_TITLES[kind], 8, 13);
        const s = Math.floor(t * 2);
        if (kind === 'line') {
          [['#3dd6ff', 0], ['#ff6b9a', 7]].forEach(([col, o]) => {
            g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
            for (let i = 0; i < 48; i++) { const v = Math.sin((i + s) * 0.35 + o) * 18 + (rr(i + s + o) - 0.5) * 16 + 90 - i * 0.6; i ? g.lineTo(i * (w / 47), v) : g.moveTo(0, v); }
            g.stroke();
          });
        } else if (kind === 'candle') {
          let y = 90;
          for (let i = 0; i < 22; i++) {
            const d = (rr(i + s) - 0.48) * 22; g.fillStyle = d < 0 ? '#3dffb5' : '#ff4f8b';
            g.fillRect(8 + i * 11, Math.min(y, y + d), 7, Math.abs(d) + 2); g.fillRect(11 + i * 11, Math.min(y, y + d) - 6, 1, Math.abs(d) + 14);
            y = Math.max(40, Math.min(140, y + d));
          }
        } else if (kind === 'table') {
          g.font = `12px ${MONO}`;
          ['VCB', 'FPT', 'HPG', 'TCB', 'MBB', 'VIC', 'SSI'].forEach((sym, i) => {
            const ch = (rr(i * 3 + s) - 0.45) * 4;
            g.fillStyle = '#cfd6ff'; g.fillText(sym, 10, 38 + i * 18); g.fillText((20 + rr(i) * 90).toFixed(2), 80, 38 + i * 18);
            g.fillStyle = dirCol(ch); g.fillText((ch >= 0 ? '+' : '') + ch.toFixed(2) + '%', 170, 38 + i * 18);
          });
        } else if (kind === 'news') {
          for (let i = 0; i < 7; i++) { g.fillStyle = i === s % 7 ? '#3dd6ff' : '#3a4870'; g.fillRect(10, 30 + i * 18, 60 + rr(i + 9) * 160, 8); }
        } else if (kind === 'heat') {
          for (let i = 0; i < 40; i++) { const v = rr(i + s * 0.5) - 0.5; g.fillStyle = v >= 0 ? `rgba(61,255,181,${0.25 + v})` : `rgba(255,79,139,${0.25 - v})`; g.fillRect(8 + (i % 8) * 30, 26 + Math.floor(i / 8) * 26, 27, 23); }
        } else {
          g.font = `11px ${MONO}`;
          for (let i = 0; i < 8; i++) { g.fillStyle = i === 7 ? '#3dffb5' : '#5f7a6a'; g.fillText(`> ${['classify', 'dedupe', 'summarise', 'score', 'fetch'][(i + s) % 5]} … ok ${Math.floor(rr(i + s) * 900)}ms`, 8, 34 + i * 16); }
        }
      };
    }
    const monTex = Object.keys(MON_TITLES).map(k => canvasTex(256, 160, drawMonitor(k), 0.9));
    const lodItems = [];
    function workstation(parent, x, z, ry, meta) {
      const g0 = new THREE.Group(); g0.position.set(x, 0, z); g0.rotation.y = ry; parent.add(g0);
      box(g0, 1.8, 0.05, 0.85, 0, 0.75, 0.45, M(0xe9ecf1, { roughness: 0.5 }));
      const g = new THREE.Group(); g0.add(g); lodItems.push({ obj: g, anchor: g0, near: true }); // details hidden when far
      box(g, 0.05, 0.73, 0.75, -0.85, 0.365, 0.45, frameMat); box(g, 0.05, 0.73, 0.75, 0.85, 0.365, 0.45, frameMat);
      box(g, 1.7, 0.42, 0.03, 0, 0.5, 0.86, M(0xcfd4dc));
      box(g, 1.8, 0.5, 0.04, 0, 1.03, 0.9, M(0x8fa0b8, { transparent: true, opacity: 0.35 })); // desk divider
      [-0.36, 0.36].forEach((mx, i) => {
        box(g, 0.66, 0.42, 0.03, mx, 1.12, 0.74, M(0x111418));
        const sm = screenMesh(g, 0.62, 0.38, pick(monTex), mx, 1.12, 0.722, Math.PI);
        sm.rotation.y = Math.PI + (i ? -0.15 : 0.15);
        box(g, 0.04, 0.22, 0.04, mx, 0.88, 0.78, frameMat);
      });
      box(g, 0.46, 0.02, 0.15, 0, 0.785, 0.32, M(0x2a2e36));
      if (rng() > 0.5) box(g, 0.08, 0.1, 0.08, 0.66, 0.82, 0.3, M(pick([0xffffff, 0x3a6ea5, 0xb03a48])));
      if (rng() > 0.6) box(g, 0.3, 0.02, 0.22, -0.62, 0.785, 0.28, docMat);
      chair(g, 0, -0.18, 0);
      const p = person(g0, 0, -0.18, 0, meta);
      p.station = g0;
      setRoutine(p, pick([
        [['type', 7, 13], ['read', 4, 7], ['type', 6, 10], ['chat', 3, 5]],
        [['read', 5, 8], ['type', 6, 11], ['chat', 3, 5], ['type', 5, 9]],
        [['type', 10, 16], ['chat', 3, 5], ['type', 8, 12], ['read', 3, 6]],
      ]));
      return p;
    }

    // ---------------------------------------------------------------- division identity (data walls, desk visualisations)
    const ILLU = 'ILLUSTRATIVE DATA';
    const corpRows = { cols: ['FPT', 'VCB', 'VIC', 'HPG', 'VNM', 'MWG'], rev: [18, 9, 22, 6, 4, 12], prof: [19, 5, 35, -8, 2, 15] };
    const macroTiles = [
      ['VN GDP growth', '7.1%', '+0.3pp YoY', 1], ['VN CPI', '3.2%', 'Oct, YoY', 0], ['SBV refinancing', '4.50%', 'unchanged', 0], ['USD/VND', U.fmtNum((data.fx[0] || {}).price || 26352, 0), U.fmtPct((data.fx[0] || {}).changePct || 0), (data.fx[0] || {}).changePct >= 0 ? 1 : -1],
      ['Exports YTD', '+14%', 'record high', 1], ['Fed funds', '4.25%', 'on hold', 0], ['ECB deposit', '2.00%', 'on hold', 0], ['US CPI', '3.0%', 'above forecast', -1],
    ];
    const policyRates = [['Fed', 4.25], ['ECB', 2.0], ['BOJ', 0.75], ['BoE', 4.0], ['PBoC', 3.0], ['SBV', 4.5]];
    const newsOf = (key, val, n = 8) => data.news.filter(x => x[key] === val).slice(0, n);

    function divisionDashboard(d, col) {
      const C = hex(col);
      return (g, w, h, t) => {
        const fs = glass(g, w, h, C, `${d.nameEn} — Intelligence Wall`, `${ILLU} · UPDATED ${new Date().toLocaleTimeString('en-GB')}`);
        const top = h * 0.2, scan = (t * 0.12) % 1;
        g.fillStyle = 'rgba(0,229,255,0.05)'; g.fillRect(0, top + scan * (h - top), w, 18);
        const panel = (x, y, pw, ph, title) => { g.fillStyle = 'rgba(10,22,54,0.7)'; roundRect(g, x, y, pw, ph, 16); g.fill(); g.strokeStyle = 'rgba(120,150,255,0.25)'; g.lineWidth = 2; roundRect(g, x, y, pw, ph, 16); g.stroke(); g.fillStyle = '#9fb0de'; g.font = `600 ${fs * 0.5}px ${FONT}`; g.fillText(title, x + 20, y + fs * 0.75); };
        const items = n => n.map(x => x);
        if (d.id === 'corporate') {
          panel(w * 0.02, top, w * 0.46, h * 0.74, 'Revenue vs profit growth (YoY, %)');
          const bx = w * 0.05, by = top + h * 0.66, bw = w * 0.4, mx = 40;
          corpRows.cols.forEach((c, i) => {
            const x = bx + i * (bw / 6);
            [[corpRows.rev[i], C], [corpRows.prof[i], '#ffc857']].forEach(([v, cc], j) => {
              const hh = (Math.abs(v) / mx) * h * 0.4 * (1 + Math.sin(t + i + j) * 0.02);
              g.fillStyle = v < 0 ? '#ff4f8b' : cc; g.fillRect(x + j * bw / 16, by - hh, bw / 18, hh);
            });
            g.fillStyle = '#dfe7ff'; g.font = `700 ${fs * 0.5}px ${MONO}`; g.fillText(c, x, by + fs * 0.7);
          });
          panel(w * 0.5, top, w * 0.48, h * 0.42, 'Corporate events feed');
          newsOf('divisionId', 'corporate', 4).forEach((n, i) => { g.fillStyle = i === Math.floor(t / 3) % 4 ? '#ffffff' : '#aab6dd'; g.font = `500 ${fs * 0.46}px ${FONT}`; g.fillText(fit(g, n.headline, w * 0.44), w * 0.52, top + fs * 1.6 + i * fs * 0.85); });
          panel(w * 0.5, top + h * 0.45, w * 0.48, h * 0.29, 'M&A & investment tracker');
          data.news.filter(n => ['M&A', 'Investment'].includes(n.category)).slice(0, 3).forEach((n, i) => { g.fillStyle = C; g.font = `700 ${fs * 0.44}px ${MONO}`; g.fillText((n.markets[0] || '—').padEnd(6), w * 0.52, top + h * 0.45 + fs * 1.5 + i * fs * 0.8); g.fillStyle = '#cfd6ff'; g.font = `500 ${fs * 0.44}px ${FONT}`; g.fillText(fit(g, n.headline, w * 0.38), w * 0.58, top + h * 0.45 + fs * 1.5 + i * fs * 0.8); });
        } else if (d.id === 'macro') {
          macroTiles.forEach(([lbl, val, sub, dir], i) => {
            const x = w * 0.02 + (i % 4) * w * 0.155, y = top + Math.floor(i / 4) * h * 0.37;
            panel(x, y, w * 0.145, h * 0.34, lbl);
            g.fillStyle = '#ffffff'; g.font = `800 ${fs * 1.15}px ${MONO}`; g.fillText(val, x + 20, y + h * 0.2);
            g.fillStyle = dir > 0 ? '#3dffb5' : dir < 0 ? '#ff4f8b' : '#a5aed8'; g.font = `600 ${fs * 0.45}px ${MONO}`; g.fillText(sub, x + 20, y + h * 0.28);
          });
          panel(w * 0.645, top, w * 0.335, h * 0.74, 'Policy rates — world (%)');
          policyRates.forEach(([n, v], i) => { const y = top + fs * 1.6 + i * h * 0.1, bw = (v / 5) * w * 0.22; g.fillStyle = '#dfe7ff'; g.font = `700 ${fs * 0.5}px ${MONO}`; g.fillText(n, w * 0.66, y + fs * 0.4); g.fillStyle = C; g.fillRect(w * 0.71, y, bw * (1 + Math.sin(t + i) * 0.01), fs * 0.5); g.fillStyle = '#ffffff'; g.fillText(v.toFixed(2), w * 0.72 + bw, y + fs * 0.4); });
        } else if (d.id === 'market') {
          [['VNINDEX', 'VN-Index'], ['SPX', 'S&P 500'], ['XAUUSD', 'Gold'], ['BRENT', 'Brent']].forEach(([sym, nm], i) => {
            const x = w * 0.02 + (i % 2) * w * 0.49, y = top + Math.floor(i / 2) * h * 0.38;
            panel(x, y, w * 0.47, h * 0.35, nm);
            const q = data.ticker.find(z => z.symbol === sym) || data.comm.find(z => z.symbol === sym);
            const vals = (data.hist[sym] || []).slice(-50 + Math.floor(t) % 10);
            if (vals.length > 2) spark(g, x + w * 0.2, y + h * 0.06, w * 0.25, h * 0.25, vals, dirCol(q ? q.changePct : 0), true);
            if (q) { g.fillStyle = '#ffffff'; g.font = `800 ${fs * 0.95}px ${MONO}`; g.fillText(U.fmtNum(q.price, q.dp), x + 20, y + h * 0.2); g.fillStyle = dirCol(q.changePct); g.font = `600 ${fs * 0.55}px ${MONO}`; g.fillText(`${U.arrow(q.changePct)} ${U.fmtPct(q.changePct)}`, x + 20, y + h * 0.28); }
          });
        } else if (d.id === 'banking' && data.rates && data.funds) {
          panel(w * 0.02, top, w * 0.31, h * 0.74, 'Average deposit rate curve (% p.a.)');
          const curve = data.rates.terms.map(tm => data.rates.banks.reduce((s, b) => s + b.deposit[tm], 0) / data.rates.banks.length);
          spark(g, w * 0.04, top + h * 0.14, w * 0.27, h * 0.45, curve, C, true);
          g.font = `600 ${fs * 0.42}px ${MONO}`; g.fillStyle = '#9fb0de';
          data.rates.terms.forEach((tm, i) => g.fillText(tm, w * 0.04 + (i / (curve.length - 1)) * w * 0.26, top + h * 0.66));
          panel(w * 0.345, top, w * 0.31, h * 0.74, 'Credit growth YTD (%)');
          data.funds.banks.slice(0, 8).forEach((b, i) => { const y = top + fs * 1.5 + i * h * 0.065, bw = (b.creditGrowth / 22) * w * 0.2; g.fillStyle = '#dfe7ff'; g.font = `700 ${fs * 0.42}px ${MONO}`; g.fillText(b.bankId, w * 0.36, y + fs * 0.35); g.fillStyle = b.group === 'state' ? '#ffc857' : C; g.fillRect(w * 0.41, y, bw, fs * 0.42); });
          panel(w * 0.67, top, w * 0.31, h * 0.74, 'Asset quality — NPL ratio (%)');
          [...data.funds.banks].sort((a, b) => b.npl - a.npl).slice(0, 8).forEach((b, i) => { const y = top + fs * 1.5 + i * h * 0.065; g.fillStyle = '#dfe7ff'; g.font = `700 ${fs * 0.42}px ${MONO}`; g.fillText(b.bankId, w * 0.69, y + fs * 0.35); g.fillStyle = b.npl > 2 ? '#ff4f8b' : '#3dffb5'; g.fillText(b.npl.toFixed(2) + '%', w * 0.75, y + fs * 0.35); g.fillStyle = '#6f80b5'; g.fillText(`coverage ${b.llr}%`, w * 0.83, y + fs * 0.35); });
        } else {
          d.departments.forEach((p, i) => { const m = metrics[p.id]; panel(w * 0.02 + i * w * 0.32, top, w * 0.3, h * 0.4, p.name); g.fillStyle = '#ffffff'; g.font = `700 ${fs * 0.7}px ${MONO}`; g.fillText(m.main, w * 0.04 + i * w * 0.32, top + h * 0.2); });
        }
        void items;
      };
    }
    function tickerItems(d) {
      if (d.id === 'corporate') return data.stocks.map(q => [`${q.symbol} ${U.fmtNum(q.price, q.dp)} ${U.fmtPct(q.changePct)}`, q.changePct]);
      if (d.id === 'macro') return macroTiles.map(x => [`${x[0]} ${x[1]} · ${x[2]}`, x[3]]).concat(policyRates.map(([n, v]) => [`${n} ${v.toFixed(2)}%`, 0]));
      if (d.id === 'banking' && data.rates) return data.rates.banks.map(b => [`${b.bankId} 12M ${b.deposit['12M'].toFixed(2)}% · mortgage ${b.lending.home.toFixed(2)}%`, 0]);
      if (d.id === 'market') return data.ticker.map(q => [`${q.name} ${U.fmtNum(q.price, q.dp)} ${U.arrow(q.changePct)}${U.fmtPct(q.changePct)}`, q.changePct]);
      return d.departments.map(p => [`${p.name}: ${metrics[p.id].main}`, 0]);
    }
    function tickerDraw(items, color) {
      return (g, w, h, t) => {
        g.fillStyle = '#050916'; g.fillRect(0, 0, w, h);
        g.fillStyle = color; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
        g.font = `700 ${Math.round(h * 0.5)}px ${MONO}`;
        const widths = items.map(i => g.measureText(i[0]).width + 110), total = widths.reduce((a, b) => a + b, 0) || 1;
        let x = -((t * 120) % total);
        for (let rep = 0; rep < 4 && x < w; rep++) items.forEach((it, i) => { if (x < w && x + widths[i] > 0) { g.fillStyle = it[1] > 0 ? '#3dffb5' : it[1] < 0 ? '#ff4f8b' : '#dfe7ff'; g.fillText('◆ ' + it[0], x, h * 0.68); } x += widths[i]; });
      };
    }
    /** The 3D visualisation that sits on a desk's holo-table. Unknown desks get a generic metric panel. */
    function deskViz(top, p, d, col) {
      const C = hex(col), m = metrics[p.id];
      const pickD = { title: p.name, desc: '', division: d, dept: p };
      const rates = data.rates, funds = data.funds;
      switch (p.id) {
        case 'vn-corporate':
          pickD.desc = 'Revenue and profit growth of tracked Vietnamese companies (YoY, illustrative).';
          return holoBars(top, corpRows.cols, [{ name: 'Revenue growth', values: corpRows.rev, color: col }, { name: 'Profit growth', values: corpRows.prof, color: 0xffc857 }]);
        case 'global-corporate': {
          const g = holoBars(top, ['NVDA', 'MSFT', 'GOOGL', 'AAPL', 'TSLA', 'META'], [{ name: 'Earnings surprise %', values: [12, 4, 6, 3, -5, 2], color: col }], { h: 2 });
          const f = feedPanel(top, 3.6, 2.2, 'Global corporate events', newsOf('departmentId', 'global-corporate'), C, { title: 'Global corporate events', desc: 'Live feed of global corporate news.', division: d, dept: p });
          f.position.set(0, 3.6, -0.6);
          return g;
        }
        case 'vn-macro':
          return holoGauges(top, [
            { label: 'GDP growth', value: 7.1, max: 10, text: '7.1%', color: 0x3dffb5 }, { label: 'CPI', value: 3.2, max: 6, text: '3.2%', color: 0xffc857 },
            { label: 'Policy rate', value: 4.5, max: 8, text: '4.50%', color: col }, { label: 'Credit growth', value: 13, max: 20, text: '13%', color: 0x5aa9ff },
          ]);
        case 'global-macro':
          return holoGlobe(top, [
            { lat: 38, lon: -97, value: 4.25, max: 5, label: 'Fed 4.25%', color: '#00e5ff' }, { lat: 50, lon: 10, value: 2.0, max: 5, label: 'ECB 2.00%', color: '#8b5cff' },
            { lat: 36, lon: 138, value: 0.75, max: 5, label: 'BOJ 0.75%', color: '#ffc857' }, { lat: 54, lon: -2, value: 4.0, max: 5, label: 'BoE 4.00%', color: '#3dffb5' },
            { lat: 35, lon: 104, value: 3.0, max: 5, label: 'PBoC 3.00%', color: '#ff4f8b' }, { lat: 16, lon: 107, value: 4.5, max: 5, label: 'SBV 4.50%', color: '#ff3ec9' },
          ]);
        case 'vn-equities': case 'us-equities': {
          const sym = p.id === 'vn-equities' ? 'VNINDEX' : 'SPX';
          const q = data.ticker.find(z => z.symbol === sym);
          return holoLine(top, data.hist[sym], dirCol(q.changePct), { title: q.name, sub: `${U.fmtNum(q.price, q.dp)} ${U.fmtPct(q.changePct)}`, subColor: dirCol(q.changePct) });
        }
        case 'fx':
          return holoCarousel(top, data.fx.map(q => ({ title: q.name, value: U.fmtNum(q.price, q.dp), sub: `${U.arrow(q.changePct)} ${U.fmtPct(q.changePct)}`, dir: U.dir(q.changePct) })), C);
        case 'commodities': {
          const ch = data.comm.map(q => { const h = data.hist[q.symbol] || [q.price]; return +(((h[h.length - 1] - h[0]) / h[0]) * 100).toFixed(1); });
          return holoBars(top, data.comm.map(q => q.name.split(' ')[0]), [{ name: '3M change %', values: ch, color: col }]);
        }
        case 'bank-rates':
          if (rates) {
            const banks = ['VCB', 'BIDV', 'CTG', 'TCB', 'VPB', 'HDB'].map(id => rates.banks.find(b => b.bankId === id)).filter(Boolean);
            const terms = ['3M', '6M', '12M', '24M'], cols2 = [0x5aa9ff, 0x8b5cff, col, 0xffc857];
            return holoBars(top, banks.map(b => b.bankId), terms.map((tm, i) => ({ name: `${tm} deposit`, values: banks.map(b => b.deposit[tm]), color: cols2[i] })), { step: 0.75, h: 2.6 });
          }
          break;
        case 'vn-banks':
          if (funds) {
            const bs = funds.banks.slice(0, 8);
            return holoBars(top, bs.map(b => b.bankId), [{ name: 'ROE %', values: bs.map(b => b.roe), color: col }, { name: 'NPL %', values: bs.map(b => b.npl), color: 0xffc857 }, { name: 'CAR %', values: bs.map(b => b.car), color: 0x5aa9ff }], { step: 0.8 });
          }
          break;
        default: break;
      }
      return holoPanel(top, 3.6, 2, (g, w, h) => { const fs = glass(g, w, h, C, p.name, `${p.agent.name} · ${p.agent.code}`); g.fillStyle = '#fff'; g.font = `700 ${fs}px ${MONO}`; g.fillText(m.main, w * 0.06, h * 0.62); g.fillStyle = '#9fb0de'; g.font = `600 ${fs * 0.7}px ${MONO}`; g.fillText(m.sub, w * 0.06, h * 0.8); }, 0, { color: C, pick: pickD });
    }

    // ---------------------------------------------------------------- layout
    const C = 7, WING_W = 40, POD = 16;
    const LOBBY_W = 64, LOBBY_D = 44, lobbyZ = 6 + LOBBY_D / 2;
    const wings = [], depts = {};
    let zCursor = 0;
    const rows = [];
    for (let r = 0; r * 2 < divisions.length; r++) {
      const pair = divisions.slice(r * 2, r * 2 + 2);
      const depth = Math.max(...pair.map(d => d.departments.length * POD + 24));
      rows.push({ z: zCursor - depth / 2, depth, pair });
      zCursor -= depth + 6;
    }
    const floorDepth = -zCursor;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(WING_W * 2 + C * 2 + 24, floorDepth + LOBBY_D + 30), M(0x161b25, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -0.01, (6 + LOBBY_D - floorDepth) / 2); scene.add(floor);
    const corridor = new THREE.Mesh(new THREE.PlaneGeometry(C * 2, floorDepth + 6), M(0x2a303c, { roughness: 0.3, metalness: 0.25 }));
    corridor.rotation.x = -Math.PI / 2; corridor.position.set(0, 0.01, -floorDepth / 2 + 3); scene.add(corridor);
    for (let z = 2; z > zCursor; z -= 10) box(scene, 0.16, 0.02, 3, 0, 0.02, z - 5, M(0x5a6680, { emissive: 0x23324f }));
    // ---------------------------------------------------------------- financial district (background only)
    // Wall Street / Lower Manhattan inspired night skyline. Towers stay outside the HQ footprint and out of the
    // overview camera's line of sight so the headquarters remains the focal point.
    const district = new THREE.Group(); scene.add(district);
    const hqCenter = new THREE.Vector3(0, 0, (6 + LOBBY_D - floorDepth) / 2);
    // sky dome: deep navy zenith → hazy blue/violet horizon glow
    const skyTex = canvasTex(32, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#02040b'); grd.addColorStop(0.55, '#060b1c'); grd.addColorStop(0.78, '#101a3c'); grd.addColorStop(0.9, '#1e1a46'); grd.addColorStop(1, '#0c1020');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.position.copy(hqCenter); district.add(sky);
    const stars = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) { const a = rng() * Math.PI * 2, el = rand(0.35, 1.45); stars.set([Math.cos(a) * Math.cos(el) * 1500, Math.sin(el) * 1500, Math.sin(a) * Math.cos(el) * 1500 + hqCenter.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    district.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.55 })));
    // streets: a dark ground plane with a faint block grid and light trails
    const streetTex = canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#05070e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#0d1426'; g.fillRect(0, 0, w, 34); g.fillRect(0, 0, 34, h);
      g.fillStyle = 'rgba(255,190,110,0.35)'; for (let i = 0; i < w; i += 24) g.fillRect(i, 16, 10, 2);
      g.fillStyle = 'rgba(120,170,255,0.3)'; for (let i = 0; i < h; i += 24) g.fillRect(16, i, 2, 10);
    });
    streetTex.wrapS = streetTex.wrapT = THREE.RepeatWrapping; streetTex.repeat.set(36, 36);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(3600, 3600), new THREE.MeshStandardMaterial({ color: 0x0b0f1a, map: streetTex, emissive: 0xffffff, emissiveMap: streetTex, emissiveIntensity: 0.45, roughness: 0.6, metalness: 0.3 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(hqCenter.x, -0.08, hqCenter.z); district.add(ground);
    // curtain-wall façades: floor bands, mullions, partially lit office floors, glass reflection
    function facadeCanvas(style) {
      return (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, w, h);
        grd.addColorStop(0, style === 'blue' ? '#0e1a34' : '#0c1424'); grd.addColorStop(1, '#05080f');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        const floors = 16, bays = style === 'fins' ? 10 : 6, fh = h / floors, bw = w / bays;
        for (let f = 0; f < floors; f++) {
          const busy = rng() < (style === 'warm' ? 0.42 : 0.3);
          const tone = style === 'blue' ? '#9cc8ff' : style === 'warm' ? '#ffd9a0' : rng() < 0.5 ? '#ffe6bf' : '#cfe0ff';
          for (let c = 0; c < bays; c++) {
            if (rng() < (busy ? 0.78 : 0.07)) {
              g.globalAlpha = 0.35 + rng() * 0.5; g.fillStyle = tone;
              g.fillRect(c * bw + 2, f * fh + fh * 0.12, bw - 4, fh * 0.64);
            }
          }
          g.globalAlpha = 1; g.fillStyle = '#0a0f1b'; g.fillRect(0, f * fh + fh * 0.78, w, fh * 0.22); // spandrel band
        }
        g.fillStyle = style === 'fins' ? 'rgba(170,195,240,0.28)' : 'rgba(140,170,230,0.12)';
        for (let c = 0; c <= bays; c++) g.fillRect(c * bw - 1, 0, style === 'fins' ? 3 : 2, h);  // mullions / fins
        const refl = g.createLinearGradient(0, 0, w, 0);
        refl.addColorStop(0, 'rgba(120,160,255,0.10)'); refl.addColorStop(0.5, 'rgba(120,160,255,0)'); refl.addColorStop(1, 'rgba(120,160,255,0.05)');
        g.fillStyle = refl; g.fillRect(0, 0, w, h);
      };
    }
    const FACADES = { grid: canvasTex(256, 512, facadeCanvas('grid')), fins: canvasTex(256, 512, facadeCanvas('fins')), blue: canvasTex(256, 512, facadeCanvas('blue')), warm: canvasTex(256, 512, facadeCanvas('warm')) };
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x0a0d16, roughness: 0.8, metalness: 0.4 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x8a93a8, metalness: 0.8, roughness: 0.3 });
    const TINTS = [0x16203a, 0x1a2440, 0x121a2e, 0x1d2742];
    const ACCENTS = [0x00e5ff, 0x3f7bff, 0x8b5cff, 0xff3ec9];
    const beacons = [];
    const at = (m, y) => { m.position.y = y; return m; };
    function facade(style, w, h) {
      const tex = FACADES[style].clone(); tex.needsUpdate = true;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 40)));
      return new THREE.MeshStandardMaterial({ color: pick(TINTS), emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.62, roughness: 0.18, metalness: 0.7 });
    }
    function crownLines(parent, geo, y, col) {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
      l.position.y = y; parent.add(l);
    }
    function beacon(parent, y) {
      const bl = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2b3a, fog: false }));
      bl.position.y = y; parent.add(bl); beacons.push({ m: bl, ph: rng() * 6 });
    }
    function spire(parent, y, h) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.4, h, 8), steelMat); sp.position.y = y + h / 2; parent.add(sp);
      beacon(parent, y + h + 0.8);
    }
    /** Tower archetypes: glass slab, art-deco setback, chamfered octagon, tapered obelisk, round tower with fins. */
    const TYPES = {
      slab(t, s, h) {
        const w = s * 1.25, d = s * 0.7, m = facade(pick(['grid', 'fins', 'warm']), w, h);
        t.add(at(new THREE.Mesh(boxGeo(w, h, d), [m, m, roofMat, roofMat, m, m]), h / 2));
        const mech = new THREE.Mesh(boxGeo(w * 0.5, 6, d * 0.6), roofMat); mech.position.y = h + 3; t.add(mech);
        if (rng() < 0.4) crownLines(t, boxGeo(w + 0.4, 0.2, d + 0.4), h, pick(ACCENTS));
        return h + 6;
      },
      setback(t, s, h) {
        let y = 0, w = s, style = pick(['grid', 'warm', 'blue']);
        [0.5, 0.3, 0.2].forEach((f, i) => {
          const sh = h * f, m = facade(style, w, sh);
          t.add(at(new THREE.Mesh(boxGeo(w, sh, w), [m, m, roofMat, roofMat, m, m]), y + sh / 2));
          if (i < 2) crownLines(t, boxGeo(w + 0.3, 0.15, w + 0.3), y + sh, 0x9fb4ff);
          y += sh; w *= 0.72;
        });
        crownLines(t, boxGeo(w / 0.72 + 0.5, 3, w / 0.72 + 0.5), y - 1.5, pick(ACCENTS));
        if (h > 140) spire(t, y, rand(18, 34));
        return y;
      },
      octa(t, s, h) {
        const r = s * 0.62, m = facade(pick(['fins', 'blue', 'grid']), r * 5, h);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r, h, 8, 1, true), m); body.position.y = h / 2; t.add(body);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.9, 8, 8), roofMat); cap.position.y = h + 4; t.add(cap);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.35, 6, 8), new THREE.MeshBasicMaterial({ color: pick(ACCENTS), transparent: true, opacity: 0.6 }));
        ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 8; ring.position.y = h; t.add(ring);
        if (h > 150) spire(t, h + 8, rand(16, 30));
        return h + 8;
      },
      obelisk(t, s, h) {
        const m = facade(pick(['blue', 'grid']), s * 2.6, h);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.34, s * 0.78, h, 4, 1, true), m);
        body.rotation.y = Math.PI / 4; body.position.y = h / 2; t.add(body);
        const top = new THREE.Mesh(boxGeo(s * 0.5, 4, s * 0.5), roofMat); top.position.y = h + 2; t.add(top);
        crownLines(t, boxGeo(s * 0.52, 4, s * 0.52), h + 2, 0x00e5ff);
        spire(t, h + 4, rand(30, 60));
        return h + 4;
      },
      round(t, s, h) {
        const r = s * 0.58, m = facade('fins', r * 6, h);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.94, r, h, 24, 1, true), m); body.position.y = h / 2; t.add(body);
        const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.94, 24), roofMat); cap.rotation.x = -Math.PI / 2; cap.position.y = h; t.add(cap);
        const halo = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.3, 6, 32), new THREE.MeshBasicMaterial({ color: pick(ACCENTS), transparent: true, opacity: 0.55 }));
        halo.rotation.x = Math.PI / 2; halo.position.y = h - 1; t.add(halo);
        if (rng() < 0.5) { const heli = new THREE.Mesh(new THREE.RingGeometry(r * 0.35, r * 0.42, 24), new THREE.MeshBasicMaterial({ color: 0xffc857, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })); heli.rotation.x = -Math.PI / 2; heli.position.y = h + 0.2; t.add(heli); }
        return h;
      },
    };
    const placed = [];
    function tower(x, z, s, h, type) {
      if (placed.some(q => Math.hypot(q[0] - x, q[1] - z) < (q[2] + s) * 0.9)) return false;
      placed.push([x, z, s]);
      const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = rand(-0.3, 0.3); district.add(t);
      TYPES[type || pick(['slab', 'setback', 'octa', 'round', 'slab', 'setback', 'obelisk'])](t, s, h);
      return true;
    }
    // depth bands around the HQ; near/mid bands keep the camera sector (+z) clear
    const clearHalf = 0.7;
    [[190, 270, 9, 24, 60, 110], [280, 420, 14, 30, 110, 200], [440, 680, 14, 38, 150, 270]].forEach(([r0, r1, n, size, hMin, hMax], band) => {
      let made = 0, tries = 0;
      while (made < n && tries++ < n * 8) {
        const a = rng() * Math.PI * 2, front = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
        if (band < 2 && front < clearHalf) continue;
        const r = rand(r0, r1);
        if (tower(hqCenter.x + Math.sin(a) * r * 1.15, hqCenter.z + Math.cos(a) * r, size * rand(0.85, 1.25), rand(hMin, hMax) * (front < clearHalf ? 0.55 : 1))) made++;
      }
    });
    // landmark supertalls behind the HQ (opposite the camera)
    [[-160, -340, 380, 'obelisk'], [130, -390, 430, 'setback'], [-10, -480, 470, 'octa'], [270, -270, 300, 'round'], [-290, -240, 320, 'setback']]
      .forEach(([x, z, h, type]) => tower(hqCenter.x + x, hqCenter.z + z, 44, h, type));
    // horizon city glow
    const glowTex = canvasTex(256, 256, (g, w, h) => { const rg = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); rg.addColorStop(0, 'rgba(90,120,255,0.55)'); rg.addColorStop(0.5, 'rgba(120,70,200,0.18)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h); });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
      gs.scale.set(900, 260, 1); gs.position.set(hqCenter.x + Math.sin(a) * 900, 60, hqCenter.z + Math.cos(a) * 900); district.add(gs);
    }
    if (!reduceMotion) animators.push(t => { beacons.forEach(b => { b.m.visible = Math.sin(t * 2.2 + b.ph) > 0.4; }); });
    // ambient city light spilling onto the HQ (cool rim from behind, faint magenta fill)
    const rim = new THREE.DirectionalLight(0x6f8cff, 0.35); rim.position.set(-80, 60, -260); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xb06cff, 0.12); fill.position.set(220, 40, 60); scene.add(fill);

    // ---------------------------------------------------------------- lobby + intelligence hub
    const lobby = new THREE.Group(); lobby.position.set(0, 0, lobbyZ); scene.add(lobby);
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(LOBBY_W, LOBBY_D), M(0x2b3140, { roughness: 0.2, metalness: 0.3 }));
    lf.rotation.x = -Math.PI / 2; lf.position.y = 0.012; lobby.add(lf);
    // reception
    box(lobby, 10, 1.15, 1.4, 0, 0.58, 15, M(0xece9e2, { roughness: 0.4 }));
    box(lobby, 10.2, 0.08, 1.6, 0, 1.18, 15, M(0x8a6a4a, { roughness: 0.5 }));
    box(lobby, 10, 0.14, 0.05, 0, 0.92, 15.72, M(0x00e5ff, { emissive: 0x00a6c0 }));
    [-2.2, 2.2].forEach(x => { chair(lobby, x, 13.9, 0); const r = person(lobby, x, 13.9, 0, { role: 'Receptionist' }); setRoutine(r, [['type', 6, 10], ['idle', 3, 5], ['chat', 3, 4]]); });
    const logoTex = canvasTex(1536, 512, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#0d1430'); grd.addColorStop(1, '#151b3d');
      g.fillStyle = grd; g.fillRect(0, 0, w, h); g.fillStyle = '#00e5ff'; g.fillRect(0, h - 12, w, 12);
      g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = `800 130px ${FONT}`; g.fillText('ADRIAN', w / 2, 180);
      g.font = `600 70px ${FONT}`; g.fillText('FINANCIAL AGENTS', w / 2, 270);
      g.fillStyle = '#8fa2d9'; g.font = `500 38px ${MONO}`; g.fillText('FINANCIAL & ECONOMIC INTELLIGENCE CENTER', w / 2, 345);
      const now = new Date(); g.fillStyle = '#3dffb5'; g.font = `600 40px ${MONO}`;
      g.fillText(AFA.config.clocks.map(c => `${c.label} ${new Intl.DateTimeFormat('en-GB', { timeZone: c.tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)}`).join('    '), w / 2, 430);
    }, 15);
    [0, Math.PI].forEach(ry => { // one readable face toward the entrance, one toward the hub
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(14, 4.67), new THREE.MeshBasicMaterial({ map: logoTex, toneMapped: false }));
      logo.position.set(0, 6.2, 18.5 + (ry ? -0.05 : 0.05)); logo.rotation.y = ry; lobby.add(logo);
    });
    box(lobby, 0.15, 3.8, 0.15, -6.5, 1.9, 18.5, frameMat); box(lobby, 0.15, 3.8, 0.15, 6.5, 1.9, 18.5, frameMat);
    // market video walls on both lobby side walls
    const wallTex = canvasTex(2560, 538, (g, w, h, t) => {
      g.fillStyle = '#050916'; g.fillRect(0, 0, w, h);
      g.save(); g.scale(w / 4096, h / 860);
      g.fillStyle = '#0f1838'; g.fillRect(0, 0, 4096, 90); g.fillStyle = '#ff3ec9'; g.font = `700 52px ${FONT}`; g.fillText('GLOBAL MARKETS · LIVE (MOCK FEED)', 40, 62);
      g.font = `700 74px ${MONO}`; w = 4096;
      const items = data.ticker.map(q => ({ q, txt: `${q.name} ${U.fmtNum(q.price, q.dp)} ${U.arrow(q.changePct)}${U.fmtPct(q.changePct)}` }));
      const widths = items.map(i => g.measureText(i.txt).width + 120), total = widths.reduce((a, b) => a + b, 0);
      let x = -((t * 160) % total);
      for (let rep = 0; rep < 3; rep++) items.forEach((it, i) => { if (x < w && x + widths[i] > 0) { g.fillStyle = dirCol(it.q.changePct); g.fillText(it.txt, x, 200); } x += widths[i]; });
      ['VNINDEX', 'SPX', 'XAUUSD', 'BRENT'].forEach((sym, i) => {
        const bx = 40 + i * (w - 80) / 4, q = data.ticker.find(z => z.symbol === sym);
        g.fillStyle = 'rgba(14,26,60,0.9)'; roundRect(g, bx, 260, (w - 80) / 4 - 40, 560, 24); g.fill();
        g.fillStyle = '#9fb0de'; g.font = `600 46px ${FONT}`; g.fillText(q.name, bx + 30, 330);
        g.fillStyle = '#ffffff'; g.font = `800 84px ${MONO}`; g.fillText(U.fmtNum(q.price, q.dp), bx + 30, 430);
        spark(g, bx + 30, 480, (w - 80) / 4 - 100, 290, (data.hist[sym] || [1, 2]).slice(-60 + Math.floor(t / 2) % 10), dirCol(q.changePct), true);
      });
      g.restore();
    }, 0.09);
    [-1, 1].forEach(side => {
      box(lobby, 0.4, 7, 26, side * (LOBBY_W / 2 - 0.2), 3.5, 2, M(0x1b2030));
      screenMesh(lobby, 25, 5.25, wallTex, side * (LOBBY_W / 2 - 0.45), 3.6, 2, -side * Math.PI / 2, { title: 'Global markets video wall', desc: 'Live market ticker and key indices.' });
    });
    [[-20, 12], [20, 12]].forEach(([x, z]) => {
      box(lobby, 4, 0.48, 1.2, x, 0.24, z, M(0x3b4459)); box(lobby, 4, 0.7, 0.32, x, 0.62, z + 0.55, M(0x3b4459));
      box(lobby, 1.6, 0.42, 0.9, x, 0.21, z - 1.6, M(0x8a6a4a));
      plant(lobby, x + 3, z + 0.3);
      const v = person(lobby, x - 1, z - 0.1, Math.PI, { role: 'Visitor' }); setRoutine(v, [['read', 8, 14], ['idle', 4, 6]]); v.act = 'read';
    });
    [-9, 9].forEach(x => plant(lobby, x, 19, 1.4));

    // Intelligence Hub: platform, globe, division panels
    const hub = new THREE.Group(); hub.position.set(0, 0, -2); lobby.add(hub);
    const hubPos = new THREE.Vector3(0, 0, lobbyZ - 2);
    hub.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 0.3, 64), M(0x0f1636, { emissive: 0x0a1a44, metalness: 0.6, roughness: 0.3 }))).position.y = 0.15;
    const hubRing = new THREE.Mesh(new THREE.TorusGeometry(7.05, 0.06, 8, 120), new THREE.MeshBasicMaterial({ color: 0x00e5ff })); hubRing.rotation.x = Math.PI / 2; hubRing.position.y = 0.31; hub.add(hubRing);
    const globeG = new THREE.Group(); globeG.position.y = 4.4; hub.add(globeG);
    globeG.add(new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 2), new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.35 })));
    globeG.add(new THREE.Mesh(new THREE.SphereGeometry(2.25, 32, 20), new THREE.MeshBasicMaterial({ color: 0x0b1f52, transparent: true, opacity: 0.55 })));
    const gRing1 = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.03, 6, 100), new THREE.MeshBasicMaterial({ color: 0x8b5cff })); globeG.add(gRing1);
    const gRing2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.025, 6, 100), new THREE.MeshBasicMaterial({ color: 0xff3ec9 })); globeG.add(gRing2);
    const hubLight = new THREE.PointLight(0x7fd8ff, 1.1, 40); hubLight.position.set(0, 6, 0); hub.add(hubLight);
    const hubPanels = new THREE.Group(); hubPanels.position.y = 3.2; hub.add(hubPanels);
    divisions.forEach((d, i) => {
      const a = (i / divisions.length) * Math.PI * 2 + Math.PI / 4;
      const p0 = d.departments[0], m = metrics[p0.id];
      const pn = holoPanel(hubPanels, 3.2, 1.8, (g, w, h, t) => {
        const fs = glass(g, w, h, d.color, d.nameEn, `${d.departments.length} desks · AI agents online`);
        g.fillStyle = '#ffffff'; g.font = `700 ${fs * 0.9}px ${MONO}`; g.fillText(m.main, w * 0.06, h * 0.62);
        g.fillStyle = { up: '#3dffb5', down: '#ff4f8b', flat: '#a5aed8' }[m.dir]; g.font = `600 ${fs * 0.7}px ${MONO}`; g.fillText(m.sub, w * 0.06, h * 0.8);
        g.fillStyle = Math.floor(t * 2) % 2 ? d.color : '#33406a'; g.beginPath(); g.arc(w - 40, 40, 10, 0, 7); g.fill();
      }, 1, { color: d.color, bob: 0.12, cw: 768, pick: { title: `${d.nameEn} — hub panel`, desc: 'Headline metric streamed from the division to the hub.', division: d } });
      pn.position.set(Math.sin(a) * 5.4, 0, Math.cos(a) * 5.4); pn.rotation.y = a;
    });
    const hubLabel = label('Intelligence Hub', 'people + AI agents monitoring the financial world', '#00e5ff', 1.15);
    hubLabel.position.set(0, 9.4, 0); hub.add(hubLabel);

    // ---------------------------------------------------------------- wings
    const wingLights = [];
    rows.forEach(row => row.pair.forEach((d, idx) => {
      const sideSign = idx === 0 ? 1 : -1;
      const depth = d.departments.length * POD + 24;
      const col = new THREE.Color(d.color), C2 = hex(col);
      const g = new THREE.Group();
      g.position.set(sideSign * (C + WING_W / 2), 0, row.z);
      g.rotation.y = sideSign > 0 ? 0 : Math.PI;      // local -x faces the corridor
      scene.add(g);
      const wing = { division: d, group: g, depth, sideSign };
      wings.push(wing);
      const carpet = new THREE.Mesh(new THREE.PlaneGeometry(WING_W, depth), M(new THREE.Color(0x232836).lerp(col, 0.08).getHex(), { roughness: 0.95 }));
      carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.015; g.add(carpet);
      const wallMat = M(0x2b3141, { roughness: 0.8 });
      box(g, 0.4, 8, depth, WING_W / 2, 4, 0, wallMat);
      box(g, WING_W, 8, 0.4, 0, 4, -depth / 2, wallMat);
      box(g, WING_W, 1.1, 0.4, 0, 0.55, depth / 2, wallMat);
      box(g, WING_W, 0.08, 0.42, 0, 1.12, depth / 2, M(d.color, { emissive: col.clone().multiplyScalar(0.6) }));
      [[-depth / 2, -2.2], [2.2, depth / 2]].forEach(([a, b]) => {
        const len = b - a, mid = (a + b) / 2;
        const gl = new THREE.Mesh(boxGeo(0.06, 3.4, len), glassMat); gl.position.set(-WING_W / 2, 1.7, mid); g.add(gl);
        box(g, 0.12, 0.1, len, -WING_W / 2, 3.42, mid, frameMat); box(g, 0.12, 0.06, len, -WING_W / 2, 0.03, mid, frameMat);
        box(g, 0.14, 0.06, len, -WING_W / 2, 3.52, mid, M(d.color, { emissive: col.clone().multiplyScalar(0.7) }));
      });
      // big division header over the entrance (readable from the corridor)
      const head = holoPanel(g, 12, 2.2, (hg, w, h) => { glass(hg, w, h, C2); hg.textAlign = 'center'; hg.fillStyle = '#fff'; hg.font = `800 ${h * 0.4}px ${FONT}`; hg.fillText(d.nameEn, w / 2, h * 0.55); hg.fillStyle = C2; hg.font = `600 ${h * 0.18}px ${MONO}`; hg.fillText(`DIVISION ${d.code} · ${d.departments.length} DESKS · ${d.name.toUpperCase()}`, w / 2, h * 0.82); }, 0, { color: C2, cw: 1536 });
      head.position.set(-WING_W / 2 - 0.4, 5.2, 0); head.rotation.y = -Math.PI / 2;
      const sign = label(d.nameEn, `DIVISION ${d.code}`, d.color, 1.1); sign.position.set(0, 10, 0); g.add(sign);
      const wl = new THREE.PointLight(0xfff3e2, 0.75, 46); wl.position.set(0, 9, 0); g.add(wl); wingLights.push(wl);
      const hit = new THREE.Mesh(boxGeo(WING_W, 4, depth), new THREE.MeshBasicMaterial()); hit.visible = false; hit.position.y = 2;
      hit.userData = { type: 'division', division: d }; g.add(hit); pickables.coarse.push(hit);
      // division data wall on the back wall + ticker band along the outer wall
      const dashTex = canvasTex(2048, 768, divisionDashboard(d, col), 2.5);
      screenMesh(g, 24, 9, dashTex, 0, 4.4, -depth / 2 + 0.24, 0, { title: `${d.nameEn} — intelligence wall`, desc: 'Wall-sized division dashboard with the key signals the team tracks.', division: d });
      const tickTex = canvasTex(2048, 64, tickerDraw(tickerItems(d), C2), 0.07);
      screenMesh(g, depth - 2, 0.95, tickTex, WING_W / 2 - 0.22, 7.35, 0, -Math.PI / 2);

      d.departments.forEach((p, j) => {
        const pz = -depth / 2 + 12 + j * POD;
        const pod = { dept: p, division: d, wing, z: pz, people: [] };
        depts[p.id] = pod;
        const meta = { division: d, dept: p };
        const zone = new THREE.Mesh(new THREE.PlaneGeometry(34, 13.5), M(new THREE.Color(0x262c3b).lerp(col, 0.14).getHex(), { roughness: 0.95 }));
        zone.rotation.x = -Math.PI / 2; zone.position.set(1.5, 0.02, pz); g.add(zone);
        const outline = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo(34.2, 4.2, 13.7)), new THREE.LineBasicMaterial({ color: col }));
        outline.position.set(1.5, 2.1, pz); outline.visible = false; g.add(outline);
        pod.outline = outline;
        const ph = new THREE.Mesh(boxGeo(34, 4.3, 13.5), new THREE.MeshBasicMaterial()); ph.visible = false; ph.position.set(1.5, 2.15, pz);
        ph.userData = { type: 'dept', pod }; g.add(ph); pickables.coarse.push(ph);
        // 6 workstations: two facing rows
        [-2.2, 0, 2.2].forEach(dz => {
          pod.people.push(workstation(g, -11.5, pz + dz, Math.PI / 2, meta));
          pod.people.push(workstation(g, -8.0, pz + dz, -Math.PI / 2, meta));
        });
        // holo-table with the desk's 3D visualisation (faces the corridor)
        const ht = new THREE.Group(); ht.position.set(1, 0, pz); g.add(ht);
        ht.add(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.95, 48), M(0x141c33, { metalness: 0.5, roughness: 0.35 }))).position.y = 0.48;
        const htRing = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.05, 8, 96), new THREE.MeshBasicMaterial({ color: col })); htRing.rotation.x = Math.PI / 2; htRing.position.y = 0.97; ht.add(htRing);
        const vizTop = new THREE.Group(); vizTop.position.y = 1.0; vizTop.rotation.y = -Math.PI / 2; ht.add(vizTop);
        deskViz(vizTop, p, d, col);
        const lightCone = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.2, 3.6, 48, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false }));
        lightCone.position.y = 2.8; ht.add(lightCone);
        // two analysts at the holo-table, alternating analyse / talk
        const a1 = person(g, 1 - 2.6, pz + 2.6, Math.PI * 0.75, meta), a2 = person(g, 1 + 2.4, pz - 2.4, -Math.PI * 0.25, meta);
        setRoutine(a1, [['analyse', 6, 10], ['talk', 6, 9], ['watch', 4, 6]]); setRoutine(a2, [['talk', 6, 9], ['watch', 5, 8], ['analyse', 5, 8]]);
        a1.partner = a2; a2.partner = a1; a1.speaking = true;
        pod.people.push(a1, a2);
        // wall-sized live display for the desk on the outer wall + a market watcher
        const series = Array.from({ length: 50 }, (_, i) => Math.sin(i * 0.3 + j) * 0.5 + rr(i + j * 7));
        const m = metrics[p.id];
        const dispTex = canvasTex(1600, 900, (cg2, w, h, t) => {
          series.push(series[series.length - 1] + (rr(t * 3 + j) - 0.5) * 0.6); series.shift();
          const fs = glass(cg2, w, h, C2, p.name, `AGENT ${p.agent.name.toUpperCase()} · ${p.agent.code} · ${ILLU}`);
          let mainTxt = m.main;
          if (m.price) { const live = m.price * (1 + (series[series.length - 1] - series[0]) * 0.0006); mainTxt = `${m.label}  ${U.fmtNum(live, m.dp)}`; }
          cg2.fillStyle = '#ffffff'; cg2.font = `800 ${fs * 1.1}px ${MONO}`; cg2.fillText(mainTxt, w * 0.04, h * 0.37);
          cg2.fillStyle = { up: '#3dffb5', down: '#ff4f8b', flat: '#a5aed8' }[m.dir]; cg2.font = `600 ${fs * 0.7}px ${MONO}`; cg2.fillText(m.sub, w * 0.04, h * 0.46);
          spark(cg2, w * 0.04, h * 0.52, w * 0.58, h * 0.4, series, C2, true);
          cg2.fillStyle = 'rgba(10,22,54,0.7)'; roundRect(cg2, w * 0.66, h * 0.3, w * 0.3, h * 0.62, 18); cg2.fill();
          cg2.fillStyle = '#9fb0de'; cg2.font = `600 ${fs * 0.5}px ${FONT}`; cg2.fillText('Coverage', w * 0.68, h * 0.37);
          cg2.font = `500 ${fs * 0.46}px ${FONT}`;
          p.scope.slice(0, 7).forEach((sc, i) => { cg2.fillStyle = i === Math.floor(t / 2) % 7 ? C2 : '#cfd6ff'; cg2.fillText('• ' + sc, w * 0.68, h * 0.44 + i * fs * 0.62); });
          cg2.fillStyle = Math.floor(t * 2) % 2 ? '#ff4f8b' : '#5a2040'; cg2.beginPath(); cg2.arc(w - 120, h * 0.09, 12, 0, 7); cg2.fill();
          cg2.fillStyle = '#ffffff'; cg2.font = `700 ${fs * 0.45}px ${MONO}`; cg2.fillText('LIVE', w - 96, h * 0.105);
        }, 1.6);
        box(g, 0.2, 6.6, 11.6, WING_W / 2 - 0.3, 3.9, pz, M(0x0c0f14));
        screenMesh(g, 11.2, 6.3, dispTex, WING_W / 2 - 0.42, 3.9, pz, -Math.PI / 2, { title: `${p.name} — live display`, desc: `Wall-sized live display of the ${p.name} desk.`, division: d, dept: p });
        const watcher = person(g, WING_W / 2 - 6, pz + rand(-2.5, 2.5), Math.PI / 2, meta);
        setRoutine(watcher, [['watch', 8, 14], ['idle', 3, 5], ['analyse', 4, 6]]);
        pod.people.push(watcher);
        const lbl = label(p.agent.name, `${p.agent.code} · ${p.name}`, d.color, 0.62); lbl.position.set(1.5, 5.6, pz); g.add(lbl);
        plant(g, 17, pz + 5.6, 0.9);
      });

      // meeting room near the front
      const mz = depth / 2 - 7.5, mx = 6;
      const mr = new THREE.Group(); mr.position.set(mx, 0, mz); g.add(mr);
      [[0, -5.5, 16, 0.06], [-8, 0, 0.06, 11]].forEach(([x, z, w, dd]) => {
        const gl = new THREE.Mesh(boxGeo(w, 3.4, dd), glassMat); gl.position.set(x, 1.7, z); mr.add(gl);
        box(mr, Math.max(w, 0.12), 0.08, Math.max(dd, 0.12), x, 3.42, z, frameMat);
      });
      mr.add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.08, 40), M(0x8a6a4a, { roughness: 0.45 }))).position.y = 0.76;
      box(mr, 0.25, 0.72, 0.25, 0, 0.36, 0, frameMat);
      const slideTex = canvasTex(1280, 720, (sg, w, h, t) => {
        const fs = glass(sg, w, h, C2, `Weekly review — ${d.nameEn}`, 'TEAM MEETING IN PROGRESS');
        sg.font = `500 ${fs * 0.6}px ${FONT}`; sg.fillStyle = '#cfd6ff';
        ['Key signals this week', 'Desk highlights & risks', 'Actions for the AI agents'].forEach((tx, i) => { sg.fillStyle = i === Math.floor(t / 4) % 3 ? C2 : '#cfd6ff'; sg.fillText('•  ' + tx, w * 0.05, h * 0.38 + i * fs * 1.1); });
        [0.5, 0.8, 0.35, 0.95, 0.6, 0.75].forEach((v, i) => { sg.fillStyle = i % 2 ? C2 : '#5b6b8a'; sg.fillRect(w * 0.56 + i * w * 0.065, h * 0.9 - v * h * 0.5, w * 0.045, v * h * 0.5); });
      }, 2);
      box(mr, 5.4, 3.1, 0.12, 0, 2.0, 5.2, M(0x111418));
      screenMesh(mr, 5.2, 2.92, slideTex, 0, 2.0, 5.13, Math.PI, { title: `${d.nameEn} — meeting room`, desc: 'Weekly review presentation.', division: d });
      const presenter = person(mr, 2.6, 4.0, Math.PI + 0.5, { division: d });
      setRoutine(presenter, [['present', 10, 16]]);
      [[-1.5, -1.9], [1.5, -1.9], [-2.8, 0.2], [2.8, 0.2], [-1.6, 2.1], [1.6, 2.1]].forEach(([sx, sz], i) => {
        const ry = Math.atan2(-sx, -sz);
        chair(mr, sx * 1.1, sz * 1.1, ry);
        if (i < 4 || rng() > 0.4) {
          const pp = person(mr, sx * 1.1, sz * 1.1, ry, { division: d });
          pp.lookYaw = Math.atan2(2.6 - sx, 4.0 - sz) - ry;
          setRoutine(pp, [['meet', 12, 20]]);
        }
      });
      // analysts at the division data wall
      const an = person(g, -3, -depth / 2 + 3, Math.PI, { division: d }); setRoutine(an, [['analyse', 9, 14], ['talk', 5, 8]]);
      const an2 = person(g, 1.8, -depth / 2 + 3.6, Math.PI - 0.35, { division: d }); setRoutine(an2, [['talk', 5, 8], ['watch', 6, 9]]);
      an.partner = an2; an2.partner = an; an.speaking = true;
      // coffee point
      const cz = depth / 2 - 6;
      const ct = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 24), M(0xece9e2)); ct.position.set(-15, 1.08, cz); g.add(ct);
      box(g, 0.1, 1.08, 0.1, -15, 0.54, cz, frameMat);
      box(g, 1.4, 1.1, 0.6, -18.8, 0.55, cz, M(0x3b4459)); box(g, 0.4, 0.5, 0.35, -18.8, 1.35, cz, M(0x22262e));
      const t1 = person(g, -15, cz - 0.95, 0, { division: d }), t2 = person(g, -15, cz + 0.95, Math.PI, { division: d });
      [t1, t2].forEach(tp => setRoutine(tp, [['talk', 20, 40]]));
      t1.speaking = true; t1.partner = t2; t2.partner = t1;
      plant(g, -18.5, -depth / 2 + 1.5); plant(g, 18.5, depth / 2 - 1.5);
    }));

    // Wing groups were just positioned/rotated: refresh world matrices now, before anything converts wing-local
    // points to world space (data-stream doors, walker routes). Without this, routes planned at start-up use the
    // identity matrix and send people straight through the wing walls.
    scene.updateMatrixWorld(true);

    // data streams: hub → every wing (information flowing between departments)
    const streams = [];
    wings.forEach((w, i) => {
      const door = w.group.localToWorld(new THREE.Vector3(-WING_W / 2 - 1, 5.2, 0));
      const start = new THREE.Vector3(0, 7.5, lobbyZ - 2);
      const curve = new THREE.CubicBezierCurve3(start, new THREE.Vector3(0, 12, (start.z + door.z) / 2 + 10), new THREE.Vector3(door.x * 0.4, 10, door.z), door);
      const col = new THREE.Color(w.division.color);
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.22 })));
      const count = 18, pos = new Float32Array(count * 3);
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      scene.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: col, size: 0.5, transparent: true, opacity: 0.95, depthWrite: false })));
      streams.push({ curve, pg, count, offset: i * 0.17 });
    });

    // ---------------------------------------------------------------- walkers
    const walkers = [];
    const tmp = new THREE.Vector3();
    const wingPoint = (w, lx, lz, ly = 0) => w.group.localToWorld(new THREE.Vector3(lx, ly, lz));
    // Lobby resting spot on one side of the hub: x stays beyond the hub platform (r≈7.4 at lobby z-2) so the straight
    // walk to/from the corridor never crosses it; sofa/table blocks at x≈±20, z≈lobby+10..13 are avoided.
    const lobbyPoint = side => {
      for (;;) {
        const x = side * rand(11, 24), z = rand(-12, 9);
        if (Math.abs(x) > 16.5 && z > 8.5) continue;
        return new THREE.Vector3(x, 0, lobbyZ + z);
      }
    };
    function planWalk(p) {
      const w = pick(wings);
      const doorOut = wingPoint(w, -WING_W / 2 - 3, 0), doorIn = wingPoint(w, -WING_W / 2 + 3, 0);
      const pod = depts[pick(w.division.departments).id];
      const aisle = wingPoint(w, -15.5, pod.z + rand(-3, 3));
      // leave the lobby on the side the walker is already on, come back on the other side
      const here = p.root.position.x;
      const side = Math.abs(here) > 1 ? Math.sign(here) : (rng() > 0.5 ? 1 : -1);
      p.path = [
        { v: new THREE.Vector3(side * 10, 0, lobbyZ - 2) },
        { v: new THREE.Vector3(side * rand(1, 3), 0, 4) },
        { v: new THREE.Vector3(side * rand(1, 3), 0, doorOut.z) },
        { v: doorOut }, { v: doorIn },
        { v: aisle, pause: rand(3, 6), act: pick(['idle', 'watch']) },
        { v: doorIn }, { v: doorOut },
        { v: new THREE.Vector3(-side * rand(1, 3), 0, doorOut.z) },
        { v: new THREE.Vector3(-side * rand(1, 3), 0, 4) },
        { v: new THREE.Vector3(-side * 10, 0, lobbyZ - 2) },
        { v: lobbyPoint(-side), pause: rand(2, 5), act: 'idle' },
      ];
      p.seg = 0; p.podTarget = pod;
    }
    for (let i = 0; i < Math.max(8, divisions.length * 3); i++) {
      const p = person(scene, 0, 0, 0, { walker: true, division: null });
      p.act = 'walk'; p.walkPhase = 0; p.speed = rand(1.2, 1.6); p.pauseUntil = 0;
      planWalk(p);
      p.seg = Math.floor(rand(0, p.path.length - 1));
      p.root.position.copy(p.path[p.seg].v);
      walkers.push(p);
    }

    // ---------------------------------------------------------------- hero operator (main character)
    const H = CFG.hero;
    const hero = person(lobby, 0, 6, Math.PI, { hero: true, name: H.name, role: H.role, scale: 1.3, shirt: 0x141d36, pants: 0x101528, tie: 0x00b8d4 });
    hero.walkPhase = 0; hero.speed = 1.1; hero.pauseUntil = 0;
    const heroRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 40), new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
    heroRing.rotation.x = -Math.PI / 2; heroRing.position.y = 0.04; hero.root.add(heroRing);
    const heroTag = label(`★ ${H.name}`, H.role, '#ffc857', 0.7); heroTag.position.y = 2.35; hero.root.add(heroTag);
    // Adrian lives in world space so he can walk the whole building during the Supervisor Tour.
    scene.attach(hero.root);
    const HUB = new THREE.Vector3(0, 0, lobbyZ - 2), RING_R = 8.6;
    const ringPoint = a => new THREE.Vector3(HUB.x + Math.sin(a) * RING_R, 0, HUB.z + Math.cos(a) * RING_R);
    const heroStops = Array.from({ length: 6 }, (_, i) => ringPoint((i / 6) * Math.PI * 2));
    hero.stop = 0;
    hero.root.position.copy(heroStops[0]);
    // ---------------------------------------------------------------- camera views
    const views = { overview: { pos: new THREE.Vector3(0, 108, lobbyZ + 168), target: new THREE.Vector3(0, 6, -floorDepth / 2 + 4) } };
    let tween = null, follow = null;
    function flyTo(v, dur = 1600) { tween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: v.pos.clone(), t1: v.target.clone(), start: performance.now(), dur: reduceMotion ? 1 : dur }; }
    const wingView = w => ({ pos: wingPoint(w, -WING_W / 2 - 18, w.depth * 0.42, 30), target: wingPoint(w, 2, 0, 0) });
    const podView = pod => ({ pos: wingPoint(pod.wing, -19, pod.z + 9, 7.5), target: wingPoint(pod.wing, 0, pod.z, 2.2) });
    function personView(p) {
      const wp = p.root.getWorldPosition(new THREE.Vector3());
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(p.root.getWorldQuaternion(new THREE.Quaternion())); dir.y = 0; dir.normalize();
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      const s = p.root.scale.x, hy = (SEATED.has(p.act) ? 1.22 : 1.62) * s;   // face height: portrait framing
      return { pos: wp.clone().addScaledVector(dir, 2.1 * s).addScaledVector(side, 0.8 * s).add(new THREE.Vector3(0, hy + 0.25, 0)), target: wp.clone().add(new THREE.Vector3(0, hy - 0.15, 0)) };
    }
    function displayView(mesh) {
      const c = mesh.getWorldPosition(new THREE.Vector3());
      const n = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())); n.y = 0; n.normalize();
      const w = mesh.userData.w || 6;
      return { pos: c.clone().addScaledVector(n, w * 0.95).add(new THREE.Vector3(0, 0.4, 0)), target: c };
    }

    // ---------------------------------------------------------------- UI / info
    const navBtns = root.querySelectorAll('.c3d-nav [data-go]');
    const setNav = id => navBtns.forEach(b => b.classList.toggle('on', b.dataset.go === id));
    let selectedPod = null, current = { kind: 'overview' };
    function highlight(pod) { if (selectedPod) selectedPod.outline.visible = false; selectedPod = pod; if (pod) pod.outline.visible = true; }
    function activitySummary(list) {
      const counts = {}; list.forEach(p => { counts[p.act] = (counts[p.act] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([a, n]) => `<li><b class="num">${n}</b> ${esc(ACT_LABEL[a] || a)}</li>`).join('');
    }
    const staffOf = d => people.filter(p => p.division === d);
    function renderInfo() {
      if (info.hidden) return;
      const c = current;
      let html = '';
      if (c.kind === 'overview') {
        html = `<div class="kicker">Headquarters</div><h2>Adrian Financial Agents</h2>
          <p>${divisions.length} divisions, ${Object.keys(depts).length} desks and ${people.length} people on the floor, each desk backed by an AI agent. Investment Intelligence joins after go-live.</p>
          <div class="c3d-list">${wings.map(w => `<button data-go="div:${esc(w.division.id)}" style="--c:${esc(w.division.color)}"><span>${esc(w.division.code)}</span>${esc(w.division.nameEn)}<small>${w.division.departments.length} desks · ${staffOf(w.division).length} staff</small></button>`).join('')}</div>
          <div class="kicker">On the floor now</div><ul class="c3d-activity">${activitySummary(people)}</ul>`;
      } else if (c.kind === 'div') {
        const d = c.wing.division, st = staffOf(d);
        html = `<div class="kicker" style="color:${esc(d.color)}">Division ${esc(d.code)}</div><h2>${esc(d.nameEn)}</h2><p>${esc(d.description)}</p>
          <div class="c3d-list">${d.departments.map(p => `<button data-go="dept:${esc(p.id)}" style="--c:${esc(d.color)}"><span>◆</span>${esc(p.name)}<small>${esc(metrics[p.id].main)}</small></button>`).join('')}</div>
          <div class="kicker">Team activity · ${st.length} staff</div><ul class="c3d-activity">${activitySummary(st)}</ul>
          <a class="link" href="#/${esc(d.id)}">Open division page →</a>`;
      } else if (c.kind === 'dept') {
        const pod = c.pod, p = pod.dept, m = metrics[p.id];
        html = `<div class="kicker" style="color:${esc(pod.division.color)}">${esc(pod.division.nameEn)}</div><h2>${esc(p.name)}</h2>
          <div class="c3d-agent-card">${AFA.ui.agentAvatar(p, 'md')}<b>${esc(p.agent.name.toUpperCase())}</b><span class="num">${esc(p.agent.code)}</span><small>${esc(p.agent.title)}</small><code>${esc(p.agentId)}</code><i><span class="status-dot"></span> Active</i><em>${esc(p.agent.persona)}</em></div><p>${esc(p.description)}</p>
          <div class="c3d-metric"><b class="num">${esc(m.main)}</b><span class="num ${esc(m.dir)}">${esc(m.sub)}</span></div>
          <div class="kicker">Team activity · ${pod.people.length} staff</div><ul class="c3d-activity">${activitySummary(pod.people)}</ul>
          <p class="small muted">Tip: click a person, workstation or screen to focus on it.</p>
          <div class="c3d-actions"><a class="btn-3d" href="${esc(AFA.registry.deptHref(p.id))}">Open desk →</a><button class="btn-ghost" data-go="div:${esc(pod.division.id)}">← ${esc(pod.division.nameEn)}</button></div>`;
      } else if (c.kind === 'person') {
        const p = c.p;
        const where = p.hero ? 'Intelligence Hub' : p.dept ? p.dept.name : p.division ? p.division.nameEn : 'Headquarters';
        html = `<div class="kicker" style="color:${esc(p.hero ? '#ffc857' : p.division ? p.division.color : '#00e5ff')}">${p.hero ? 'Main character' : 'Employee'}</div><h2>${esc(p.name)}</h2>
          <div class="c3d-agent">${esc(p.role)} · ${esc(where)}</div>
          <div class="c3d-metric"><b>Now ${esc(ACT_LABEL[p.act] || p.act)}</b><span class="muted small">${p.walker ? 'Moving between the lobby, corridor and wings' : p.station ? 'At a dual-monitor workstation' : 'On the floor'}</span></div>
          ${p.hero ? '<p class="small muted">Signature face design: midnight-navy helmet with gold circuit lattice and glowing cyan lenses.</p>' : ''}
          <div class="c3d-actions">${p.dept ? `<button class="btn-ghost" data-go="dept:${esc(p.dept.id)}">← ${esc(p.dept.name)}</button>` : ''}<button class="btn-ghost" data-go="overview">Overview</button></div>`;
      } else if (c.kind === 'display') {
        const u = c.mesh.userData;
        html = `<div class="kicker" style="color:${esc(u.division ? u.division.color : '#00e5ff')}">Data display</div><h2>${esc(u.title)}</h2><p>${esc(u.desc || '')}</p>
          <div class="c3d-actions">${u.dept ? `<a class="btn-3d" href="${esc(AFA.registry.deptHref(u.dept.id))}">Open desk →</a><button class="btn-ghost" data-go="dept:${esc(u.dept.id)}">← ${esc(u.dept.name)}</button>` : ''}${u.division && !u.dept ? `<button class="btn-ghost" data-go="div:${esc(u.division.id)}">← ${esc(u.division.nameEn)}</button>` : ''}<button class="btn-ghost" data-go="overview">Overview</button></div>`;
      }
      info.dataset.kind = c.kind === 'person' && c.p.hero ? 'hero' : c.kind;
      info.innerHTML = CLOSE + html;
    }
    function go(target, fromTour) {
      if (!fromTour) stopTour();
      info.hidden = false; follow = null; info.dataset.kind = '';
      if (target === 'overview') { highlight(null); controls.autoRotate = !reduceMotion; current = { kind: 'overview' }; flyTo(views.overview); setNav('overview'); }
      else if (target === 'hero') { highlight(null); controls.autoRotate = false; current = { kind: 'person', p: hero }; follow = hero; flyTo(personView(hero)); setNav('hero'); }
      else if (target.startsWith('div:')) {
        const w = wings.find(x => x.division.id === target.slice(4)); if (!w) return;
        highlight(null); controls.autoRotate = false; current = { kind: 'div', wing: w }; flyTo(wingView(w)); setNav(target);
      } else if (target.startsWith('dept:')) {
        const pod = depts[target.slice(5)]; if (!pod) return;
        highlight(pod); controls.autoRotate = false; current = { kind: 'dept', pod }; flyTo(podView(pod)); setNav('div:' + pod.division.id);
      }
      renderInfo();
    }
    function focusPerson(p) { stopTour(); controls.autoRotate = false; info.hidden = false; info.dataset.kind = ''; current = { kind: 'person', p }; follow = p; flyTo(personView(p), 1200); if (p.dept) highlight(depts[p.dept.id]); renderInfo(); }
    function focusDisplay(mesh) { stopTour(); controls.autoRotate = false; info.hidden = false; follow = null; info.dataset.kind = ''; current = { kind: 'display', mesh }; flyTo(displayView(mesh), 1300); renderInfo(); }

    // ---------------------------------------------------------------- Supervisor Tour
    // Adrian (Chief Intelligence Officer) walks the building and inspects every division in order (01 → 04), then
    // reports back to Central Command at the hub. He walks real routes (lobby ring → corridor → wing door → floor),
    // never through walls and never teleporting. Phases per stop: walking → inspecting → complete → next.
    const SUP = CFG.supervisor || {};
    const SUP_WALK = SUP.walkSpeed || 3.2, SUP_FAST = SUP.corridorSpeed || 4.8;
    const INSPECT_S = (SUP.inspectMs || 8000) / 1000, DONE_S = 1.8;
    const tourBtn = root.querySelector('[data-tour]');
    const supEl = root.querySelector('.c3d-sup'), bannerEl = root.querySelector('.c3d-sup-banner'), statusEl = root.querySelector('.c3d-sup-status');
    const gapOf = w => { // a clear lane between two desk pods, nearest the door
      const zs = w.division.departments.map(p => depts[p.id].z).sort((a, b) => a - b);
      const gaps = zs.slice(1).map((z, i) => (z + zs[i]) / 2);
      if (!gaps.length) gaps.push(zs[0] + (zs[0] + 8 < w.depth / 2 - 10 ? 8 : -8));
      return gaps.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
    };
    const stops = [...wings].sort((a, b) => a.division.code.localeCompare(b.division.code))
      .map(w => ({ kind: 'wing', wing: w, gap: gapOf(w), name: w.division.nameEn, short: w.division.nameEn.replace(/ Intelligence| Monitoring/, ''), color: w.division.color }))
      .concat([{ kind: 'hub', name: 'Central Command', short: 'Command', color: '#ffc857' }]);
    const tour = { on: false, paused: false, auto: true, i: 0, phase: 'idle', tt: 0, end: 0, done: new Set(), status: {}, scan: 0, scanAt: 0, camDir: new THREE.Vector3(0, 0, -1) };
    const ringAngle = v => Math.atan2(v.x - HUB.x, v.z - HUB.z);
    const GATE = Math.PI; // ring point facing the corridor
    function ringPath(from, to) {
      let d = to - from; d = Math.atan2(Math.sin(d), Math.cos(d));
      const n = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 6)));   // ≤30° chords stay clear of the platform
      return Array.from({ length: n }, (_, i) => ({ v: ringPoint(from + (d * (i + 1)) / n) }));
    }
    const wingOf = v => wings.find(w => { const l = w.group.worldToLocal(v.clone()); return Math.abs(l.x) <= WING_W / 2 + 0.3 && Math.abs(l.z) <= w.depth / 2; });
    function routeTo(stop) {
      const pos = hero.root.position.clone(), pts = [];
      const w0 = wingOf(pos);
      if (w0) {                                    // leave the current wing through its door
        const l = w0.group.worldToLocal(pos.clone());
        if (l.x > -15.5) pts.push({ v: wingPoint(w0, -16, l.z) });
        pts.push({ v: wingPoint(w0, -WING_W / 2 + 3, 0) }, { v: wingPoint(w0, -WING_W / 2 - 3, 0) },
          { v: new THREE.Vector3(w0.sideSign * 1.5, 0, w0.group.position.z) });
      } else if (pos.z > 6) {                      // lobby: round the hub platform to the corridor gate
        if (Math.abs(pos.distanceTo(HUB) - RING_R) > 0.8) pts.push({ v: ringPoint(ringAngle(pos)) });
        pts.push(...ringPath(ringAngle(pos), GATE));
        if (stop.kind === 'hub') return pts;
        pts.push({ v: new THREE.Vector3(0, 0, 4), fast: true });
      }
      if (stop.kind === 'hub') {
        pts.push({ v: new THREE.Vector3(0, 0, 4), fast: true }, { v: ringPoint(GATE), fast: true });
      } else {
        const w = stop.wing;
        pts.push({ v: new THREE.Vector3(w.sideSign * 1.5, 0, w.group.position.z), fast: true },
          { v: wingPoint(w, -WING_W / 2 - 3, 0) }, { v: wingPoint(w, -WING_W / 2 + 3, 0) },
          { v: wingPoint(w, -16, stop.gap) }, { v: wingPoint(w, -2, stop.gap) });
      }
      return pts;
    }
    function followRoute(dt) {
      const wp = hero.route && hero.route[hero.routeIdx];
      if (!wp) return true;
      hero.speed = wp.fast ? SUP_FAST : SUP_WALK;
      if (moveAlong(hero, 0, dt, wp)) { hero.routeIdx++; if (hero.routeIdx >= hero.route.length) { hero.route = null; return true; } }
      return false;
    }
    async function loadStatus() {
      const label = AFA.data.label || 'MOCK DATA';
      let tot = { processed: 0, alerts: 0, last: null };
      for (const w of wings) {
        const d = w.division;
        let news = [];
        try { news = await AFA.data.getNews({ divisionId: d.id, timeRange: '24h' }); } catch (e) { /* keep empty */ }
        const s = { agents: d.departments.length, processed: news.length, alerts: news.filter(n => n.importance >= 3).length, last: news[0] ? news[0].publishedAt : null };
        tour.status[d.id] = s;
        tot.processed += s.processed; tot.alerts += s.alerts;
        if (s.last && (!tot.last || s.last > tot.last)) tot.last = s.last;
      }
      tour.status._hub = { agents: Object.keys(depts).length, divisions: wings.length, ...tot };
      tour.feed = label;
    }
    const pad2 = n => String(n).padStart(2, '0');
    function statusHtml(stop) {
      const s = stop.kind === 'hub' ? tour.status._hub : tour.status[stop.wing.division.id];
      if (!s) return '';
      const feed = tour.feed === 'LIVE' ? '' : tour.feed === 'STALE' ? ' · stale feed' : ' · mock feed';
      const state = s.processed ? `Operational${feed}` : `Standby${feed}`;
      const rows = stop.kind === 'hub'
        ? [['Divisions online', `${pad2(s.divisions)} / ${pad2(s.divisions)}`], ['AI agents active', pad2(s.agents)], ['Intelligence (24h)', s.processed], ['High-impact alerts', pad2(s.alerts)]]
        : [['Active agents', pad2(s.agents)], ['Intelligence (24h)', s.processed], ['New alerts', pad2(s.alerts)]];
      rows.push(['Last update', s.last ? U.timeAgo(s.last) : '—']);
      return `<div class="k" style="color:${esc(stop.color)}">${stop.kind === 'hub' ? 'COMMAND STATUS' : 'DIVISION STATUS'}</div>
        ${rows.map(([a, b]) => `<div class="r"><span>${esc(a)}</span><b>${esc(String(b))}</b></div>`).join('')}
        <div class="r st"><span>Status</span><b class="${s.processed ? 'ok' : ''}">● ${esc(state)}</b></div>`;
    }
    function renderTourUi() {
      const st = stops[tour.i];
      const verb = tour.paused ? 'Paused · ' + (tour.phase === 'walking' ? 'heading to' : 'at')
        : tour.phase === 'walking' ? 'Heading to' : tour.phase === 'waiting' ? 'Inspected (press Next)' : tour.phase === 'complete' ? 'Inspection complete' : 'Currently inspecting';
      supEl.innerHTML = `<div class="h"><span class="k">SUPERVISOR TOUR — ${pad2(tour.i + 1)} / ${pad2(stops.length)}</span>
          <span class="now">${esc(verb)}: <b style="color:${esc(st.color)}">${esc(st.name)}</b></span></div>
        <ol class="steps">${stops.map((s, i) => `<li class="${i === tour.i ? 'cur' : tour.done.has(i) ? 'ok' : ''}" style="--c:${esc(s.color)}"><button data-sup="jump" data-i="${i}" title="${esc(s.name)}"><i>${tour.done.has(i) && i !== tour.i ? '✓' : pad2(i + 1)}</i>${esc(s.short)}</button></li>`).join('')}</ol>
        <div class="ctl">
          <button data-sup="prev" title="Previous division (←)" ${tour.i === 0 ? 'disabled' : ''}>⏮ Prev</button>
          <button data-sup="pause" title="Pause / resume (Space)">${tour.paused ? '▶ Resume' : '⏸ Pause'}</button>
          <button data-sup="next" title="Next division (→)" ${tour.i >= stops.length - 1 ? 'disabled' : ''}>Next ⏭</button>
          <button data-sup="auto" class="${tour.auto ? 'on' : ''}" title="Move on automatically after each inspection">Auto ${tour.auto ? 'ON' : 'OFF'}</button>
          <button data-sup="exit" title="Exit tour (Esc)">✕ Exit</button>
        </div>`;
    }
    function setBanner(kind) {
      const st = stops[tour.i];
      if (!kind) { bannerEl.hidden = true; return; }
      bannerEl.hidden = false;
      const hud = root.querySelector('.c3d-hud');   // sit just below the HUD, however many rows the nav wraps to
      bannerEl.style.top = `${(hud ? hud.offsetTop + hud.offsetHeight : 120) + 12}px`;
      bannerEl.dataset.kind = kind;
      bannerEl.style.setProperty('--c', st.color);
      const top = { walk: 'ADRIAN IS ON PATROL', inspect: 'ADRIAN IS INSPECTING', done: 'INSPECTION COMPLETE', finish: 'DAILY INSPECTION COMPLETE' }[kind];
      const main = kind === 'walk' ? `EN ROUTE · ${st.name.toUpperCase()}` : kind === 'inspect' ? `SUPERVISING · ${st.name.toUpperCase()}`
        : kind === 'done' ? `✓ ${st.name.toUpperCase()} · OPERATIONAL` : `✓ ALL ${wings.length} DIVISIONS OPERATIONAL`;
      bannerEl.innerHTML = `<span class="k">${top}</span><b>${esc(main)}</b><i class="bar"><em></em></i>`;
    }
    function scanOff() { wings.forEach(w => w.division.departments.forEach(p => { if (depts[p.id] !== selectedPod) depts[p.id].outline.visible = false; })); }
    function goToStop(i) {
      tour.i = Math.max(0, Math.min(stops.length - 1, i));
      hero.route = routeTo(stops[tour.i]); hero.routeIdx = 0;
      tour.phase = 'walking'; statusEl.hidden = true; scanOff();
      setBanner('walk'); renderTourUi();
    }
    async function startTour() {
      stopTour(true);
      tour.on = true; tour.paused = false; tour.done.clear(); tour.tt = 0;
      follow = null; tween = null; controls.autoRotate = false; highlight(null);
      info.hidden = true; root.classList.add('c3d-touring');
      tourBtn.textContent = '■ Exit tour'; tourBtn.classList.add('on'); setNav('');
      supEl.hidden = false;
      tour.camDir.set(Math.sin(hero.root.rotation.y), 0, Math.cos(hero.root.rotation.y));
      goToStop(0);
      await loadStatus();
    }
    function stopTour(silent) {
      if (!tour.on) return;
      tour.on = false; tour.paused = false; tour.phase = 'idle';
      supEl.hidden = true; bannerEl.hidden = true; statusEl.hidden = true; scanOff();
      root.classList.remove('c3d-touring');
      tourBtn.textContent = '▶ Supervisor Tour'; tourBtn.classList.remove('on');
      hero.route = routeTo(stops[stops.length - 1]); hero.routeIdx = 0; hero.returning = true;   // walks home, then patrols
    }
    function togglePause() { if (!tour.on) return; tour.paused = !tour.paused; renderTourUi(); }
    function arrive() {
      const st = stops[tour.i];
      tour.phase = 'inspecting'; tour.end = tour.tt + INSPECT_S; tour.scan = 0; tour.scanAt = tour.tt;
      setBanner('inspect'); renderTourUi();
      statusEl.innerHTML = statusHtml(st); statusEl.style.setProperty('--c', st.color); statusEl.hidden = false;
    }
    const lookDir = new THREE.Vector3();
    function supervisorStep(dt) {
      if (tour.paused) { if (!hero.route || tour.phase !== 'walking') hero.act = 'idle'; else hero.act = 'idle'; return; }
      tour.tt += dt;
      const st = stops[tour.i];
      if (tour.phase === 'walking') {
        if (followRoute(dt)) arrive();
      } else if (tour.phase === 'inspecting') {
        const k = 1 - (tour.end - tour.tt) / INSPECT_S;
        hero.act = k < 0.4 ? 'watch' : k < 0.8 ? 'analyse' : 'present';
        // face the room: the desks / live displays (wings) or the globe (hub)
        if (st.kind === 'wing') lookDir.copy(wingPoint(st.wing, 12, st.gap)).sub(hero.root.position); else lookDir.copy(HUB).sub(hero.root.position);
        const yaw = Math.atan2(lookDir.x, lookDir.z); let dy = yaw - hero.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        hero.root.rotation.y += dy * Math.min(1, dt * 3);
        // inspection scan: each desk pod lights up in turn
        if (st.kind === 'wing' && tour.tt >= tour.scanAt) {
          const pods = st.wing.division.departments.map(p => depts[p.id]);
          pods.forEach((pd, j) => { pd.outline.visible = j === tour.scan % pods.length; });
          tour.scan++; tour.scanAt = tour.tt + Math.max(0.9, (INSPECT_S * 0.8) / pods.length / 2);
        }
        const bar = bannerEl.querySelector('.bar em'); if (bar) bar.style.width = `${Math.round(k * 100)}%`;
        if (tour.tt >= tour.end) { tour.phase = 'complete'; tour.end = tour.tt + DONE_S; tour.done.add(tour.i); scanOff(); setBanner(tour.i === stops.length - 1 ? 'finish' : 'done'); renderTourUi(); }
      } else if (tour.phase === 'complete') {
        hero.act = 'idle';
        if (tour.tt >= tour.end) {
          if (tour.i === stops.length - 1) { tour.phase = 'finished'; tour.end = tour.tt + 3; }
          else if (tour.auto) goToStop(tour.i + 1);
          else { tour.phase = 'waiting'; renderTourUi(); }
        }
      } else if (tour.phase === 'finished') {
        hero.act = 'present';
        if (tour.tt >= tour.end) stopTour();
      } else hero.act = 'idle';
    }
    // cinematic follow camera: behind & above Adrian while walking, room framing while inspecting
    const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(), heroW = new THREE.Vector3();
    function tourCamera(dt) {
      if (tour.paused) return;
      const st = stops[tour.i];
      hero.root.getWorldPosition(heroW);
      const k = reduceMotion ? 1 : 1 - Math.exp(-dt * 2.0);
      if (tour.phase === 'walking') {
        const f = new THREE.Vector3(Math.sin(hero.root.rotation.y), 0, Math.cos(hero.root.rotation.y));
        tour.camDir.lerp(f, reduceMotion ? 1 : 1 - Math.exp(-dt * 1.4)).normalize();
        const wp = hero.route && hero.route[hero.routeIdx];
        const high = wp && wp.fast ? 11 : 8.5;   // a touch higher along the long corridor
        camPos.copy(heroW).addScaledVector(tour.camDir, -10).add(new THREE.Vector3(0, high, 0));
        camTgt.copy(heroW).addScaledVector(tour.camDir, 3).add(new THREE.Vector3(0, 1.6, 0));
      } else if (st.kind === 'wing') {
        const zoom = tour.phase === 'inspecting' ? Math.min(1, 1 - (tour.end - tour.tt) / INSPECT_S) : 1;
        camPos.copy(wingPoint(st.wing, -15 + zoom * 2.5, st.gap + 10 - zoom * 2, 8.2 - zoom * 1.4));   // slow push-in
        camTgt.copy(wingPoint(st.wing, 3, st.gap - 1, 1.6));
      } else {
        camPos.copy(HUB).add(new THREE.Vector3(7, 6.5, -RING_R - 9));
        camTgt.copy(HUB).add(new THREE.Vector3(0, 3.2, 0));
      }
      camera.position.lerp(camPos, k); controls.target.lerp(camTgt, k);
    }
    const projV = new THREE.Vector3();
    function placeStatus() {
      if (statusEl.hidden) return;
      projV.copy(heroW).add(new THREE.Vector3(0, 2.2 * hero.root.scale.x, 0)).project(camera);
      const r = root.getBoundingClientRect();
      if (projV.z > 1) { statusEl.style.opacity = '0'; return; }
      const x = (projV.x * 0.5 + 0.5) * r.width, y = (-projV.y * 0.5 + 0.5) * r.height;
      statusEl.style.opacity = '';
      statusEl.style.left = `${Math.max(12, Math.min(r.width - statusEl.offsetWidth - 12, x + 36))}px`;
      const minTop = bannerEl.hidden ? 120 : bannerEl.offsetTop + bannerEl.offsetHeight + 10;   // never over the banner
      const maxTop = r.height - statusEl.offsetHeight - (supEl.hidden ? 20 : supEl.offsetHeight + 24); // nor over the tour bar
      statusEl.style.top = `${Math.max(minTop, Math.min(maxTop, y - statusEl.offsetHeight / 2))}px`;
    }
    supEl.addEventListener('click', e => {
      const b = e.target.closest('[data-sup]'); if (!b || b.disabled) return;
      e.stopPropagation();
      const a = b.dataset.sup;
      if (a === 'pause') togglePause();
      else if (a === 'next') { tour.paused = false; goToStop(tour.i + 1); }
      else if (a === 'prev') { tour.paused = false; goToStop(tour.i - 1); }
      else if (a === 'jump') { tour.paused = false; goToStop(+b.dataset.i); }
      else if (a === 'auto') { tour.auto = !tour.auto; if (tour.auto && tour.phase === 'waiting') goToStop(tour.i + 1); else renderTourUi(); }
      else if (a === 'exit') stopTour();
    });
    // full-screen: native Fullscreen API, with a CSS fallback (e.g. iOS Safari)
    const fsBtn = root.querySelector('[data-fs]');
    const isFs = () => document.fullscreenElement === root || document.webkitFullscreenElement === root || root.classList.contains('c3d-max');
    const syncFs = () => { fsBtn.textContent = isFs() ? '⤢ Exit full screen' : '⛶ Full screen'; fsBtn.classList.toggle('on', isFs()); setTimeout(resize, 60); };
    function toggleFs() {
      if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      if (root.classList.contains('c3d-max')) { root.classList.remove('c3d-max'); document.body.classList.remove('c3d-lock'); syncFs(); return; }
      const req = root.requestFullscreen || root.webkitRequestFullscreen;
      const fallback = () => { root.classList.add('c3d-max'); document.body.classList.add('c3d-lock'); syncFs(); };
      if (req) { try { const r = req.call(root); if (r && r.catch) r.catch(fallback); } catch (e) { fallback(); } } else fallback();
    }
    document.addEventListener('fullscreenchange', syncFs); document.addEventListener('webkitfullscreenchange', syncFs);
    root.addEventListener('click', e => {
      if (e.target.closest('[data-fs]')) { toggleFs(); return; }
      if (e.target.closest('[data-close]')) { info.hidden = true; return; }
      if (e.target.closest('[data-tour]')) { tour.on ? stopTour() : startTour(); return; }
      const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go);
    });

    // picking: people & screens only once you are past the overview (Overview → Division → Desk → Employee/Data)
    const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
    let hoveredPod = null, downAt = null;
    function pickAt(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      if (current.kind !== 'overview') {
        const f = ray.intersectObjects(pickables.fine, false).filter(h => h.object.visible !== false && h.distance < 60)[0];
        if (f) return { hit: f.object.userData, mesh: f.object };
      } else {
        const hh = ray.intersectObjects([hero.hips.children[0], hero.head], false)[0];
        if (hh) return { hit: hh.object.userData, mesh: hh.object };
      }
      const c = ray.intersectObjects(pickables.coarse, false)[0];
      return c ? { hit: c.object.userData, mesh: c.object } : null;
    }
    renderer.domElement.addEventListener('pointermove', e => {
      const r0 = pickAt(e), m = r0 && r0.hit;
      if (hoveredPod && hoveredPod !== selectedPod) hoveredPod.outline.visible = false;
      hoveredPod = m && m.type === 'dept' ? m.pod : m && m.type === 'person' && m.p.dept ? depts[m.p.dept.id] : null;
      if (hoveredPod) hoveredPod.outline.visible = true;
      renderer.domElement.style.cursor = m ? 'pointer' : 'grab';
      if (!m) { tip.hidden = true; return; }
      const r = root.getBoundingClientRect();
      tip.hidden = false; tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 14) + 'px';
      tip.innerHTML = m.type === 'dept' ? `<b>${esc(m.pod.dept.name)}</b><small>Agent ${esc(m.pod.dept.agent.name)} · ${esc(m.pod.dept.agent.code)} · ${m.pod.people.length} staff</small>`
        : m.type === 'division' ? `<b>${esc(m.division.nameEn)}</b><small>${m.division.departments.length} desks</small>`
        : m.type === 'person' ? `<b>${esc(m.p.name)}</b><small>${esc(m.p.role)} · ${esc(ACT_LABEL[m.p.act] || m.p.act)}</small>`
        : `<b>${esc(m.title)}</b><small>Click to view the display</small>`;
    });
    renderer.domElement.addEventListener('pointerleave', () => { tip.hidden = true; });
    // dragging during the Supervisor Tour pauses it (free orbit); Resume hands the camera back to the tour
    renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; controls.autoRotate = false; if (tour.on && !tour.paused) togglePause(); });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
      const r0 = pickAt(e); if (!r0) return;
      const m = r0.hit;
      if (m.type === 'person') focusPerson(m.p);
      else if (m.type === 'display') focusDisplay(r0.mesh);
      else if (m.type === 'dept') go('dept:' + m.pod.dept.id);
      else if (m.type === 'division') go('div:' + m.division.id);
    });
    const onKey = e => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (tour.on) {
        if (e.key === 'Escape') { stopTour(); return; }
        if (e.key === 'ArrowRight' && tour.i < stops.length - 1) { tour.paused = false; goToStop(tour.i + 1); return; }
        if (e.key === 'ArrowLeft' && tour.i > 0) { tour.paused = false; goToStop(tour.i - 1); return; }
        if (e.key === ' ') { e.preventDefault(); togglePause(); return; }
      }
      if (e.key === 'Escape') { if (root.classList.contains('c3d-max')) { toggleFs(); return; } go('overview'); }
      if (e.key === 'f' || e.key === 'F') toggleFs();
    };
    window.addEventListener('keydown', onKey);

    // ---------------------------------------------------------------- loop
    function resize() { const w = host.clientWidth || 800, h = host.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const ro = new ResizeObserver(resize); ro.observe(host); resize();
    camera.position.set(0, 260, lobbyZ + 240); controls.target.copy(views.overview.target);
    const clock = new THREE.Clock();
    go('overview');

    let raf = 0, lastInfo = 0, lodNext = 0;
    const lodV = new THREE.Vector3();
    function updateLod(t) {
      if (t < lodNext) return; lodNext = t + 0.35;
      const cp = camera.position;
      people.forEach(p => {
        if (p.hero) return;
        const near = p.root.getWorldPosition(lodV).distanceTo(cp) < 75 || (current.kind === 'person' && current.p === p);
        if (near !== p.near) { p.near = near; p.lod.forEach(o => { o.visible = near; }); }
      });
      lodItems.forEach(it => {
        const near = it.anchor.getWorldPosition(lodV).distanceTo(cp) < 85;
        if (near !== it.near) { it.near = near; it.obj.visible = near; }
      });
    }
    const prevTarget = new THREE.Vector3();
    function moveAlong(p, t, dt, wp) {
      tmp.subVectors(wp.v, p.root.position); tmp.y = 0;
      const dist = tmp.length(), step = p.speed * dt;
      if (dist <= step) { p.root.position.x = wp.v.x; p.root.position.z = wp.v.z; return true; }
      tmp.normalize(); p.root.position.addScaledVector(tmp, step);
      const yaw = Math.atan2(tmp.x, tmp.z); let dy = yaw - p.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.root.rotation.y += dy * Math.min(1, dt * 8);
      p.act = 'walk'; p.walkPhase += dt * p.speed * 5.2;
      return false;
    }
    function frame() {
      if (!viewEl.isConnected) {
        cancelAnimationFrame(raf); stopTour(); ro.disconnect(); window.removeEventListener('keydown', onKey);
        document.removeEventListener('fullscreenchange', syncFs); document.removeEventListener('webkitfullscreenchange', syncFs);
        document.body.classList.remove('c3d-lock');
        if (document.fullscreenElement === root && document.exitFullscreen) document.exitFullscreen();
        controls.dispose(); renderer.dispose();
        scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
        return;
      }
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      if (tour.on) {
        tourCamera(dt);
      } else if (tween) {
        const k = Math.min(1, (performance.now() - tween.start) / tween.dur), e = ease(k);
        camera.position.lerpVectors(tween.p0, tween.p1, e); controls.target.lerpVectors(tween.t0, tween.t1, e);
        if (k >= 1) tween = null;
      } else if (follow) {
        // keep a moving person in frame; the user can still orbit around them
        const s = follow.root.scale.x;
        const nt = follow.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, (SEATED.has(follow.act) ? 1.07 : 1.47) * s, 0));
        prevTarget.copy(controls.target); controls.target.lerp(nt, 0.12);
        camera.position.add(controls.target.clone().sub(prevTarget));
      }
      people.forEach(p => {
        if (p.walker || p.hero) return;
        if (p.routine && t > p.until) {
          p.ri = (p.ri + 1) % p.routine.length;
          const [a, lo, hi] = p.routine[p.ri];
          p.act = a; p.until = t + rand(lo, hi);
          if (a === 'chat') p.side = rng() > 0.5 ? 1 : -1;
        }
        if (p.partner && p.speaking && t > (p.swapAt || 0)) { p.speaking = false; p.partner.speaking = true; p.partner.swapAt = t + rand(3, 6); }
        if (!reduceMotion && p.near) pose(p, t);
      });
      walkers.forEach(p => {
        if (p.pauseUntil > t) { p.act = p.pauseAct || 'idle'; if (!reduceMotion) pose(p, t); return; }
        const wp = p.path[p.seg];
        if (moveAlong(p, t, dt, wp)) {
          if (wp.pause) { p.pauseUntil = t + wp.pause; p.pauseAct = wp.act; wp.pause = 0; }
          p.seg++; if (p.seg >= p.path.length) planWalk(p);
        }
        if (!reduceMotion) pose(p, t);
      });
      // Supervisor Tour, then the walk home to the hub, otherwise the usual hub patrol
      if (tour.on) {
        supervisorStep(dt);
      } else if (hero.route) {
        if (followRoute(dt)) { hero.returning = false; hero.speed = 1.1; hero.pauseUntil = t + 3; hero.pauseAct = 'watch'; hero.stop = 3; }
      } else if (hero.pauseUntil > t) {
        hero.act = hero.pauseAct;
        const yaw = Math.atan2(HUB.x - hero.root.position.x, HUB.z - hero.root.position.z);
        let dy = yaw - hero.root.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); hero.root.rotation.y += dy * Math.min(1, dt * 4);
      } else if (moveAlong(hero, t, dt, { v: heroStops[hero.stop] })) {
        hero.stop = (hero.stop + 1) % heroStops.length;
        hero.pauseUntil = t + rand(5, 8); hero.pauseAct = pick(['present', 'analyse', 'watch', 'present']);
      }
      if (!reduceMotion) pose(hero, t);
      if (!reduceMotion) {
        globeG.rotation.y = t * 0.15; gRing1.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.4; gRing1.rotation.y = t * 0.3; gRing2.rotation.x = Math.PI / 2.6; gRing2.rotation.z = -t * 0.25;
        hubPanels.rotation.y = t * 0.04; heroRing.rotation.z = t;
        // the ring under Adrian pulses faster and wider while he inspects
        const insp = tour.on && tour.phase === 'inspecting';
        heroRing.material.opacity = insp ? 0.65 + Math.sin(t * 7) * 0.3 : 0.5 + Math.sin(t * 3) * 0.2;
        heroRing.scale.setScalar(insp ? 1.25 + Math.sin(t * 3.5) * 0.25 : 1);
        hubLight.intensity = 1.0 + Math.sin(t * 0.8) * 0.15;
        wingLights.forEach((l, i) => { l.intensity = 0.72 + Math.sin(t * 0.25 + i * 1.3) * 0.06; });
        streams.forEach(s => {
          const arr = s.pg.attributes.position.array;
          for (let k = 0; k < s.count; k++) { const v = s.curve.getPoint((t * 0.08 + s.offset + k / s.count) % 1); arr[k * 3] = v.x; arr[k * 3 + 1] = v.y; arr[k * 3 + 2] = v.z; }
          s.pg.attributes.position.needsUpdate = true;
        });
        animators.forEach(f => f(t, dt));
      }
      updateLod(t);
      animated.forEach(a => { if (t >= a.next) { a.draw(a.g, a.w, a.h, t); a.tex.needsUpdate = true; a.next = t + a.every; } });
      if (t - lastInfo > 1) { lastInfo = t; renderInfo(); }
      controls.update();
      renderer.render(scene, camera);
      if (tour.on) placeStatus();
    }
    if (reduceMotion) people.forEach(p => pose(p, 0));
    frame();
  }
})();
