const { Pool } = require('pg');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const transactions = req.body;
    if (!Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false }
    });

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const query = `
            INSERT INTO transactions (
                date, category_name, payee, comment, outcome_account_name, outcome, 
                outcome_currency, income_account_name, income, income_currency, 
                created_date, changed_date, raw_line
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (created_date) DO NOTHING;
        `;

        for (const t of transactions) {
            await client.query(query, [
                t.date, t.categoryName, t.payee, t.comment,
                t.outcomeAccountName, t.outcome, t.outcomeCurrencyShortTitle || 'UAH',
                t.incomeAccountName, t.income, t.incomeCurrencyShortTitle || 'UAH',
                t.createdDate, t.changedDate || t.createdDate, t.rawLine
            ]);
        }

        await client.query('COMMIT');
        res.status(200).json({ message: 'Success', count: transactions.length });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Insert error:', error);
        res.status(500).json({ error: 'Failed to save', details: error.message });
    } finally {
        client.release();
        await pool.end();
    }
};
