const { Pool } = require('pg');

module.exports = async (req, res) => {
    // Включаем CORS для локальной разработки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { rows } = await pool.query('SELECT * FROM transactions ORDER BY created_date ASC');
        res.status(200).json(rows);
    } catch (error) {
        console.error('Fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions', details: error.message });
    } finally {
        await pool.end();
    }
};
