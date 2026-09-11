import fs from 'fs';
import path from 'path';
import os from 'os';

// Кроссплатформенный путь к временному файлу в OS temp dir
const DATA_FILE = path.join(os.tmpdir(), 'debtsense-transactions.json');

export const loadTransactions = () => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error('Error loading transactions:', error);
        return [];
    }
};

export const saveTransactions = (transactions) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(transactions, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving transactions:', error);
        return false;
    }
};

export const addTransactions = (newTransactions) => {
    const existing = loadTransactions();
    // Поддерживаем как created_date (Supabase/DB), так и createdDate (CSV)
    const existingDates = new Set(existing.map(t => t.created_date || t.createdDate).filter(Boolean));
    
    const toAdd = newTransactions.filter(t => {
        const key = t.created_date || t.createdDate;
        return key && !existingDates.has(key);
    });
    
    if (toAdd.length > 0) {
        const updated = [...existing, ...toAdd];
        return saveTransactions(updated) ? toAdd.length : 0;
    }
    
    return 0;
};