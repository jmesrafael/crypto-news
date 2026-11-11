# Crypto News Pulse

Latest crypto news, plus the markets, macro, tech, AI, banking and world news that moves crypto. Each story gets a **LONG / SHORT / NEUTRAL** read and a ⚡ flag when it's on a market-moving topic. A live price strip sits on top.

There are no npm dependencies and no API keys.

## Sources (all free RSS / public APIs)

| Category | Sources |
|---|---|
| Crypto | Cointelegraph, CoinDesk, Decrypt, The Block, CryptoSlate, Cryptonews, Bitcoin.com, NewsBTC, U.Today, BeInCrypto, CryptoPotato |
| Markets | CNBC, MarketWatch, MarketWatch Pulse, WSJ Markets, Investing.com, FXStreet, BBC Business |
| Macro & central banks | Federal Reserve, ECB, CNBC Economy |
| Tech | TechCrunch, The Verge, Ars Technica, CNBC Tech |
| AI | TechCrunch AI, The Verge AI |
| Banking & payments | Finextra, Banking Dive, Payments Dive, CNBC Finance |
| World | BBC World, Al Jazeera |
| Price strip | CoinGecko (BTC ETH SOL XRP BNB DOGE), Yahoo Finance (S&P 500, Nasdaq, DXY, US 10Y, Gold, Oil), alternative.me Fear & Greed |

To add or remove a feed, edit `FEEDS` in `lib/news.js`.

## Why the page is never empty

There are three layers:

1. **Browser cache.** Each visitor's browser saves the last news it loaded and shows it instantly on the next visit, then pulls fresh news in the background.
2. **Vercel CDN.** `/api/news` is served from cache with `stale-while-revalidate` for up to a day, so a visitor never waits on a cold pull.
3. **Upstash Redis (optional, recommended).** It keeps a running 3-day history on the server. Without it, the feeds only hold the last 10 to 30 stories each.

To turn on layer 3: in your Vercel project, open **Storage → Create / Marketplace → Upstash Redis (free)**, connect it to the project, then redeploy. Vercel adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) automatically, and the code picks up either pair. `/api/news` returns `"persistent": true` once it's working.

## Run locally

```
npm run dev
```

Then open http://localhost:8787

## Deploy on Vercel

Import the repo, choose Framework Preset **Other**, and leave the build command empty.

## Files

- `lib/news.js`: feeds, RSS/Atom parsing, sentiment word lists (`BULL` / `BEAR`), ⚡ impact topics (`IMPACT`)
- `lib/market.js`: price strip data
- `lib/store.js`: optional Upstash Redis store
- `api/news.js`, `api/market.js`: Vercel functions
- `server.js`: local dev server
- `index.html`: the UI

LONG / SHORT is a keyword heuristic for what a headline implies for crypto and risk assets. It is not trading advice.
