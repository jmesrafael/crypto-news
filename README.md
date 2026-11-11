# Crypto News Pulse

Latest crypto news from 11 free RSS feeds (Cointelegraph, CoinDesk, Decrypt, The Block, CryptoSlate, Cryptonews, Bitcoin.com, NewsBTC, U.Today, BeInCrypto, CryptoPotato), each tagged **LONG / SHORT / NEUTRAL** by a keyword sentiment read.

No dependencies and no API keys.

## Run locally

```
npm run dev
```

Open http://localhost:8787

## Deploy on Vercel

Import the repo. Choose Framework Preset **Other** and leave the build command empty. Vercel then serves `index.html` as the page and `api/news.js` as the `/api/news` function. The CDN caches responses for 60 seconds.

## Files

- `lib/news.js`: feed list, RSS parsing, sentiment word lists (edit `BULL` / `BEAR` to tune)
- `api/news.js`: Vercel function
- `server.js`: local dev server
- `index.html`: the UI

Sentiment is a keyword heuristic, not trading advice.
