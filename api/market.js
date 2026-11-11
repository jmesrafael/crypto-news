// Vercel serverless function: GET /api/market
const { getMarket } = require('../lib/market');

module.exports = async (req, res) => {
  try {
    const data = await getMarket();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
