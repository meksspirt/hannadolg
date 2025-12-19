import { loadTransactions as loadFromSupabase } from './supabase-storage.js';
import { loadTransactions as loadFromFile } from './storage.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        let transactions = [];
        
        // Пытаемся загрузить из Supabase
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            try {
                transactions = await loadFromSupabase();
                console.log('Loaded from Supabase:', transactions.length);
            } catch (supabaseError) {
                console.warn('Supabase failed, using file storage:', supabaseError.message);
                transactions = loadFromFile();
            }
        } else {
            // Если Supabase не настроен, используем файл
            console.log('Supabase not configured, using file storage');
            transactions = loadFromFile();
        }
        
        // Сортируем по дате создания
        const sorted = transactions.sort((a, b) => 
            new Date(a.created_date || a.createdDate) - new Date(b.created_date || b.createdDate)
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
