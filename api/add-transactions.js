const { Pool } = require('pg');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
        return res.status(500).json({ error: "База данных не настроена (DATABASE_URL/POSTGRES_URL)" });
    }

    const pool = new Pool({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    const transactions = req.body;
    if (!Array.isArray(transactions)) {
        return res.status(400).json({ error: "Invalid data format" });
    }

    try {
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
        res.status(200).json({ message: `Successfully processed ${transactions.length} items` });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Transaction error:', error);
        res.status(500).json({
            error: "Ошибка сохранения в БД: " + error.message,
            detail: error.code === '42P01' ? "Таблица 'transactions' не найдена. Вы точно создали её в SQL Editor?" : "Проверьте права доступа и структуру таблицы."
        });
    } finally {
        await pool.end();
    }
};
