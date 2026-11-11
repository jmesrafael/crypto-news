// Vercel serverless function: GET /api/tech  (Hacker News, crypto hacks, CISA KEV, IPOs, earnings)
const { getTech } = require('../lib/tech');

module.exports = async (req, res) => {
  try {
    const data = await getTech();
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
