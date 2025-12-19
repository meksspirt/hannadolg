import { addTransactions } from './storage.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const transactions = req.body;
        
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({ error: 'Нет данных для загрузки' });
        }

        // Преобразуем данные в нужный формат
        const formatted = transactions.map(t => ({
            date: t.date,
            category_name: t.categoryName,
            payee: t.payee,
            comment: t.comment,
            outcome_account_name: t.outcomeAccountName,
            outcome: t.outcome,
            outcome_currency: 'UAH',
            income_account_name: t.incomeAccountName,
            income: t.income,
            income_currency: 'UAH',
            created_date: t.createdDate,
            changed_date: null,
            raw_line: t.rawLine
        }));

        const addedCount = addTransactions(formatted);
        
        res.status(200).json({ 
            success: true, 
            added: addedCount,
            message: addedCount > 0 ? `Добавлено ${addedCount} новых транзакций` : 'Новых транзакций не найдено'
        });
    } catch (error) {
        console.error('Storage Error:', error.message);
        res.status(500).json({ 
            error: 'Ошибка сохранения данных',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
