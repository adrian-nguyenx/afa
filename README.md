# Adrian Financial Agents

**Financial & Economic Intelligence Center**: a hub that collects, tracks and classifies financial and economic information.

> **Status: Phase 1–3 complete · next: Phase 4 (Go Live).**
> With the automation run, the site shows **real** news, prices, FX and deposit rates (badge **LIVE**); anything without a live source, or the whole site when no live data is reachable, falls back to **MOCK DATA**.

## Run it

There is no install or build step. Open `index.html` in a browser, or serve the folder the way GitHub Pages would:

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

To generate live data first (Python 3.12, no packages to install):

```bash
python automation/run.py --job all --dry-run
```

See [automation/README.md](automation/README.md) for Email/Telegram setup and the scheduled mode.

## Language

The interface is in English. News headlines and summaries stay in Vietnamese, including stories from international sources, and carry `lang="vi"` in the HTML. News metadata (sector, topic, country, importance) is in English.

## Scope

| Division | Desks (each one is an AI agent) |
|---|---|
| 01 Corporate Intelligence | Vietnam Corporate · Global Corporate |
| 02 Macroeconomic Intelligence | Vietnam Macro · Global Macro |
| 03 Market Monitoring | Vietnam Equities · US Equities · Foreign Exchange · Commodities |
| 04 Banking Intelligence | Interest Rates · Vietnam Banks |
| 05 Investment Intelligence | **Coming Soon**. Built only after go-live (Phase 5) |

Pages:

- `#/`: Dashboard with KPIs, chart, top movers, latest/corporate/macro news, indices, FX and commodities.
- `#/news`: News Center, filtered by division, desk, country, sector, topic, time, importance and keyword.
- `#/<division>`: division page with an agent card per desk and the division's news.
- `#/<division>/<desk>`: desk page with coverage, agent info and AI model routing, plus prices, charts, feature blocks and news.
- `#/settings`: Notifications: channels, schedule, instant alerts, price/rate thresholds, desks and categories, plus the automation status.

### Banking Intelligence

**Interest Rates desk** (`#/banking/bank-rates`, `agent.banking.rates`):
- SBV policy rates.
- Comparison and ranking of 18 banks: deposit rates for 1–36M terms, lending rates by product, State-owned/Private filter, best value highlighted, ▲▼ marks for changes in the last 30 days.
- Averages and spread by bank group.
- Alerts for rate changes in the last 7 days.
- Promotional rate programmes.
- Rate change history.
- Trend charts for the average 12M deposit rate and interbank rates.

**Vietnam Banks desk** (`#/banking/vn-banks`, `agent.banking.vn-banks`):
- Sector KPIs.
- Metrics table for 14 banks in three groups:
  - Scale & credit: total assets, loans, deposits, credit growth.
  - Profitability: PBT, PBT YoY, NIM, CASA, ROE, ROA.
  - Asset quality: NPL ratio, NPL coverage, CAR.
- Bar chart comparing any metric across banks.
- Profiles of the major banks.
- Bank stock prices and banking news.

## Phase 2: Adrian Financial Agents HQ, the Living Intelligence Office (`#/3d`)

The 3D page is a real-scale headquarters, generated from the registry, where people and AI agents monitor the financial world. It is built with Three.js r128, whose classic build loads lazily on this page only. There are no external models or assets.

- **Lobby + Intelligence Hub:**
  - Reception and a two-sided logo wall with world clocks.
  - Wall-sized market video walls with a ticker and index tiles.
  - A holographic globe with rotating division panels.
  - The main character **Adrian, Lead Intelligence Operator**, who has a signature face, patrols the hub and stops to brief, analyse and monitor.
- **One office wing per active division**, each with its own identity:
  - **Intelligence wall:** a 24 m division dashboard on the back wall.
    - Corporate: revenue/profit growth, a corporate events feed and an M&A tracker.
    - Macro: GDP, CPI, policy-rate and FX tiles, plus world policy rates.
    - Market: VN-Index, S&P 500, Gold and Brent charts.
    - Banking: the deposit rate curve, credit growth and NPL / coverage.
  - **Ticker band** along the outer wall.
  - **A team pod per desk:**
    - 6 dual-monitor workstations.
    - A holo-table with a 3D visualisation for that desk: 3D bar grids (corporate growth, commodities, the deposit-rate surface by bank × term, bank ROE/NPL/CAR), an animated 3D line chart (VN-Index, S&P 500), macro ring gauges, a global policy-rate globe, an FX carousel and a feed panel.
    - An 11 m live wall display.
    - Analysts and a market watcher.
  - Glass meeting room, analysts at the data wall, and a coffee point.
