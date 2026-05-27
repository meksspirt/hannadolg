import { addTransactions as addToSupabase } from './supabase-storage.js';
import { addTransactions as addToFile } from './storage.js';

const ZENMONEY_DIFF_URL = 'https://api.zenmoney.ru/v8/diff/';

const toAmount = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return Number(value) || 0;
    if (Array.isArray(value)) return Number(value[0]) || 0;
    if (value && typeof value === 'object') {
        return Number(
            value.amount ??
            value.sum ??
            value.value ??
            value.money ??
            0
        ) || 0;
    }
    return 0;
};

const unixToIsoDate = (value) => {
    if (!value || Number.isNaN(Number(value))) return '';
    const numeric = Number(value);
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    return new Date(ms).toISOString().slice(0, 10);
};

const unixToIsoDateTime = (value) => {
    if (!value || Number.isNaN(Number(value))) return new Date().toISOString();
    const numeric = Number(value);
    const ms = numeric > 1e12 ? numeric : numeric * 1000;
    return new Date(ms).toISOString();
};

const getAccountName = (accountsMap, accountId) => {
    if (!accountId) return 'Долги';
    return accountsMap.get(accountId) || 'Долги';
};

const mapZenTransaction = (transaction, accountsMap) => {
    const income = toAmount(transaction.income);
    const outcome = toAmount(transaction.outcome);

    const incomeAccountId =
        transaction.incomeAccount ??
        transaction.income_account ??
        transaction.incomeAccountId ??
        null;
    const outcomeAccountId =
        transaction.outcomeAccount ??
        transaction.outcome_account ??
        transaction.outcomeAccountId ??
        null;

    return {
        date: unixToIsoDate(transaction.date || transaction.changed),
        categoryName: transaction.categoryName || transaction.category || transaction.tag || '',
        payee: transaction.payee || transaction.merchant || transaction.title || '',
        comment: transaction.comment || transaction.title || 'ZenMoney import',
        outcomeAccountName: getAccountName(accountsMap, outcomeAccountId),
        outcome,
        incomeAccountName: getAccountName(accountsMap, incomeAccountId),
        income,
        createdDate: unixToIsoDateTime(transaction.changed || transaction.date),
        rawLine: JSON.stringify({
            id: transaction.id,
            changed: transaction.changed,
            date: transaction.date
        })
    };
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = process.env.ZENMONEY_ACCESS_TOKEN;
    if (!token) {
        return res.status(400).json({
            error: 'ZENMONEY_ACCESS_TOKEN is not configured'
        });
    }

    try {
        const body = {
            currentClientTimestamp: Math.floor(Date.now() / 1000),
            serverTimestamp: 0
        };

        const response = await fetch(ZENMONEY_DIFF_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const details = await response.text();
            return res.status(502).json({
                error: 'ZenMoney API error',
                details
            });
        }

        const diff = await response.json();
        const accounts = Array.isArray(diff.account) ? diff.account : [];
        const transactions = Array.isArray(diff.transaction) ? diff.transaction : [];

        const accountsMap = new Map(accounts.map((a) => [a.id, a.title || a.name || 'Долги']));

        const normalized = transactions
            .filter((t) => !t.deleted)
            .map((t) => mapZenTransaction(t, accountsMap))
            .filter((t) => t.date);

        if (normalized.length === 0) {
            return res.status(200).json({
                success: true,
                added: 0,
                source: 'zenmoney',
                fetchedRaw: transactions.length,
                message: 'Данные ZenMoney получены, но не удалось нормализовать транзакции'
            });
        }

        let added = 0;
        let storage = 'file';

        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            try {
                added = await addToSupabase(normalized);
                storage = 'supabase';
            } catch (supabaseError) {
                console.warn('Supabase failed, fallback to file:', supabaseError.message);
                added = addToFile(normalized.map((t) => ({
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
                })));
                storage = 'file';
            }
        } else {
            added = addToFile(normalized.map((t) => ({
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
            })));
        }

        return res.status(200).json({
            success: true,
            source: 'zenmoney',
            added,
            storage,
            fetched: normalized.length,
            message: `Синхронизировано из ZenMoney: ${added} записей`
        });
    } catch (error) {
        console.error('ZenMoney sync error:', error);
        return res.status(500).json({
            error: 'Ошибка синхронизации ZenMoney',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
