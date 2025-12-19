import pg from 'pg';
const { Pool, defaults } = pg;

// Глобальная настройка для обхода ошибки self-signed certificate
defaults.ssl = { rejectUnauthorized: false };

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    });

    try {
        const result = await pool.query('SELECT * FROM transactions ORDER BY created_date ASC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('DB Error:', error.message);
        res.status(500).json({ error: error.message });
    } finally {
        await pool.end();
    }
}
