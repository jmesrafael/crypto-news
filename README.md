# Pulse — Market Intel

A dark-terminal dashboard covering market mood, your watchlist, the week's biggest stories, countdowns to market-moving events, and a live news wire with LONG / SHORT sentiment. It has no npm dependencies, needs no API keys, and uses no AI.

## Pages

| Page | What's on it |
|---|---|
| `/` Overview | Countdowns (FOMC, CPI, PPI, NFP, halving) · market mood gauge · **watchlist** (SOL, ZEC, ADA, NEAR, GALA) · Fear & Greed · KPIs · top coins with 7d charts · gainers/losers · macro · this week's highlights · latest headlines · sector sentiment · most-mentioned assets · high-impact events |
| `/markets` | Everything above, plus a top-50 heatmap, 30-day Fear & Greed chart, watchlist news and a sortable top-100 table |
| `/highlights` | The week's biggest stories, ranked by how many outlets covered them, with related coverage, outlet weekly roundups and an archive of past daily briefs |
| `/ai` AI & Tech | Trending AI/tech stories (2+ outlets, 48h) · 🚀 launches & lab announcements (OpenAI, Google, NVIDIA, Hugging Face, Anthropic via Google News) · 🔥 viral on Hacker News · countdown reminders + tables for big-tech earnings (Nasdaq) and IPOs · AI/tech wire with sentiment |
| `/security` Hacks & Security | Trending security stories · crypto exploits last 30d with $ amounts (DeFiLlama) · actively exploited CVEs (CISA KEV) · crypto security headlines · security wire |
| `/news` | Live wire from 33 feeds (crypto, markets, macro, tech, AI, banking, world) with filters |
| `/calendar` | Countdowns and this week's economic calendar in PHT |

## How data flows

- **Live** (Vercel functions with CDN caching; the browser shows the last saved copy instantly):
  - `/api/news`: 33 RSS feeds
  - `/api/markets`: CoinGecko, alternative.me Fear & Greed, Yahoo macro tickers
  - `/api/calendar`: ForexFactory weekly calendar, `data/events.json`, mempool.space for the halving estimate
- **Daily brief, 07:00 PHT**: `.github/workflows/pulse.yml` collects headlines every 3 hours into a rolling 8-day history kept in the Actions cache. At 23:00 UTC (07:00 PHT) it runs `scripts/pulse.js publish`, which:
  - writes `data/highlights.json` and `data/briefs/<date>.json`
  - refreshes `data/calendar-week.json`, the fallback copy used when ForexFactory rate-limits
  - commits the result, which makes Vercel redeploy

  GitHub can start scheduled runs 5–30 minutes late. To publish immediately, go to the **Actions** tab, open **Pulse highlights**, and click **Run workflow**.

## Editing by hand

- **Pin a story**: add `{"title","link","summary","image","source","date"}` to `data/pinned.json`. It shows for 7 days from `date`, or until `until` if you set one.
- **Future key dates** (FOMC, CPI…): edit `data/events.json`. Dates for the current week come from ForexFactory automatically.
- **Watchlist**: edit `WATCHLIST` in `lib/markets.js` (CoinGecko ids).
- **Feeds / sentiment words**: `FEEDS`, `BULL`, `BEAR`, `IMPACT` in `lib/news.js`. Weekly roundup feeds are in `lib/roundups.js`.

## Run locally

```
npm run dev                         # http://localhost:8787
node scripts/pulse.js all           # collect + publish highlights locally
```

## Deploy

Import the repo into Vercel with Framework Preset **Other** and no build command. Functions run in `sin1` (Singapore). Optionally, add Upstash Redis from Vercel's Storage tab so `/api/news` keeps a 3-day history between cold starts.

LONG / SHORT and mood reads are heuristics, not trading advice.