- **~150 staff at life-like scale** with names, roles and varied routines: typing, reading reports, discussing, meeting, presenting, analysing on data walls, monitoring feeds, and walking between areas.
- **Continuous activity:** screens refresh, charts move, tickers scroll, bars update, lights breathe, and data streams flow from the hub to every wing.
- **Financial district background:** a night skyline inspired by Wall Street / Lower Manhattan, with about 40 towers and 5 landmark supertalls.
  - There are five archetypes: glass slab, art-deco setback, chamfered octagon, tapered obelisk with a spire, and round tower with fins and a helipad.
  - The curtain-wall façades have floor bands, mullions and partially lit office floors.
  - A few towers carry subtle cyan, blue, purple or magenta crowns, and spires carry blinking aircraft lights.
  - The scene adds street grids, a sky dome, horizon city glow and haze.
  - Towers stay outside the HQ footprint and out of the overview camera's line of sight, so the HQ remains the focal point.
- **Full screen:** the **⛶ Full screen** button or the **F** key. It uses the native Fullscreen API, with a CSS fallback where that isn't allowed. **Esc** exits.
- **Performance:**
  - Distant people and workstations drop their detail (limbs, monitors, chairs) and stop animating.
  - Pixel ratio is capped at 1.5.
  - Large animated screens redraw at a lower rate.
- **Camera levels:** Overview → Division → Desk → Employee / Display.
  - Past the overview you can click any person (the camera follows people who are walking) or any screen.
  - **▶ Supervisor Tour:** Adrian, as Chief Intelligence Officer, walks the building and inspects every division in order (01 Corporate → 02 Macro → 03 Market → 04 Banking → Central Command at the hub).
    - He walks real routes (hub ring → corridor → wing door → a clear lane between desk pods), never through walls and never teleporting; the camera follows behind him and pushes in slowly when he arrives.
    - In each room: "ADRIAN IS INSPECTING · SUPERVISING …" banner with a progress bar, desk pods light up one by one, his ring pulses, and a small holographic **Division Status** panel shows active agents, intelligence in the last 24 h, high-importance alerts, last update and status (from the live or mock data). Then "INSPECTION COMPLETE" and he moves on.
    - Tour bar: `SUPERVISOR TOUR — 02 / 05`, the five steps (current highlighted, done ✓, click to jump), and Prev / Pause / Next / Auto ON-OFF / Exit. Keys: ← → Space Esc. Dragging the view pauses the tour.
    - Speeds and inspection time are in `AFA.config.center3d.supervisor`. On exit Adrian walks back to the hub and resumes his patrol.
  - Esc returns to the overview.

### Character faces

There are two separate, original face design systems. Both are painted directly onto the head model, so neither is a mask layer.

**Adrian (main character)** has a signature design:
- A midnight-navy integrated helmet.
- A gold circuit lattice with a gold forehead chevron.
- Gold jaw and nose seams.
- Angular, sweeping lenses that glow cyan.

**AI agents (everyone else)** share one design system:
- A smooth full-head mask with large lenses. Each lens has a black bevel and a rim in the agent's **division colour**.
- Variation between people comes from the base colour (graphite, lilac-white, slate navy, gunmetal), the lens shape (almond, tear, shield), the pattern (hex lattice, panel seams, fine mesh), an optional mesh lens texture and an optional hood.

The two systems are never mixed. The code is `drawAdrianFace` and `drawAgentFace` in `views/center3d.js`. Faces use shared textures, about 20 in total, to keep the scene light.

### AI agent identities

Each desk's AI agent has a display name, inspired by Spider-Verse characters, plus a short code. The technical `agentId`, AI routing, data and workflows are unchanged. All names live in one table (`AGENTS` in `core/registry.js`), so they are easy to swap.

