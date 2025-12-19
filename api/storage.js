import fs from 'fs';
import path from 'path';

const DATA_FILE = '/tmp/transactions.json';

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
    const existingDates = new Set(existing.map(t => t.createdDate));
    
    const toAdd = newTransactions.filter(t => !existingDates.has(t.createdDate));
    
    if (toAdd.length > 0) {
        const updated = [...existing, ...toAdd];
        return saveTransactions(updated) ? toAdd.length : 0;
    }
    
    return 0;
};