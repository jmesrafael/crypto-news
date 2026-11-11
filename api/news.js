// Vercel serverless function: GET /api/news
const { getNews } = require('../lib/news');

module.exports = async (req, res) => {
  try {
    const data = await getNews();
    // Vercel's CDN caches for 60s and serves stale copies while it refreshes, so feeds are hit about once a minute.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
