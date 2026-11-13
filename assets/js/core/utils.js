/* Utilities: escape, number/date formatting, seeded random, event bus. */
window.AFA = window.AFA || {};

(function () {
  const loaded = {};
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  const utils = {
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]),

    fmtNum(v, dp = 2) {
      if (v == null || isNaN(v)) return '—';
      return Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    },
    fmtSigned(v, dp = 2) {
      if (v == null || isNaN(v)) return '—';
      return (v > 0 ? '+' : '') + utils.fmtNum(v, dp);
    },
    fmtPct(v) {
      if (v == null || isNaN(v)) return '—';
      return (v > 0 ? '+' : '') + Number(v).toFixed(2) + '%';
    },
    fmtCompact(v) {
      if (v == null || isNaN(v)) return '—';
      const a = Math.abs(v);
      if (a >= 1e12) return (v / 1e12).toFixed(2) + 'T';
      if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
      return String(v);
    },
    dir: v => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat'),
    arrow: v => (v > 0 ? '▲' : v < 0 ? '▼' : '■'),

    timeAgo(iso) {
      const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s / 60) + 'm ago';
      if (s < 86400) return Math.floor(s / 3600) + 'h ago';
      return Math.floor(s / 86400) + 'd ago';
    },
    fmtDate(iso) {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    },
    fmtDateTime(iso) {
      const d = new Date(iso);
      const p = n => String(n).padStart(2, '0');
      return `${utils.fmtDate(iso)} ${p(d.getHours())}:${p(d.getMinutes())}`;
    },
    fmtShortDate(iso) {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
    },

    hash(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    },
    // mulberry32 — random có seed để mock data ổn định giữa các lần tải
    seeded(seed) {
      let a = seed >>> 0;
      return function () {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },

    loadScript(src) {
      loaded[src] = loaded[src] || new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src; s.async = true; s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => { delete loaded[src]; reject(new Error('Failed to load ' + src)); };
        document.head.appendChild(s);
      });
      return loaded[src];
    },

    storage: {
      get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    },
  };

  /* Event bus nhẹ — điểm mở rộng cho real-time data, notification, AI agents (Phase 3+). */
  const listeners = {};
  AFA.events = {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => AFA.events.off(evt, fn); },
    off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); },
    emit(evt, payload) { (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); },
  };

  AFA.utils = utils;
})();