| Division | Desk | Agent | Code |
|---|---|---|---|
| Corporate | Vietnam Corporate | Jessica Drew | `JESSICA-01` |
| Corporate | Global Corporate | Miles Morales | `MILES-02` |
| Macro | Vietnam Macro | Pavitr Prabhakar | `PAVITR-03` |
| Macro | Global Macro | Miguel O'Hara | `MIGUEL-04` |
| Market | Vietnam Equities | Gwen Stacy | `GWEN-05` |
| Market | US Equities | Mayday Parker | `MAYDAY-06` |
| Market | Foreign Exchange | Hobie Brown | `HOBIE-07` |
| Market | Commodities | Spider-Man Noir | `NOIR-08` |
| Banking | Interest Rates | Cindy Moon | `CINDY-09` |
| Banking | Vietnam Banks | Peter Parker | `PETER-10` |

The names appear on division cards, the desk Agent panel (name, code, role, persona and technical ID), the sidebar tooltips, and in the 3D HQ (desk labels, wall displays, info cards and tooltips).

**Agent avatars:** every agent has an original bust portrait (`components/avatars.js`) that appears only in the agent UI:
- the Agent Profile on the desk page,
- the division cards,
- the 3D info card.

The avatars are independent of the 3D character models. Each one is a masked "digital employee" with its own silhouette and accessory (hoodie, hood, fedora with round goggles, mohawk with studs, visor, ponytail, bob, scarf…) inside a HUD frame in the division colour. They are original designs, not copies of Marvel artwork.

**Desk page layout:**
- **Agent Profile** comes first: avatar, name, technical ID and code, role, status, division, desk, persona and automation.
- **Coverage** follows it.
- **Hide/Show toggles:** both the profile and its **AI model routing** section have one. Routing is hidden by default, and both choices are remembered.

> These character names are Marvel trademarks. Review them before a public go-live.

## Phase 3: Automation & Intelligence Distribution

The site is static (GitHub Pages later), so the backend is a scheduled Python script that writes JSON the site reads.

```
cron (this computer: run.py --loop · Phase 4: GitHub Actions every 15 min)
  automation/run.py --job due
    news: RSS → de-duplicate → rule-based classification by division/desk → importance
    translate: important international stories → Vietnamese (Claude Haiku 5.5, Batch API, capped)
    market / rates: prices, FX, deposit rates → change detection
    alerts / digest / telegram: Email (Gmail SMTP) + Telegram
  → data/live/*.json  →  site (api-provider, falls back to mock piece by piece)
```

- **Sources:**
  - News RSS: VnExpress, CafeF (4 feeds), Vietstock, Tuổi Trẻ, Thanh Niên, CNBC (3), MarketWatch, Federal Reserve, ECB.
  - Prices: VNDirect (VN indices and stocks), Yahoo Finance (US, FX crosses, commodities, US10Y, DXY), Vietcombank (VND rates). Both price endpoints are unofficial, used at low frequency for personal use; review before a public go-live.
  - Deposit rates: Vietcombank and BIDV public rate APIs. Other banks, lending rates, policy rates, promotions and bank fundamentals stay mock (labelled).
- **Classification** is rule-based (`automation/taxonomy.json`, 0 tokens). The only LLM step translates international stories into Vietnamese, so headlines stay Vietnamese; without `ANTHROPIC_API_KEY` those stories are held back.
- **Distribution:** digests at 07:30 and 17:00 (Vietnam time); instant alerts for high-importance news, price moves over a threshold and deposit-rate changes ≥ 20 bps; quiet hours; Telegram commands `/status /latest /digest /mute /unmute /threshold /importance /desks`.
- **Preferences** are edited at `#/settings`, saved as a browser draft and exported as `automation/notify-config.json`. It holds no personal data: addresses and tokens are secrets in `.env` (local, git-ignored) or GitHub Secrets.
- **Status:** the topbar badge shows LIVE / STALE (data older than 6 h) / MOCK DATA; each desk's Agent Profile shows its automation status; the AI routing list marks which steps run now.
- **GitHub Actions** (`.github/workflows/automation.yml`) is written but stays off until go-live (repository variable `AFA_AUTOMATION_ENABLED=true`).

## Architecture

