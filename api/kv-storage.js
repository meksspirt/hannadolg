// Для использования Vercel KV:
// 1. Установите: npm install @vercel/kv
// 2. Создайте KV базу в Vercel Dashboard
// 3. Раскомментируйте код ниже

/*
import { kv } from '@vercel/kv';

const TRANSACTIONS_KEY = 'transactions';

export const loadTransactions = async () => {
    try {
        const data = await kv.get(TRANSACTIONS_KEY);
        return data || [];
    } catch (error) {
        console.error('Error loading from KV:', error);
        return [];
    }
};

export const saveTransactions = async (transactions) => {
    try {
        await kv.set(TRANSACTIONS_KEY, transactions);
        return true;
    } catch (error) {
        console.error('Error saving to KV:', error);
        return false;
    }
};

export const addTransactions = async (newTransactions) => {
    const existing = await loadTransactions();
    const existingDates = new Set(existing.map(t => t.created_date));
    
    const toAdd = newTransactions.filter(t => !existingDates.has(t.created_date));
    
    if (toAdd.length > 0) {
        const updated = [...existing, ...toAdd];
        return await saveTransactions(updated) ? toAdd.length : 0;
    }
    
    return 0;
};
*/

export default null;