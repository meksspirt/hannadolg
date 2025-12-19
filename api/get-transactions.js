import { loadTransactions } from './storage.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const transactions = loadTransactions();
        
        // Сортируем по дате создания
        const sorted = transactions.sort((a, b) => 
            new Date(a.createdDate) - new Date(b.createdDate)
        );
        
        res.status(200).json(sorted);
    } catch (error) {
        console.error('Storage Error:', error.message);
        res.status(500).json({ 
            error: 'Ошибка загрузки данных',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
