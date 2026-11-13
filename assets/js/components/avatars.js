/* Agent avatars — original bust portraits drawn on canvas, used ONLY in Agent Information / Agent Profile UI.
 * Independent from the 3D character models (no textures are shared with the 3D scene).
 * Each look is an original design: a masked "digital employee" with a signature silhouette / accessory
 * matched to the agent persona, framed by a futuristic HUD in the division colour.
 */
window.AFA = window.AFA || {};
AFA.ui = AFA.ui || {};

(function () {
  // style: signature silhouette; mask/suit/accent: palette; lens: eye-lens shape
  const LOOKS = {
    'vn-corporate':     { style: 'longhair', mask: '#3a1222', suit: '#2a0f1a', hair: '#1a0b10', accent: '#ffb347', lens: 'angled' },
    'global-corporate': { style: 'hoodie',   mask: '#15161c', suit: '#24262f', accent: '#ff3b4f', lens: 'tear' },
    'vn-macro':         { style: 'scarf',    mask: '#1f2a5c', suit: '#192046', hair: '#120c08', accent: '#ff9f1c', lens: 'almond' },
    'global-macro':     { style: 'visor',    mask: '#0f1a38', suit: '#0b1430', accent: '#ff2e63', lens: 'visor' },
    'vn-equities':      { style: 'hood',     mask: '#eeebf6', suit: '#d9d5e6', accent: '#ff4fa3', lens: 'almond' },
    'us-equities':      { style: 'ponytail', mask: '#2b2f45', suit: '#20243a', hair: '#7a3b1e', accent: '#e6404f', lens: 'tear' },
    'fx':               { style: 'mohawk',   mask: '#1b1b20', suit: '#2b1f2f', hair: '#ffd400', accent: '#ffd400', lens: 'angled' },
    'commodities':      { style: 'fedora',   mask: '#121214', suit: '#1d1d21', accent: '#d9d9d9', lens: 'round' },
    'bank-rates':       { style: 'bob',      mask: '#1a1a1f', suit: '#f1f1f3', hair: '#0c0c10', accent: '#f4f4f4', lens: 'almond' },
    'vn-banks':         { style: 'classic',  mask: '#25305a', suit: '#1a2244', accent: '#e63946', lens: 'tear' },
  };
  const FALLBACK = { style: 'classic', mask: '#2b3449', suit: '#1f2738', accent: '#00e5ff', lens: 'almond' };
  const cache = {};

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c * k)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  }
  function lens(g, cx, cy, w, h, side, shape) {
    g.beginPath();
    if (shape === 'round') g.arc(cx, cy, h * 0.95, 0, Math.PI * 2);
    else if (shape === 'almond') g.ellipse(cx, cy, w, h, side * 0.35, 0, Math.PI * 2);
    else if (shape === 'tear') {
      g.moveTo(cx - side * w * 0.95, cy + h * 0.35);
      g.quadraticCurveTo(cx - side * w * 0.9, cy - h * 1.2, cx + side * w * 1.15, cy - h * 0.55);
      g.quadraticCurveTo(cx + side * w * 0.65, cy + h * 1.2, cx - side * w * 0.95, cy + h * 0.35);
    } else { // angled
      g.moveTo(cx - side * w, cy - h * 0.2); g.lineTo(cx + side * w * 1.1, cy - h * 0.95);
      g.lineTo(cx + side * w * 0.75, cy + h * 0.85); g.lineTo(cx - side * w * 0.8, cy + h * 0.7);
    }
    g.closePath();
  }

  function draw(p, L, divColor) {
    const W = 300, H = 360, cx = W / 2, hy = 150; // head centre
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    // --- background: division-tinted gradient + HUD
    const bg = g.createRadialGradient(cx, 130, 10, cx, 160, 260);
    bg.addColorStop(0, shade(divColor, 0.55)); bg.addColorStop(0.55, '#0b1230'); bg.addColorStop(1, '#04060f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,160,255,0.08)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = divColor; g.globalAlpha = 0.5; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, hy, 104, -2.4, -0.7); g.stroke();
    g.beginPath(); g.arc(cx, hy, 104, 0.6, 2.5); g.stroke();
    g.globalAlpha = 0.25; g.beginPath(); g.arc(cx, hy, 118, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 118, hy + Math.sin(a) * 118); g.lineTo(cx + Math.cos(a) * (i % 3 ? 122 : 128), hy + Math.sin(a) * (i % 3 ? 122 : 128)); g.stroke(); }
    g.globalAlpha = 1;
    // corner brackets
    g.strokeStyle = divColor; g.lineWidth = 3;
    [[10, 10, 1, 1], [W - 10, 10, -1, 1], [10, H - 10, 1, -1], [W - 10, H - 10, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * 22); g.lineTo(x, y); g.lineTo(x + sx * 22, y); g.stroke(); });

    // --- back layers (hair / hood behind head)
    if (L.style === 'longhair') { g.fillStyle = L.hair; g.beginPath(); g.moveTo(cx - 70, hy - 10); g.quadraticCurveTo(cx - 95, hy + 120, cx - 60, hy + 150); g.lineTo(cx + 60, hy + 150); g.quadraticCurveTo(cx + 95, hy + 120, cx + 70, hy - 10); g.closePath(); g.fill(); }
    if (L.style === 'bob') { g.fillStyle = L.hair; g.beginPath(); g.ellipse(cx, hy + 6, 76, 82, 0, 0, Math.PI * 2); g.fill(); }
    if (L.style === 'ponytail') { g.fillStyle = L.hair; g.beginPath(); g.moveTo(cx + 40, hy - 50); g.quadraticCurveTo(cx + 130, hy - 30, cx + 95, hy + 90); g.quadraticCurveTo(cx + 80, hy + 20, cx + 30, hy - 20); g.closePath(); g.fill(); }
    if (L.style === 'hoodie' || L.style === 'hood') {
      const hc = L.style === 'hood' ? '#f7f5fb' : '#2c2f3a';
      g.fillStyle = hc; g.beginPath(); g.ellipse(cx, hy + 8, 88, 96, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = L.style === 'hood' ? 'rgba(120,100,160,0.45)' : 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, hy + 8, 88, 96, 0, 0, Math.PI * 2); g.stroke();
    }

    // --- bust / shoulders
    const sg = g.createLinearGradient(0, 230, 0, H);
    sg.addColorStop(0, shade(L.suit, 1.35)); sg.addColorStop(1, shade(L.suit, 0.7));
    g.fillStyle = sg;
    g.beginPath(); g.moveTo(cx - 140, H); g.quadraticCurveTo(cx - 132, 262, cx - 52, 240); g.lineTo(cx + 52, 240); g.quadraticCurveTo(cx + 132, 262, cx + 140, H); g.closePath(); g.fill();
    g.fillStyle = shade(L.mask, 0.85); g.fillRect(cx - 26, 205, 52, 42); // neck
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
    if (L.style === 'hoodie') { // hoodie front + drawstrings
      g.strokeStyle = '#1a1c23'; g.lineWidth = 6; g.beginPath(); g.moveTo(cx - 60, 246); g.quadraticCurveTo(cx, 290, cx + 60, 246); g.stroke();
      g.strokeStyle = '#e8e8ee'; g.lineWidth = 3; [-14, 14].forEach(d => { g.beginPath(); g.moveTo(cx + d, 262); g.lineTo(cx + d * 1.3, 318); g.stroke(); });
    } else if (L.style === 'fedora') { // trench coat lapels
      g.fillStyle = shade(L.suit, 1.6); [-1, 1].forEach(s => { g.beginPath(); g.moveTo(cx + s * 22, 244); g.lineTo(cx + s * 78, 270); g.lineTo(cx + s * 30, H); g.closePath(); g.fill(); });
    } else if (L.style === 'mohawk') { // studded jacket
      g.fillStyle = '#c9ccd6'; for (let i = 0; i < 6; i++) [-1, 1].forEach(s => { g.beginPath(); g.arc(cx + s * (70 + i * 10), 262 + i * 6, 3.2, 0, 7); g.fill(); });
      g.strokeStyle = L.accent; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 40, 300); g.lineTo(cx + 40, 330); g.stroke();
    } else if (L.style === 'visor') { // high tech collar / cape points
      g.fillStyle = shade(L.suit, 1.8); [-1, 1].forEach(s => { g.beginPath(); g.moveTo(cx + s * 40, 238); g.lineTo(cx + s * 110, 252); g.lineTo(cx + s * 62, 284); g.closePath(); g.fill(); });
    } else if (L.style === 'scarf') {
      g.fillStyle = L.accent; g.beginPath(); g.ellipse(cx, 242, 64, 18, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(L.accent, 0.7); g.fillRect(cx + 20, 248, 22, 70);
    } else { // collar
      g.strokeStyle = L.accent; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 54, 242); g.lineTo(cx, 278); g.lineTo(cx + 54, 242); g.stroke();
    }
    // chest emblem: agent code chevron (original mark, not a character emblem)
    g.strokeStyle = L.accent; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 14, 318); g.lineTo(cx, 300); g.lineTo(cx + 14, 318); g.stroke();

    // --- head (full-face mask)
    const hg = g.createRadialGradient(cx - 22, hy - 30, 8, cx, hy, 82);
    hg.addColorStop(0, shade(L.mask, 1.45)); hg.addColorStop(1, shade(L.mask, 0.75));
    g.fillStyle = hg; g.beginPath(); g.ellipse(cx, hy, 62, 74, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, hy - 72); g.lineTo(cx, hy + 72); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.ellipse(cx, hy, 62 - Math.abs(i) * 4, 74, 0, -1.3, 1.3); g.stroke(); }
    // lenses
    if (L.lens === 'visor') {
      g.fillStyle = '#08080c'; g.beginPath(); g.moveTo(cx - 58, hy - 8); g.lineTo(cx + 58, hy - 8); g.lineTo(cx + 46, hy + 16); g.lineTo(cx - 46, hy + 16); g.closePath(); g.fill();
      const vg = g.createLinearGradient(cx - 50, 0, cx + 50, 0); vg.addColorStop(0, L.accent); vg.addColorStop(0.5, '#ffffff'); vg.addColorStop(1, L.accent);
      g.fillStyle = vg; g.shadowColor = L.accent; g.shadowBlur = 18; g.beginPath(); g.moveTo(cx - 50, hy - 3); g.lineTo(cx + 50, hy - 3); g.lineTo(cx + 40, hy + 11); g.lineTo(cx - 40, hy + 11); g.closePath(); g.fill(); g.shadowBlur = 0;
    } else {
      [-1, 1].forEach(side => {
        const ex = cx + side * 26, ey = hy - 4;
        lens(g, ex, ey, 21, 15, side, L.lens);
        g.lineJoin = 'round'; g.strokeStyle = '#06060a'; g.lineWidth = 9; g.stroke();
        g.strokeStyle = L.accent; g.lineWidth = 3.5; g.stroke();
        const lg = g.createLinearGradient(ex, ey - 15, ex, ey + 15); lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, '#cfd8ec');
        g.fillStyle = lg; g.shadowColor = L.accent; g.shadowBlur = 10; g.fill(); g.shadowBlur = 0;
      });
    }
    // --- front accessories
    if (L.style === 'fedora') {
      g.fillStyle = '#18181b'; g.beginPath(); g.ellipse(cx, hy - 52, 98, 18, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(cx - 56, hy - 54); g.quadraticCurveTo(cx - 52, hy - 120, cx, hy - 116); g.quadraticCurveTo(cx + 52, hy - 120, cx + 56, hy - 54); g.closePath(); g.fill();
      g.fillStyle = '#3a3a40'; g.fillRect(cx - 56, hy - 70, 112, 12);
    }
    if (L.style === 'mohawk') { g.fillStyle = L.hair; for (let i = 0; i < 6; i++) { const x = cx - 22 + i * 9; g.beginPath(); g.moveTo(x - 7, hy - 62); g.lineTo(x + 2, hy - 112 - (i % 2) * 14); g.lineTo(x + 8, hy - 62); g.closePath(); g.fill(); } }
    if (L.style === 'longhair' || L.style === 'bob' || L.style === 'ponytail' || L.style === 'scarf') {
      g.fillStyle = L.hair; g.beginPath(); g.ellipse(cx, hy - 52, 60, 30, 0, Math.PI, Math.PI * 2); g.fill();
    }
    if (L.style === 'hood' || L.style === 'hoodie') { // hood edge over the brow
      g.strokeStyle = L.style === 'hood' ? '#ffffff' : '#383b47'; g.lineWidth = 10; g.beginPath(); g.ellipse(cx, hy + 4, 70, 82, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      if (L.style === 'hood') { g.strokeStyle = L.accent; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, hy + 4, 76, 88, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    }
    // neon rim light
    g.strokeStyle = divColor; g.globalAlpha = 0.75; g.lineWidth = 3; g.shadowColor = divColor; g.shadowBlur = 14;
    g.beginPath(); g.ellipse(cx, hy, 63, 75, 0, -0.4, 0.9); g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1;
    // HUD label
    g.fillStyle = 'rgba(4,6,15,0.75)'; g.fillRect(16, H - 40, W - 32, 26);
    g.fillStyle = divColor; g.font = '700 14px Consolas, monospace'; g.fillText(p.agent.code, 26, H - 22);
    g.fillStyle = '#3dffb5'; g.beginPath(); g.arc(W - 34, H - 27, 5, 0, 7); g.fill();
    g.fillStyle = '#cfd6ff'; g.font = '600 11px Consolas, monospace'; g.textAlign = 'right'; g.fillText('ONLINE', W - 44, H - 23);
    return c.toDataURL('image/png');
  }

  /** <img> avatar for a desk's agent. size: 'xs' | 'sm' | 'md' | 'lg' */
  AFA.ui.agentAvatar = function (p, size = 'md') {
    if (!p || !p.agent) return '';
    if (!cache[p.id]) {
      const d = AFA.registry.getDivision(p.divisionId);
      try { cache[p.id] = draw(p, LOOKS[p.id] || FALLBACK, (d && d.color) || '#00e5ff'); } catch (e) { cache[p.id] = ''; }
    }
    return cache[p.id] ? `<img class="avatar avatar-${size}" src="${cache[p.id]}" alt="${AFA.utils.esc(p.agent.name)} — agent avatar" loading="lazy">` : '';
  };
})();
