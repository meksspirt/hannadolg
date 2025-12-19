const { Pool } = require('pg');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!connectionString) {
        return res.status(500).json({
            error: "Конфигурация базы данных отсутствует. Проверьте переменную DATABASE_URL или POSTGRES_URL в Vercel.",
            envKeys: Object.keys(process.env).filter(k => k.includes('URL') || k.includes('POSTGRES'))
        });
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : false
    });

    try {
        const result = await pool.query('SELECT * FROM transactions ORDER BY created_date DESC');
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({
            error: "Ошибка БД: " + error.message,
            hint: "Убедитесь, что таблица 'transactions' создана в базе данных через SQL Editor."
        });
    } finally {
        await pool.end();
    }
};
