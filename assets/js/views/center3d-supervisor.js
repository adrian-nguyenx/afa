/* 3D HQ — Supervisor Mode: first-person exploration as Adrian.
 *
 * The user walks the headquarters at Adrian's eye height and inspects agents, workstations and displays.
 * Desktop: W/A/S/D (or arrows) move, mouse look (Pointer Lock, drag fallback), Shift run, E inspect, Esc menu, F full screen.
 * Touch: left virtual joystick, swipe the right side to look, Inspect / Run (hold) / Menu buttons. Both input kinds work at once.
 * Movement: damped velocity, sub-stepped 2D collision (circle vs boxes/circles on the floor plane) so walls and desks are solid.
 * The recommended route is only a suggestion (objective + optional waypoint beam); nothing moves the camera automatically.
 * Created by views/center3d.js, which owns the scene and passes everything in through `ctx`.
 */
window.AFA = window.AFA || {};

(function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => performance.now();
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  };
  const MOVE_KEYS = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r', shift: 'run' };

  AFA.c3dSupervisor = {
    create(ctx) {
      const { THREE, camera, controls, root, hero, wings, colliders, items, pickables } = ctx;
      const esc = AFA.utils.esc;
      const CFG = Object.assign({ eyeHeight: 2.05, walkSpeed: 4, runSpeed: 7.5, accel: 9, mouseSens: 0.0022, touchSens: 0.005,
        interactRange: 3.4, radius: 0.42, route: ['market', 'macro', 'corporate', 'banking', '_hub'] }, AFA.config.center3d.supervisorMode || {});
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const coarse = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

      // ------------------------------------------------------------ route (suggestion only)
      const HUB_STOP = { id: '_hub', name: 'Intelligence Hub', color: '#ffc857', hub: true };
      const route = CFG.route.map(id => {
        if (id === '_hub') return HUB_STOP;
        const w = wings.find(x => x.division.id === id);
        return w && { id, name: w.division.nameEn, color: w.division.color, wing: w };
      }).filter(Boolean);
      const wingStops = route.filter(s => s.wing);

      // ------------------------------------------------------------ DOM
      const layer = document.createElement('div');
      layer.className = 'c3d-fp-layer'; layer.hidden = true;
      layer.innerHTML = `
        <div class="c3d-fp-pad" aria-hidden="true"></div>
        <div class="c3d-fp-cross" aria-hidden="true"></div>
        <div class="c3d-fp-hud" aria-live="polite">
          <div class="k"><i></i>SUPERVISOR MODE</div>
          <div class="r"><span>Division</span><b data-f="div">—</b></div>
          <div class="r"><span>Status</span><b class="ok">Operational</b></div>
          <div class="r obj"><span>Objective</span><b data-f="obj">—</b></div>
          <div class="wp" data-f="wp"><i data-f="arrow">▲</i><span data-f="dist"></span></div>
        </div>
        <button class="c3d-fp-inspect" type="button" hidden></button>
        <div class="c3d-fp-look" hidden>Click to look around</div>
        <div class="c3d-fp-toast" hidden></div>
        <div class="c3d-fp-hint" hidden></div>
        <div class="c3d-fp-joy" aria-hidden="true"><i></i></div>
        <div class="c3d-fp-btns">
          <button type="button" data-fpa="inspect" class="ins" aria-label="Inspect">◎<span>Inspect</span></button>
          <button type="button" data-fpa="run" aria-label="Run (hold)">»<span>Run</span></button>
          <button type="button" data-fpa="menu" aria-label="Supervisor menu">☰<span>Menu</span></button>
        </div>
        <div class="c3d-fp-menu" role="dialog" aria-label="Supervisor menu" hidden></div>`;
      root.appendChild(layer);
      const $ = s => layer.querySelector(s);
      const pad = $('.c3d-fp-pad'), insEl = $('.c3d-fp-inspect'), lookEl = $('.c3d-fp-look'), toastEl = $('.c3d-fp-toast');
      const hintEl = $('.c3d-fp-hint'), joyEl = $('.c3d-fp-joy'), knob = joyEl.querySelector('i'), menuEl = $('.c3d-fp-menu');
      const hudDiv = $('[data-f="div"]'), hudObj = $('[data-f="obj"]'), hudWp = $('[data-f="wp"]'), hudArrow = $('[data-f="arrow"]'), hudDist = $('[data-f="dist"]');

      // ------------------------------------------------------------ waypoint beam
      const beam = new THREE.Group(); beam.visible = false; ctx.scene.add(beam);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc857, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const beamCol = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 12, 20, 1, true), beamMat); beamCol.position.y = 6; beam.add(beamCol);
      const beamRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), beamMat); beamRing.rotation.x = -Math.PI / 2; beamRing.position.y = 0.05; beam.add(beamRing);

      // ------------------------------------------------------------ state
      const S = {
        on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), tv: new THREE.Vector3(),
        yaw: 0, pitch: 0, tYaw: 0, tPitch: 0, bob: 0, keys: {}, runHeld: false,
        joy: { id: null, x: 0, y: 0, ox: 0, oy: 0 }, look: { id: null, x: 0, y: 0 }, drag: { id: null, x: 0, y: 0 },
        touch: false, locked: false, lockFailed: false, menu: false, menuAt: 0, panel: false, suppressUntil: 0,
        target: null, outlined: null, nextPick: 0, nextHud: 0, done: new Set(), routeOn: true, autoMax: false, help: false,
        people: [], hintTimer: 0, toastTimer: 0, region: '',
      };
      const canLock = !!(pad.requestPointerLock);
      const fwd = new THREE.Vector3(), right = new THREE.Vector3(), tmp = new THREE.Vector3();

      // ------------------------------------------------------------ collision (2D, floor plane)
      function resolve(p) {
        const r = CFG.radius, r2 = r * r;
        for (let it = 0; it < 2; it++) {
          for (const b of colliders.boxes) {
            if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
            const dx = p.x - clamp(p.x, b.minX, b.maxX), dz = p.z - clamp(p.z, b.minZ, b.maxZ), d2 = dx * dx + dz * dz;
            if (d2 >= r2) continue;
            if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; continue; }
            const l = p.x - b.minX, rr = b.maxX - p.x, t = p.z - b.minZ, bt = b.maxZ - p.z, m = Math.min(l, rr, t, bt);
            if (m === l) p.x = b.minX - r; else if (m === rr) p.x = b.maxX + r; else if (m === t) p.z = b.minZ - r; else p.z = b.maxZ + r;
          }
          const circ = colliders.circles.concat(S.people);
          for (const c of circ) {
            const dx = p.x - c.x, dz = p.z - c.z, R = c.r + r, d2 = dx * dx + dz * dz;
            if (d2 >= R * R) continue;
            const d = Math.sqrt(d2) || 1e-4, k = (R - d) / d;
            p.x += (d2 ? dx : 1) * k; p.z += (d2 ? dz : 0) * k;
          }
        }
        const B = colliders.bounds;
        p.x = clamp(p.x, B.minX + r, B.maxX - r); p.z = clamp(p.z, B.minZ + r, B.maxZ - r);
      }

      // ------------------------------------------------------------ where am I
      function regionOf(p) {
        const w = ctx.wingOf(p);
        if (w) return { name: w.division.nameEn, wing: w, color: w.division.color };
        if (p.distanceTo(ctx.HUB) < 11) return { name: 'Intelligence Hub', hub: true, color: '#00e5ff' };
        if (p.z > 6) return { name: 'Lobby', color: '#9fb4ff' };
        if (Math.abs(p.x) <= ctx.C + 0.5) return { name: 'Main Corridor', color: '#9fb4ff' };
        return { name: 'Headquarters floor', color: '#9fb4ff' };
      }
      function objective() {
        for (const s of route) {
          if (S.done.has(s.id)) continue;
          if (s.hub && wingStops.some(w => !S.done.has(w.id))) continue;
          return s;
        }
        return null;
      }
      function waypointPos(s) {
        if (s.hub) return tmp.copy(ctx.HUB);
        return s.wing.group.localToWorld(tmp.set(-ctx.WING_W / 2 - 1.8, 0, 0));
      }

      // ------------------------------------------------------------ HUD
      function updateHud(force) {
        const t = now();
        if (!force && t < S.nextHud) return; S.nextHud = t + 180;
        const reg = regionOf(S.pos);
        if (reg.name !== S.region || force) { S.region = reg.name; hudDiv.textContent = reg.name; hudDiv.style.color = reg.color; }
        const ob = objective();
        const txt = ob ? (ob.hub ? 'Return to Intelligence Hub' : `Inspect ${ob.name}`) : 'All divisions inspected';
        if (hudObj.textContent !== txt) { hudObj.textContent = txt; hudObj.style.color = ob ? ob.color : 'var(--up)'; }
        const inTarget = ob && ((ob.wing && reg.wing === ob.wing) || (ob.hub && reg.hub));
        const showWp = !!(ob && S.routeOn && !inTarget);
        beam.visible = showWp; hudWp.hidden = !showWp;
        if (showWp) {
          const wp = waypointPos(ob);
          beam.position.set(wp.x, 0, wp.z); beamMat.color.set(ob.color); hudArrow.style.color = ob.color;
          const dx = wp.x - S.pos.x, dz = wp.z - S.pos.z;
          const lx = dx * right.x + dz * right.z, lf = dx * fwd.x + dz * fwd.z;
          hudArrow.style.transform = `rotate(${Math.atan2(lx, lf).toFixed(3)}rad)`;
          hudDist.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
        }
      }
      function toast(html, ms = 2600) {
        toastEl.innerHTML = html; toastEl.hidden = false;
        clearTimeout(S.toastTimer); S.toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms);
      }
      function hintHtml() {
        return S.touch
          ? `<b>SUPERVISOR MODE</b><span><i>◐</i> Left thumb · move</span><span><i>↔</i> Swipe right side · look</span><span><i>◎</i> Inspect · <i>»</i> hold to run · <i>☰</i> menu</span>`
          : `<b>SUPERVISOR MODE</b><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move</span><span><kbd>Mouse</kbd> look</span><span><kbd>Shift</kbd> run</span><span><kbd>E</kbd> inspect</span><span><kbd>Esc</kbd> menu</span><span><kbd>F</kbd> full screen</span>`;
      }
      function showHint(force) {
        const key = S.touch ? 'afa.fp.hint.touch' : 'afa.fp.hint.desk';
        if (!force && store.get(key)) return;
        store.set(key, '1');
        hintEl.innerHTML = hintHtml(); hintEl.hidden = false;
        clearTimeout(S.hintTimer); S.hintTimer = setTimeout(() => { hintEl.hidden = true; }, 7000);
      }
      function setTouch(v) {
        if (S.touch === v) return;
        S.touch = v; root.classList.toggle('c3d-fp-touch', v);
        if (v && S.locked) { S.suppressUntil = now() + 400; document.exitPointerLock(); }
        if (S.on) { showHint(false); syncLookLabel(); renderInspect(); }
      }
      function syncLookLabel() {
        lookEl.hidden = !S.on || S.touch || S.locked || S.menu || S.panel;
        lookEl.textContent = canLock && !S.lockFailed ? 'Click to look around · Esc for menu' : 'Drag to look around · Esc for menu';
      }

      // ------------------------------------------------------------ pointer lock
      function requestLock() {
        if (!canLock || S.touch || !S.on || S.lockFailed) return;
        try { const r = pad.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignored */ }
      }
      function releaseLock() { if (document.pointerLockElement === pad) { S.suppressUntil = now() + 400; document.exitPointerLock(); } }
      function onLockChange() {
        const was = S.locked;
        S.locked = document.pointerLockElement === pad;
        if (was && !S.locked && S.on && !S.menu && !S.panel && now() > S.suppressUntil) openMenu();  // Esc released the lock
        syncLookLabel();
      }
      function onLockError() { S.lockFailed = true; syncLookLabel(); }
      function onMouseMove(e) {
        if (!S.on || !S.locked || S.menu || S.panel) return;
        S.tYaw -= (e.movementX || 0) * CFG.mouseSens;
        S.tPitch = clamp(S.tPitch - (e.movementY || 0) * CFG.mouseSens, -1.35, 1.35);
      }

      // ------------------------------------------------------------ pad: mouse (lock / drag look) + touch (joystick + look)
      const JOY_R = 56;
      function joyMove(e) {
        const dx = e.clientX - S.joy.ox, dy = e.clientY - S.joy.oy, m = Math.hypot(dx, dy), k = m > JOY_R ? JOY_R / m : 1;
        S.joy.x = (dx * k) / JOY_R; S.joy.y = (dy * k) / JOY_R;
        knob.style.transform = `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
      }
      function joyReset() {
        S.joy.id = null; S.joy.x = S.joy.y = 0; knob.style.transform = '';
        joyEl.classList.remove('on'); joyEl.style.left = joyEl.style.top = joyEl.style.bottom = '';
      }
      pad.addEventListener('pointerdown', e => {
        if (!S.on || S.menu) return;
        if (e.pointerType === 'mouse') {
          setTouch(false);
          if (S.panel) return;
          if (!S.locked) { requestLock(); S.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { pad.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } }
          return;
        }
        setTouch(true); e.preventDefault();
        if (S.panel) return;
        const r = root.getBoundingClientRect(), x = e.clientX - r.left;
        if (x < r.width * 0.45 && S.joy.id === null) {
          S.joy.id = e.pointerId; S.joy.ox = e.clientX; S.joy.oy = e.clientY;
          joyEl.classList.add('on'); joyEl.style.left = `${x}px`; joyEl.style.top = `${e.clientY - r.top}px`; joyEl.style.bottom = 'auto';
          joyMove(e);
        } else if (S.look.id === null) {
          S.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
        } else return;
        try { pad.setPointerCapture(e.pointerId); } catch (er) { /* ok */ }
      });
      pad.addEventListener('pointermove', e => {
        if (!S.on) return;
        if (e.pointerId === S.joy.id) { joyMove(e); return; }
        const L = e.pointerId === S.look.id ? S.look : e.pointerId === S.drag.id && !S.locked ? S.drag : null;
        if (!L) return;
        const sens = L === S.look ? CFG.touchSens : CFG.mouseSens * 1.6;
        S.tYaw -= (e.clientX - L.x) * sens;
        S.tPitch = clamp(S.tPitch - (e.clientY - L.y) * sens, -1.35, 1.35);
        L.x = e.clientX; L.y = e.clientY;
      });
      const padUp = e => {
        if (e.pointerId === S.joy.id) joyReset();
        if (e.pointerId === S.look.id) S.look.id = null;
        if (e.pointerId === S.drag.id) S.drag.id = null;
      };
      pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
      pad.addEventListener('contextmenu', e => e.preventDefault());

      // ------------------------------------------------------------ action buttons (touch) + inspect prompt
      const btns = $('.c3d-fp-btns');
      btns.addEventListener('pointerdown', e => {
        const b = e.target.closest('[data-fpa]'); if (!b) return;
        e.preventDefault(); e.stopPropagation();
        if (e.pointerType !== 'mouse') setTouch(true);
        const a = b.dataset.fpa;
        if (a === 'run') { S.runHeld = true; b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (er) { /* ok */ } }
        else if (a === 'inspect') { if (S.panel) closePanel(false); else inspect(); }
        else if (a === 'menu') { S.menu ? resume() : openMenu(); }
      });
      const runUp = e => { const b = e.target.closest && e.target.closest('[data-fpa="run"]'); if (b) { S.runHeld = false; b.classList.remove('on'); } };
      btns.addEventListener('pointerup', runUp); btns.addEventListener('pointercancel', runUp);
      btns.addEventListener('click', e => e.stopPropagation());
      insEl.addEventListener('click', e => { e.stopPropagation(); inspect(); });

      // ------------------------------------------------------------ inspection
      const ray = new THREE.Raycaster(), center = new THREE.Vector2(0, 0);
      function findTarget() {
        ray.setFromCamera(center, camera); ray.far = 14;
        const hits = ray.intersectObjects(pickables.fine, false);
        for (const h of hits) {
          const u = h.object.userData;
          if (!u || !u.type) continue;
          if (u.type === 'person') {
            if (u.p.hero || u.p.walker && h.distance > CFG.interactRange) continue;
            if (h.distance <= CFG.interactRange + 0.8) return { kind: 'person', p: u.p, name: u.p.name, sub: u.p.role, key: u.p };
            break;
          }
          if (u.type === 'display') {
            if (h.distance <= ((u.w || 4) > 8 ? 13 : 6.5)) return { kind: 'display', mesh: h.object, name: u.title, sub: 'Data display', key: h.object };
            break;
          }
        }
        let best = null, bestS = -1;
        for (const it of items) {
          const dx = it.pos.x - S.pos.x, dz = it.pos.z - S.pos.z, d = Math.hypot(dx, dz);
          if (d > it.r) continue;
          const dot = d < 0.5 ? 1 : (dx * fwd.x + dz * fwd.z) / d;
          if (dot < 0.55) continue;
          const sc = dot - d / it.r * 0.6 + (it.kind === 'dept' ? 0.1 : 0);
          if (sc > bestS) { bestS = sc; best = it; }
        }
        return best && { kind: best.kind, pod: best.pod, wing: best.wing, name: best.name, sub: best.sub, key: best };
      }
      function renderInspect() {
        const t = S.target;
        insEl.hidden = !t || S.panel || S.menu;
        if (!t) return;
        insEl.innerHTML = S.touch
          ? `<em>Tap to Inspect</em><b>${esc(t.name)}</b>`
          : `<em>Press <kbd>E</kbd> to Inspect</em><b>${esc(t.name)}</b>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}`;
      }
      function setOutline(pod) {
        if (S.outlined === pod) return;
        if (S.outlined && S.outlined !== ctx.selectedPod()) S.outlined.outline.visible = false;
        S.outlined = pod; if (pod) pod.outline.visible = true;
      }
      function updateTarget() {
        const t = now(); if (t < S.nextPick) return; S.nextPick = t + 100;
        const nt = S.panel || S.menu ? null : findTarget();
        const changed = (nt && nt.key) !== (S.target && S.target.key);
        S.target = nt;
        setOutline(nt && (nt.pod || (nt.p && nt.p.dept && ctx.depts[nt.p.dept.id])) || null);
        if (changed) renderInspect();
      }
      function inspect() {
        const t = S.target; if (!t || S.menu) return;
        const c = t.kind === 'person' ? { kind: 'person', p: t.p } : t.kind === 'display' ? { kind: 'display', mesh: t.mesh }
          : t.kind === 'dept' ? { kind: 'dept', pod: t.pod } : t.kind === 'div' ? { kind: 'div', wing: t.wing } : { kind: 'overview' };
        S.panel = true; S.keys = {}; S.vel.set(0, 0, 0); joyReset(); S.look.id = null;
        releaseLock(); ctx.openInfo(c); renderInspect(); syncLookLabel();
        markInspected();
      }
      function closePanel(relock) {
        ctx.closeInfo(); onInfoClosed(relock);
      }
      function onInfoClosed(relock) {
        if (!S.panel) return;
        S.panel = false; S.nextPick = 0; syncLookLabel();
        if (relock !== false) requestLock();
      }
      function markInspected() {
        const reg = regionOf(S.pos);
        let id = reg.wing ? reg.wing.division.id : reg.hub ? '_hub' : null;
        if (id === '_hub' && wingStops.some(w => !S.done.has(w.id))) id = null;   // Hub counts once the wings are done
        if (!id || S.done.has(id) || !route.some(s => s.id === id)) return;
        S.done.add(id);
        const ob = objective();
        toast(ob ? `<i>✓</i> ${esc(reg.name)} inspected · next: ${esc(ob.hub ? 'return to the Intelligence Hub' : ob.name)}`
          : '<i>✓</i> Inspection complete · all divisions operational', ob ? 2800 : 4200);
        updateHud(true);
      }

      // ------------------------------------------------------------ menu
      function renderMenu() {
        const ob = objective();
        menuEl.innerHTML = `<div class="k">SUPERVISOR MENU</div><h3>${esc(hero.name)} <small>${esc(hero.role)}</small></h3>
          <div class="sub">Recommended route <span>· suggestion only, walk anywhere</span></div>
          <ol class="route">${route.map((s, i) => `<li class="${S.done.has(s.id) ? 'ok' : ob === s ? 'cur' : ''}" style="--c:${esc(s.color)}"><i>${S.done.has(s.id) ? '✓' : String(i + 1).padStart(2, '0')}</i>${esc(s.hub ? 'Back to Intelligence Hub' : s.name)}</li>`).join('')}</ol>
          <div class="ctl">
            <button type="button" data-fpm="resume" class="pri">▶ Resume</button>
            <button type="button" data-fpm="route" class="${S.routeOn ? 'on' : ''}">Route guide: ${S.routeOn ? 'ON' : 'OFF'}</button>
            <button type="button" data-fpm="help" class="${S.help ? 'on' : ''}">Controls</button>
            <button type="button" data-fpm="fs">${ctx.isFs() ? '⤢ Exit full screen' : '⛶ Full screen'}</button>
            <button type="button" data-fpm="exit" class="exit">✕ Exit Supervisor Mode</button>
          </div>
          <div class="help" ${S.help ? '' : 'hidden'}>${hintHtml()}</div>`;
      }
      function openMenu() {
        if (!S.on) return;
        S.menu = true; S.menuAt = now(); S.keys = {}; S.runHeld = false; joyReset(); S.look.id = null;
        releaseLock(); renderMenu(); menuEl.hidden = false; hintEl.hidden = true; renderInspect(); syncLookLabel();
      }
      function resume() {
        S.menu = false; menuEl.hidden = true; S.nextPick = 0; syncLookLabel(); requestLock();
      }
      menuEl.addEventListener('click', e => {
        e.stopPropagation();
        const b = e.target.closest('[data-fpm]'); if (!b) return;
        const a = b.dataset.fpm;
        if (a === 'resume') resume();
        else if (a === 'route') { S.routeOn = !S.routeOn; renderMenu(); updateHud(true); }
        else if (a === 'help') { S.help = !S.help; renderMenu(); }
        else if (a === 'fs') { S.suppressUntil = now() + 1500; ctx.toggleFs(); setTimeout(renderMenu, 250); }
        else if (a === 'exit') exit();
      });

      // ------------------------------------------------------------ keyboard (keydown comes from center3d's handler)
      function onKey(e) {
        const k = (e.key || '').toLowerCase();
        if (k === 'escape') {
          e.preventDefault();
          if (S.panel) closePanel(false);
          else if (S.menu) { if (now() - S.menuAt > 350) resume(); }
          else openMenu();
          return;
        }
        if (k === 'f' && !e.ctrlKey && !e.metaKey) { S.suppressUntil = now() + 1500; ctx.toggleFs(); if (S.menu) setTimeout(renderMenu, 250); return; }
        if (S.menu) return;
        if (k === 'e') { e.preventDefault(); if (S.panel) closePanel(true); else inspect(); return; }
        if (S.panel) return;
        if (k === ' ') { e.preventDefault(); return; }
        const m = MOVE_KEYS[k];
        if (m) { e.preventDefault(); S.keys[m] = true; if (!S.locked && !S.touch) syncLookLabel(); }
      }
      function onKeyUp(e) { const m = MOVE_KEYS[(e.key || '').toLowerCase()]; if (m) S.keys[m] = false; }
      function onBlur() { S.keys = {}; S.runHeld = false; }

      // ------------------------------------------------------------ enter / exit
      function enter() {
        if (S.on) return;
        ctx.beforeEnter();
        S.on = true; layer.hidden = false; root.classList.add('c3d-fp');
        S.touch = null;   // force setTouch to apply the class
        setTouch(coarse() || (navigator.maxTouchPoints > 0 && !(window.matchMedia && window.matchMedia('(hover: hover)').matches)));
        hero.route = null;
        S.pos.set(hero.root.position.x, 0, hero.root.position.z); resolve(S.pos);
        const dx = ctx.HUB.x - S.pos.x, dz = ctx.HUB.z - S.pos.z;
        S.yaw = S.tYaw = Math.atan2(-dx, -dz); S.pitch = S.tPitch = 0.12;
        S.vel.set(0, 0, 0); S.keys = {}; S.menu = false; S.panel = false; S.target = null; S.nextPick = 0; menuEl.hidden = true;
        S.people = ctx.people.filter(p => !p.walker && !p.hero).map(p => { const v = p.root.getWorldPosition(tmp); return { x: v.x, z: v.z, r: 0.32 }; });
        hero.root.visible = false;
        camera.fov = 70; camera.near = 0.05; camera.updateProjectionMatrix(); camera.rotation.order = 'YXZ';
        controls.enabled = false; controls.autoRotate = false;
        ctx.setPerf(S.touch || window.innerWidth < 900);
        ctx.fpLook(true);
        S.autoMax = false;
        if (S.touch && !ctx.isFs()) { ctx.setMax(true); S.autoMax = true; }
        place(0);
        updateHud(true); syncLookLabel(); renderInspect();
        showHint(false);
        requestLock();
      }
      function exit(opts = {}) {
        if (!S.on) return;
        S.on = false; releaseLock();
        layer.hidden = true; menuEl.hidden = true; root.classList.remove('c3d-fp');
        beam.visible = false; setOutline(null); S.target = null; joyReset(); S.keys = {};
        if (S.panel) { S.panel = false; ctx.closeInfo(); }
        hero.root.visible = true;
        camera.fov = 45; camera.near = 0.1; camera.updateProjectionMatrix();
        camera.getWorldDirection(tmp); controls.target.copy(camera.position).addScaledVector(tmp, 8);
        controls.enabled = true;
        ctx.setPerf(false); ctx.fpLook(false);
        if (S.autoMax) { ctx.setMax(false); S.autoMax = false; }
        hero.route = ctx.routeHome(); hero.routeIdx = 0; hero.returning = true;
        if (!opts.silent) ctx.go('overview');
      }

      // ------------------------------------------------------------ per frame
      function place(dt) {
        const k = reduceMotion || !dt ? 1 : 1 - Math.exp(-dt * 30);
        S.yaw += (S.tYaw - S.yaw) * k; S.pitch += (S.tPitch - S.pitch) * k;
        fwd.set(-Math.sin(S.yaw), 0, -Math.cos(S.yaw)); right.set(Math.cos(S.yaw), 0, -Math.sin(S.yaw));
        const sp = Math.hypot(S.vel.x, S.vel.z);
        const bob = reduceMotion ? 0 : Math.sin(S.bob * 2) * 0.035 * Math.min(1, sp / CFG.walkSpeed);
        camera.position.set(S.pos.x, CFG.eyeHeight + bob, S.pos.z);
        camera.rotation.set(S.pitch, S.yaw, 0, 'YXZ'); camera.updateMatrixWorld();
        hero.root.position.set(S.pos.x, 0, S.pos.z); hero.root.rotation.y = S.yaw + Math.PI;
        hero.act = sp > 0.3 ? 'walk' : 'idle';
      }
      function update(dt) {
        if (!S.on) return;
        if (S.panel && ctx.infoHidden()) onInfoClosed(false);
        let f = 0, s = 0;
        if (!S.menu && !S.panel) {
          f = (S.keys.f ? 1 : 0) - (S.keys.b ? 1 : 0) - S.joy.y;
          s = (S.keys.r ? 1 : 0) - (S.keys.l ? 1 : 0) + S.joy.x;
        }
        const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
        const run = S.keys.run || S.runHeld || Math.hypot(S.joy.x, S.joy.y) > 0.92;
        const speed = run ? CFG.runSpeed : CFG.walkSpeed;
        S.tv.set(0, 0, 0).addScaledVector(fwd, f * speed).addScaledVector(right, s * speed);
        const a = 1 - Math.exp(-dt * (m > 0.01 ? CFG.accel : CFG.accel * 1.4));
        S.vel.lerp(S.tv, a);
        const sp = Math.hypot(S.vel.x, S.vel.z);
        if (sp < 0.01) S.vel.set(0, 0, 0);
        else {
          const dist = sp * dt, n = Math.max(1, Math.ceil(dist / 0.2));
          for (let i = 0; i < n; i++) { S.pos.x += (S.vel.x * dt) / n; S.pos.z += (S.vel.z * dt) / n; resolve(S.pos); }
          S.bob += dt * sp * 1.9;
          if (!hintEl.hidden && sp > 1) { clearTimeout(S.hintTimer); S.hintTimer = setTimeout(() => { hintEl.hidden = true; }, 2500); }
        }
        place(dt);
        updateTarget();
        updateHud(false);
        if (beam.visible && !reduceMotion) { const t = now() / 1000; beamMat.opacity = 0.24 + Math.sin(t * 3) * 0.1; beamRing.scale.setScalar(1 + (t % 1.5) * 0.4); }
      }

      document.addEventListener('pointerlockchange', onLockChange);
      document.addEventListener('pointerlockerror', onLockError);
      document.addEventListener('mousemove', onMouseMove);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);

      return {
        get on() { return S.on; },
        enter, exit, update, onKey, onInfoClosed,
        debugPlace(x, z, yaw) { S.pos.set(x, 0, z); resolve(S.pos); if (yaw != null) S.yaw = S.tYaw = yaw; S.vel.set(0, 0, 0); },
        debug: () => ({ pos: S.pos.clone(), yaw: S.yaw, pitch: S.pitch, target: S.target && S.target.name, done: [...S.done], menu: S.menu, panel: S.panel, touch: S.touch, locked: S.locked }),
        dispose() {
          exit({ silent: true });
          document.removeEventListener('pointerlockchange', onLockChange);
          document.removeEventListener('pointerlockerror', onLockError);
          document.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('keyup', onKeyUp);
          window.removeEventListener('blur', onBlur);
          clearTimeout(S.hintTimer); clearTimeout(S.toastTimer);
        },
      };
    },
  };
})();
