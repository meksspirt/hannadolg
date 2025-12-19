import { Pool } from 'pg';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const pool = new Pool({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const transactions = req.body;
        await pool.query('BEGIN');

        const queryText = `
            INSERT INTO transactions (
                date, category_name, payee, comment, 
                outcome_account_name, outcome, 
                income_account_name, income, 
                created_date, raw_line
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (created_date) DO NOTHING
        `;

        for (const t of transactions) {
            await pool.query(queryText, [
                t.date, t.categoryName, t.payee, t.comment,
                t.outcomeAccountName, t.outcome,
                t.incomeAccountName, t.income,
                t.createdDate, t.rawLine
            ]);
        }

        await pool.query('COMMIT');
        res.status(200).json({ success: true });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    } finally {
        await pool.end();
    }
}
