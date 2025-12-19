const STORAGE_KEY = 'hanna-transactions';

export const loadFromLocalStorage = () => {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return [];
    }
};

export const saveToLocalStorage = (transactions) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
};

export const addToLocalStorage = (newTransactions) => {
    const existing = loadFromLocalStorage();
    const existingDates = new Set(existing.map(t => t.created_date));
    
    const toAdd = newTransactions.filter(t => !existingDates.has(t.created_date));
    
    if (toAdd.length > 0) {
        const updated = [...existing, ...toAdd];
        return saveToLocalStorage(updated) ? toAdd.length : 0;
    }
    
    return 0;
};