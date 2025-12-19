-- Таблица уже существует, только настраиваем доступ

-- Включение Row Level Security (RLS)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Политика: разрешить всем читать и писать (для простоты)
-- В продакшене лучше настроить аутентификацию
CREATE POLICY "Allow all access to transactions" ON transactions
    FOR ALL USING (true) WITH CHECK (true);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();