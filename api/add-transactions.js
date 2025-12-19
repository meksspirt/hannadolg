import pg from 'pg';
const { Pool } = pg;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
        console.error('No database connection string found');
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    const pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });

    try {
        const transactions = req.body;
        
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ error: 'Invalid transactions data' });
        }

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
        try {
            await pool.query('ROLLBACK');
        } catch (rollbackError) {
            console.error('Rollback error:', rollbackError.message);
        }
        console.error('DB Error:', error.message, error.stack);
        res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        try {
            await pool.end();
        } catch (endError) {
            console.error('Pool end error:', endError.message);
        }
    }
}
