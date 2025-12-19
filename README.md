# Анализатор долгов - Ганна

Приложение для отслеживания долговых операций на основе CSV-экспорта из ZenMoney.

## Технологии

- **Frontend**: HTML, CSS, JavaScript
- **Charts**: Chart.js с адаптером для работы с датами
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: PostgreSQL (Neon/Vercel Postgres)

## Структура проекта

```
hannadolg/
├── api/                          # Vercel Serverless Functions
│   ├── add-transactions.js       # Добавление транзакций в БД
│   ├── get-transactions.js       # Получение транзакций из БД
│   └── package.json              # Зависимости для API
├── index.html                    # Главная страница
├── script.js                     # Клиентская логика
├── style.css                     # Стили
├── package.json                  # Корневые зависимости
└── vercel.json                   # Конфигурация Vercel
```

## Установка

1. **Клонируйте проект**:
   ```bash
   git clone <repository-url>
   cd hannadolg
   ```

2. **Установите зависимости**:
   ```bash
   npm install
   cd api
   npm install
   cd ..
   ```

3. **Настройте базу данных**:
   
   Создайте PostgreSQL базу данных (например, на [Neon](https://neon.tech) или [Vercel Postgres](https://vercel.com/storage/postgres)) и выполните SQL-скрипт для создания таблицы:

   ```sql
   CREATE TABLE transactions (
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
   ```

4. **Настройте переменные окружения**:
   
   В настройках проекта на Vercel добавьте:
   - `DATABASE_URL` - строка подключения к PostgreSQL
   
   Пример: `postgres://username:password@host:5432/database?sslmode=require`

## Развертывание на Vercel

1. **Установите Vercel CLI** (если еще не установлен):
   ```bash
   npm install -g vercel
   ```

2. **Войдите в Vercel**:
   ```bash
   vercel login
   ```

3. **Разверните проект**:
   ```bash
   vercel
   ```

4. **Для продакшн развертывания**:
   ```bash
   vercel --prod
   ```

## Локальная разработка

Для локального тестирования используйте Vercel Dev:

```bash
vercel dev
```

Приложение будет доступно по адресу `http://localhost:3000`

## Использование

1. Откройте приложение в браузере
2. Нажмите кнопку **"Выберите файл"** и загрузите CSV-экспорт из ZenMoney
3. Нажмите **"Анализировать"** для обработки данных
4. Просматривайте:
   - Общую статистику по долгам
   - Список транзакций с фильтрацией
   - График изменения долга по неделям
   - Сводку по месяцам
   - Советы по погашению долга

## API Endpoints

### GET `/api/get-transactions`
Получить все транзакции из базы данных

**Response**:
```json
[
  {
    "id": 1,
    "date": "2024-01-15",
    "payee": "Ганна Є.",
    "outcome": 1000.00,
    ...
  }
]
```

### POST `/api/add-transactions`
Добавить новые транзакции в базу данных

**Request Body**:
```json
[
  {
    "date": "2024-01-15",
    "categoryName": "Долги",
    "payee": "Ганна Є.",
    "outcome": 1000.00,
    ...
  }
]
```

**Response**:
```json
{
  "message": "Transactions added successfully"
}
```

## Особенности

- Автоматическое предотвращение дублирования транзакций (по `created_date`)
- Фильтрация транзакций по типу (все, выданные, возвращенные)
- Интерактивные графики с Chart.js
- Адаптивный дизайн
- Serverless архитектура на Vercel

## Требования

- Node.js >= 16.0.0
- PostgreSQL база данных
- Аккаунт Vercel для развертывания

## Лицензия

ISC
