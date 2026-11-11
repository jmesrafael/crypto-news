// Vercel serverless function: GET /api/news
const { getNews } = require('../lib/news');

module.exports = async (req, res) => {
  try {
    const data = await getNews();
    // CDN serves the cached copy instantly for up to a day while it refreshes in the background,
    // so visitors never wait on (or see an empty page from) a cold pull. Fresh data at most ~60s old under traffic.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
