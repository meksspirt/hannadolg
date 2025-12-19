import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

const getSupabaseClient = () => {
    if (!supabase && supabaseUrl && supabaseKey) {
        supabase = createClient(supabaseUrl, supabaseKey);
    }
    return supabase;
};

export const loadTransactions = async () => {
    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Supabase not configured');
        }

        const { data, error } = await client
            .from('transactions')
            .select('*')
            .order('created_date', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error loading from Supabase:', error);
        throw error;
    }
};

export const addTransactions = async (newTransactions) => {
    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Supabase not configured');
        }

        // Преобразуем данные в формат для Supabase
        const formatted = newTransactions.map(t => ({
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

        const { data, error } = await client
            .from('transactions')
            .upsert(formatted, { 
                onConflict: 'created_date',
                ignoreDuplicates: true 
            })
            .select();

        if (error) throw error;
        return data ? data.length : 0;
    } catch (error) {
        console.error('Error adding to Supabase:', error);
        throw error;
    }
};