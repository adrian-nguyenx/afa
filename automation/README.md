# Automation (Phase 3)

Python 3.12, standard library only: nothing to install. The scripts collect news, prices and bank rates, classify
news by division and desk, write static JSON for the site (`data/live/`), and send digests and alerts by Email
(Gmail SMTP) and Telegram.

## Quick start (on your computer)

1. Copy `.env.example` (project root) to `.env` and fill in your own secrets. `.env` is git-ignored.
2. Try it without sending anything:
   ```bash
   python automation/run.py --job all --dry-run
   ```
   Email and Telegram previews are written to `automation/out/preview/`.
3. Telegram: create a bot with @BotFather, put the token in `.env`, send `/start` to the bot, then run
   `python automation/run.py --telegram-whoami` to get your chat id.
4. Send for real: `python automation/run.py --job all`, then `python automation/run.py --job digest`.
5. Keep it running on this computer: `python automation/run.py --loop` (checks every minute, runs what is due).

Since Phase 4 the same command runs every 15 minutes in GitHub Actions (`.github/workflows/automation.yml`) for the
live site, switched on by the repository variable `AFA_AUTOMATION_ENABLED=true`, with the secrets stored as GitHub
Actions Secrets. Use either Actions or `--loop` on this computer, not both, or messages are sent twice.

## Jobs

| Job | What it does | Tokens |
|---|---|---|
| `news` | RSS → de-duplicate (URL + title similarity across sources) → classify desk, country, sector, category, importance with keyword rules (`taxonomy.json`) | 0 |
| `translate` | International stories with importance ≥ 2 → Vietnamese headline and summary with Claude Haiku 5.5, Message Batches API (−50%), cached system prompt, JSON schema output. Daily cap 30, monthly budget $1 (`config.json`). Skipped without `ANTHROPIC_API_KEY`; untranslated stories are not shown | small |
| `market` | Prices: VNDirect (VN indices and stocks), Yahoo Finance (US, FX crosses, commodities), Vietcombank (VND rates). Trading hours only, plus a refresh every 3 h | 0 |
| `rates` | Deposit rates from Vietcombank and BIDV public rate APIs; detects changes | 0 |
| `alerts` | High-importance news, price moves over thresholds, rate changes over N bps → instant alert (quiet hours, mute) | 0 |
| `digest` | Rule-based digest per division and desk + market snapshot + deposit rates, at the times in `notify-config.json` (07:00 / 17:00 / 22:00 Vietnam time); each covers the news since the previous slot | 0 |
| `telegram` | Reads bot commands (`/status /latest /digest /mute /unmute /threshold /importance /desks`) from your chat id only | 0 |

## Files

| File | Purpose |
|---|---|
| `config.json` | Backend settings: symbols and sources for prices, bank parsers, AI caps and prices |
| `sources.json` | News feeds (enable/disable per source) |
| `taxonomy.json` | Keyword rules for classification; desk ids must match `assets/js/core/registry.js` (checked on every run) |
| `notify-config.json` | Your preferences (no personal data). Edit on the site at `#/settings` and export |
| `state/` | Run state: news store, sent alerts, schedule, Telegram offset, overrides from Telegram commands |
| `data/live/` (project root) | What the site reads: `news.json`, `quotes.json`, `history/*.json`, `bank-rates.json`, `status.json` |

## Notes on sources

- Only headline, a short summary and the link to the original article are stored.
- Yahoo Finance chart and VNDirect dchart are unofficial public endpoints, used at low frequency for personal,
  non-commercial use. Review them before a public go-live; each can be switched off in `config.json`.
- VnEconomy is disabled (its server sends an incomplete TLS certificate chain). ECB may fail on Windows machines
  missing its intermediate certificate; errors are logged and the run continues.
- Lending rates, policy rates, promotions, banks without a parser and bank fundamentals stay mock data on the site.
