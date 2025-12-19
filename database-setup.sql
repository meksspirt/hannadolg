-- Создание базовой таблицы для транзакций
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    category_name VARCHAR(255),
    payee VARCHAR(255),
    comment TEXT,
    outcome_account_name VARCHAR(255),
    outcome NUMERIC(10, 2),
    outcome_currency VARCHAR(10),
    income_account_name VARCHAR(255),
    income NUMERIC(10, 2),
    income_currency VARCHAR(10),
    created_date TIMESTAMP NOT NULL UNIQUE,
    changed_date TIMESTAMP,
    raw_line TEXT
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_created_date ON transactions(created_date);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_name);

-- Комментарии к таблице и столбцам
COMMENT ON TABLE transactions IS 'Таблица для хранения финансовых транзакций из ZenMoney';
COMMENT ON COLUMN transactions.id IS 'Уникальный идентификатор транзакции';
COMMENT ON COLUMN transactions.date IS 'Дата транзакции';
COMMENT ON COLUMN transactions.category_name IS 'Название категории из ZenMoney';
COMMENT ON COLUMN transactions.payee IS 'Получатель/Плательщик';
COMMENT ON COLUMN transactions.comment IS 'Комментарий к транзакции';
COMMENT ON COLUMN transactions.outcome_account_name IS 'Название счета списания';
COMMENT ON COLUMN transactions.outcome IS 'Сумма списания';
COMMENT ON COLUMN transactions.outcome_currency IS 'Валюта списания';
COMMENT ON COLUMN transactions.income_account_name IS 'Название счета зачисления';
COMMENT ON COLUMN transactions.income IS 'Сумма зачисления';
COMMENT ON COLUMN transactions.income_currency IS 'Валюта зачисления';
COMMENT ON COLUMN transactions.created_date IS 'Дата создания записи в ZenMoney (используется как уникальный ключ)';
COMMENT ON COLUMN transactions.changed_date IS 'Дата последнего изменения записи в ZenMoney';
COMMENT ON COLUMN transactions.raw_line IS 'Исходная строка из CSV для отладки';
