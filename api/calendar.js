// Vercel serverless function: GET /api/calendar
const { getCalendar } = require('../lib/calendar');

module.exports = async (req, res) => {
  try {
    const data = await getCalendar();
    // ForexFactory asks clients not to poll hard; 30 min CDN cache is plenty for a weekly calendar.
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(data));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
