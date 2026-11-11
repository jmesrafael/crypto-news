// Vercel serverless function: GET /api/signal  -> news gate per coin/direction (for the news paper bots)
const { getSignal } = require('../lib/signal');

module.exports = async (req, res) => {
  try {
    const data = await getSignal();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
