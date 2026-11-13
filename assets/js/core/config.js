/* Adrian Financial Agents — app configuration.
 * dataMode 'auto' (Phase 3): read the static JSON written by automation/ (data/live/*.json) and fall back to
 * mock data for anything missing or when the files cannot be fetched (e.g. opened via file://).
 */
window.AFA = window.AFA || {};

AFA.config = {
  appName: 'Adrian Financial Agents',
  tagline: 'Financial & Economic Intelligence Center',
  version: '1.4.0-phase4',
  phase: 4,
  siteUrl: 'https://adrian-nguyenx.github.io/afa/',
  // Shown in the sidebar footer and the data badge tooltip
  disclaimer: 'For information only, not investment advice. Prices from unofficial public sources (VNDirect, Yahoo Finance), may be delayed or inaccurate.',

  // 'auto' (live JSON + mock fallback) | 'api' (same, no fallback at boot) | 'mock'
  dataMode: 'auto',

  api: {
    // 'static': JSON files produced by automation/run.py (GitHub Actions cron in Phase 4). 'rest': a real API server.
    mode: 'static',
    baseUrl: 'data/live',
    endpoints: {
      news: '/news.json',
      quotes: '/quotes.json',
      history: '/history/{symbol}.json',
      bankRates: '/bank-rates.json',
      bankFundamentals: null,  // no automated source in Phase 3 (needs AI extraction) → mock
      status: '/status.json',
    },
    staleAfterHours: 6,      // older live data is labelled STALE
    timeoutMs: 10000,
  },

  // Notification preferences shown on #/settings (edited there, exported as automation/notify-config.json)
  notifyConfigUrl: 'automation/notify-config.json',

  // Poll the live JSON for updates (the automation rewrites it every 15–30 min). 0 = off.
  refreshIntervalMs: 300000,

  locale: 'en-US',
  clocks: [
    { label: 'HCM', tz: 'Asia/Ho_Chi_Minh' },
    { label: 'NY', tz: 'America/New_York' },
    { label: 'LDN', tz: 'Europe/London' },
    { label: 'TYO', tz: 'Asia/Tokyo' },
  ],

  tickerSymbols: ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOM', 'SPX', 'IXIC', 'DJI', 'USDVND', 'EURVND', 'JPYVND', 'XAUUSD', 'XAGUSD', 'WTI', 'BRENT', 'US10Y', 'DXY'],

  /* AI model routing — use the cheapest model that is good enough for each task to save tokens.
   * Phase 3 runs rule-based only; the single live LLM step is `translate` (see automation/config.json → ai.runtime).
   * Rules:
   *  1. Anything code can do (RSS/API collection, de-duplication, price feeds, threshold alerts) → NO LLM (0 tokens).
   *  2. High-volume, short-output work (classify, score, summarise, extract) → Haiku, low effort, Batch API (-50%).
   *  3. Written digests and analysis that need reasoning → Sonnet, medium effort.
   *  4. Rare deep analysis (Investment division — Phase 5) → Opus.
   *  5. Always cache the fixed system prompt + taxonomy; force short JSON via structured outputs; cap max_tokens.
   */
  ai: {
    models: {
      none: { id: null, label: 'Rule-based', note: 'No LLM — 0 tokens' },
      fast: { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', note: 'Cheapest, high volume' },
      balanced: { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', note: 'Writing & moderate reasoning' },
      deep: { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', note: 'Deep analysis, used sparingly' },
    },
    tasks: {
      collect:    { label: 'Collect news (RSS/API/crawler)', tier: 'none' },
      translate:  { label: 'Translate international news into Vietnamese', tier: 'fast', effort: 'low', batch: true, maxTokens: 300 },
      dedupe:     { label: 'De-duplicate (URL + title similarity)', tier: 'none' },
      classify:   { label: 'Classify division/desk/country/sector', tier: 'fast', effort: 'low', batch: true, maxTokens: 256 },
      score:      { label: 'Score importance', tier: 'fast', effort: 'low', batch: true, maxTokens: 64 },
      summarize:  { label: 'Summarise news', tier: 'fast', effort: 'medium', batch: true, maxTokens: 400 },
      marketData: { label: 'Update prices/indices', tier: 'none' },
      alerts:     { label: 'Threshold alerts', tier: 'none' },
      digest:     { label: 'Daily digest / market summary', tier: 'balanced', effort: 'medium', maxTokens: 2000 },
      extractFin: { label: 'Extract metrics from financial statements (NIM, NPL, CAR…)', tier: 'fast', effort: 'low', batch: true, maxTokens: 800 },
      rateParse:  { label: 'Parse rate sheets & promotions', tier: 'fast', effort: 'low', batch: true, maxTokens: 600 },
      impact:     { label: 'Macro/corporate impact analysis', tier: 'balanced', effort: 'medium', maxTokens: 1500 },
      research:   { label: 'Research & valuation (Phase 5)', tier: 'deep', effort: 'high', planned: true },
    },
    // Pipeline per department type (registry: department.aiProfile)
    profiles: {
      news:   ['collect', 'dedupe', 'classify', 'score', 'translate', 'summarize', 'impact', 'digest'],
      market: ['marketData', 'alerts', 'collect', 'dedupe', 'classify', 'translate', 'summarize', 'digest'],
      rates:  ['collect', 'rateParse', 'dedupe', 'alerts', 'summarize', 'digest'],
      banking: ['collect', 'dedupe', 'classify', 'summarize', 'extractFin', 'impact', 'digest'],
    },
    // What actually runs in Phase 3 (mirrors automation/config.json). Steps not listed here are planned, not active.
    // classify/score/digest run as code (rule-based, 0 tokens) instead of an LLM for now.
    runtime: {
      collect: 'live', dedupe: 'live', marketData: 'live', alerts: 'live', translate: 'live',
      classify: 'rules', score: 'rules', digest: 'rules', rateParse: 'rules',
    },
    promptCaching: true,
  },

  // Phase 2 — 3D headquarters (Three.js classic build, loaded lazily on #/3d)
  center3d: {
    libs: [
      'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
    ],
    // Supervisor Tour: Adrian walks the building (01 → 04 → Central Command) and inspects each division
    supervisor: {
      walkSpeed: 3.2,       // m/s inside the lobby and wings
      corridorSpeed: 4.8,   // m/s on the long corridor legs
      inspectMs: 8000,      // time spent inspecting each division
    },
    // Main character of the HQ (signature face design lives in views/center3d.js → drawAdrianFace)
    hero: {
      name: 'Adrian',
      role: 'Lead Intelligence Operator',
    },
  },

  dashboard: {
    kpiSymbols: ['VNINDEX', 'SPX', 'IXIC', 'DJI', 'USDVND', 'XAUUSD', 'XAGUSD', 'BRENT'],
    featuredChart: 'VNINDEX',
    indexTable: ['VNINDEX', 'VN30', 'HNXINDEX', 'UPCOM', 'SPX', 'IXIC', 'DJI'],
    fxTable: ['USDVND', 'EURVND', 'JPYVND', 'CNYVND', 'EURUSD', 'USDJPY'],
    commodityTable: ['XAUUSD', 'XAGUSD', 'WTI', 'BRENT', 'NG', 'HG'],
  },
};
