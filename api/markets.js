// Vercel serverless function: GET /api/markets
const { getMarkets } = require('../lib/markets');

module.exports = async (req, res) => {
  try {
    const data = await getMarkets();
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