```
index.html
assets/css/styles.css            Layout and components
assets/css/theme-futuristic.css  Futuristic / Data Visualization theme (dark only)
assets/js/core/config.js         Config: dataMode, API, symbol lists, AI model routing
assets/js/core/utils.js          Formatting, escaping, seeded random, event bus (AFA.events)
assets/js/core/registry.js       Division/desk tree (single source for navigation and routing)
assets/js/core/services.js       News filtering/sorting, top movers, stats
assets/js/core/router.js         Hash router (#/division/desk), GitHub Pages friendly
assets/js/data/mock-*.js         Mock news, market, rates and banking data
assets/js/providers/             mock-provider.js (active), api-provider.js (stub for a real API)
assets/js/components/            layout, market, news, rates, banking
assets/js/views/                 dashboard, news, division, desk, coming soon, settings (notifications)
assets/js/app.js                 Bootstrap (picks live or mock provider, polling refresh)
automation/                      Phase 3 backend (Python stdlib): run.py, news, market, translate, notify, telegram_bot
data/live/                       JSON written by the automation, read by the site
.github/workflows/automation.yml Scheduled run for Phase 4 (off until enabled)
```

The data flows **Registry → Router → View → Components → `AFA.data` (Provider) → Services**.

- No external libraries and no build step. Charts are plain SVG.
- Classic scripts under the `window.AFA` namespace (no ES modules), so `file://` works.
- **Adding a division or desk:** add an entry to `registry.js`.
- **Adding a desk feature block:** register `AFA.ui.features.<name>` and list it in `department.features`.

### Data providers

`dataMode: 'auto'` (default) reads the static files in `data/live/` and falls back to mock data. A real API server
can replace the files later: return the same schemas, set `api.baseUrl` and `api.mode` in `config.js`. The UI does not change.

```
getNews(filter)            -> Promise<NewsItem[]>
getQuotes(symbols?)        -> Promise<Quote[]>
getHistory(symbol, range)  -> Promise<{ symbol, range, points: [{ t, v }] }>   range: 1M | 3M | 6M | 1Y
getBankRates()             -> Promise<{ terms, lendingTypes, policy, banks, changes, promos, updatedAt }>
getBankFundamentals()      -> Promise<{ period, metrics, banks }>
getStatus()                -> Promise<status.json | null>   // automation status (null in mock mode)
subscribe(channel, cb)     -> unsubscribe()    // polling every refreshIntervalMs
```

```
NewsItem { id, headline, summary, source, url, publishedAt (ISO 8601), divisionId, departmentId,
           country, sector, category, markets[], importance (1 low | 2 medium | 3 high), tags[] }
Quote    { symbol, name, assetClass, departmentId, unit, dp, price, prevClose, change, changePct,
           volume, updatedAt, source }
```

`headline` and `summary` hold Vietnamese text. Every other field is in English.

### AI model routing (token saving)

The routing lives in `AFA.config.ai`. Each desk has an `aiProfile`, and the desk page shows its pipeline with the model for each step.

| Task | Model |
|---|---|
| Collect news, de-duplicate, price feeds, threshold alerts | No LLM (code only, 0 tokens) |
| Translate international news into Vietnamese (live in Phase 3) | `claude-haiku-5-5`: low effort, Batch API, ≤300 tokens, 30 stories/day, $1/month cap |
| Classify, score importance, summarise, extract financial metrics, parse rate sheets | `claude-haiku-5-5`: low/medium effort, Batch API (-50%), capped `max_tokens` |
| Daily digest, impact analysis | `claude-sonnet-5-5`: medium effort |
| Research & valuation (Phase 5) | `claude-opus-5-5`: only when deep analysis is needed |

Fixed prompts (system prompt and taxonomy) are cached, and outputs are short JSON (structured outputs).
In Phase 3, classification, scoring and digests run as rules instead of Haiku/Sonnet (0 tokens); they can be switched to the routed model later.
The Claude API is billed separately from a Claude Pro plan.

## Roadmap

1. Phase 1: Intelligence Center (web, mock data). *Completed.*
2. Phase 2: 3D Financial Intelligence Center. *Completed.*
3. Phase 3: Automation & Intelligence Distribution (Email/Telegram). *Completed.*
4. Phase 4: Go Live.
5. Phase 5: Investment Intelligence.

Each phase starts only after the previous one has been reviewed and confirmed.
