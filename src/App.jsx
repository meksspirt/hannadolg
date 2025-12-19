import React, { useState, useEffect, useMemo } from 'react';
import {
    Upload,
    Search,
    Sun,
    Moon,
    ArrowUpRight,
    ArrowDownLeft,
    Wifi,
    WifiOff
} from 'lucide-react';
import { loadFromLocalStorage, saveToLocalStorage, addToLocalStorage } from './localStorage-storage.js';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import DebtChart from './DebtChart';
import { WeekdayChart, LoanSizeChart, MonthlyHeatmap } from './AdvancedAnalytics';
import { format } from 'date-fns';

const App = () => {
    const formatAmount = (num) => {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num).replace(',', '.');
    };

    const [chartMode, setChartMode] = useState('debt'); // 'debt' or 'flow'
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [isOnline, setIsOnline] = useState(true);
    const itemsPerPage = 10;

    useEffect(() => {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Пытаемся загрузить с сервера
            const res = await fetch('/api/get-transactions');
            if (res.ok) {
                const result = await res.json();
                const processedData = processTransactions(result, true);
                setData(processedData);
                setIsOnline(true);

                // Сохраняем в localStorage как backup
                saveToLocalStorage(result);
            } else {
                throw new Error('Server error');
            }
        } catch (e) {
            console.warn('Не удалось загрузить с сервера, используем локальные данные:', e);

            // Загружаем из localStorage
            const localData = loadFromLocalStorage();
            if (localData.length > 0) {
                setData(processTransactions(localData, true));
                setIsOnline(false);
            } else {
                setData([]);
                setIsOnline(false);
            }
        } finally {
            setLoading(false);
        }
    };

    const processTransactions = (raw, isDbData) => {
        let currentDebt = 0;

        return raw.map(t => {
            const income = parseFloat(t.income) || 0;
            const outcome = parseFloat(t.outcome) || 0;

            // Правильная логика: определяем тип по счетам
            // Если деньги идут В "Долги" - это "Дано в долг"
            // Если деньги идут ИЗ "Долги" - это "Возврат"
            let amount, type;

            const incomeAccount = (t.income_account_name || '').toLowerCase();
            const outcomeAccount = (t.outcome_account_name || '').toLowerCase();

            if (incomeAccount.includes('долги') || incomeAccount.includes('долг')) {
                // Деньги пришли на счет "Долги" = дали в долг
                amount = income;
                type = 'Дано в долг';
                currentDebt += income;
            } else if (outcomeAccount.includes('долги') || outcomeAccount.includes('долг')) {
                // Деньги ушли со счета "Долги" = вернули долг
                amount = outcome;
                type = 'Возврат';
                currentDebt -= outcome;
            } else {
                // Fallback: используем старую логику
                if (outcome > 0) {
                    amount = outcome;
                    type = 'Дано в долг';
                    currentDebt += outcome;
                } else {
                    amount = income;
                    type = 'Возврат';
                    currentDebt -= income;
                }
            }

            const dateStr = t.date;
            const sortDate = new Date(dateStr.split('.').reverse().join('-'));

            return {
                ...t,
                amount,
                type,
                currentDebt,
                sortDate,
                formattedDate: dateStr
            };
        }).sort((a, b) => b.sortDate - a.sortDate);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split(/\r?\n/).slice(1);
            const parsed = lines.map(line => {
                if (!line.trim()) return null;
                const delimiter = line.includes(';') ? ';' : ',';
                const clean = line.split(delimiter).map(col => col.replace(/"/g, '').trim());
                if (clean.length < 12) return null;
                if (!clean[2].includes("Ганна Є.") || (!clean[4].includes("Долги") && !clean[7].includes("Долги"))) return null;
                return {
                    date: clean[0],
                    categoryName: clean[1],
                    payee: clean[2],
                    comment: clean[3],
                    outcomeAccountName: clean[4],
                    outcome: parseFloat(clean[5]) || 0,
                    incomeAccountName: clean[7],
                    income: parseFloat(clean[8]) || 0,
                    createdDate: clean[10],
                    rawLine: line
                };
            }).filter(Boolean);

            if (parsed.length === 0) {
                alert('Транзакций не обнаружено.');
                return;
            }

            setUploading(true);
            try {
                // Пытаемся загрузить на сервер
                const res = await fetch('/api/add-transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed)
                });

                if (res.ok) {
                    const result = await res.json();
                    alert(result.message || 'Данные синхронизированы с сервером!');
                    setIsOnline(true);
                    fetchData();
                } else {
                    throw new Error('Server error');
                }
            } catch (e) {
                console.warn('Не удалось загрузить на сервер, сохраняем локально:', e);

                // Сохраняем локально
                const formatted = parsed.map(t => ({
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

                const addedCount = addToLocalStorage(formatted);
                alert(`Сохранено локально: ${addedCount} новых транзакций`);
                setIsOnline(false);
                fetchData();
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const stats = useMemo(() => {
        if (data.length === 0) return {
            currentDebt: 0, totalGiven: 0, totalReceived: 0, returnRate: 0,
            avgLoanAmount: 0, loansPerMonth: 0, avgMonthlyGiven: 0, topCategories: [], monthlyStats: [],
            debtTrend: 'stable', projectedPayoff: null, isOverLimit: false,
            weekdayStats: [], loanSizeStats: [], daysOfMonthData: [], cumulativeData: [], forecastData: []
        };

        const loans = data.filter(t => t.type === 'Дано в долг');
        const returns = data.filter(t => t.type === 'Возврат');
        const totalGiven = loans.reduce((sum, t) => sum + t.amount, 0);
        const totalReceived = returns.reduce((sum, t) => sum + t.amount, 0);
        const currentDebt = totalGiven - totalReceived;

        // Средний размер долга
        const avgLoanAmount = loans.length > 0 ? totalGiven / loans.length : 0;

        // Частота займов (займов в месяц)
        const firstLoan = loans[loans.length - 1];
        const lastLoan = loans[0];
        const monthsDiff = firstLoan && lastLoan ?
            Math.max(1, Math.ceil((lastLoan.sortDate - firstLoan.sortDate) / (1000 * 60 * 60 * 24 * 30))) : 1;
        const loansPerMonth = loans.length / monthsDiff;
        const avgMonthlyGiven = totalGiven / monthsDiff;

        // Топ категорий (по комментариям)
        const categoryMap = {};
        const weekdayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const loanSizeBuckets = { small: 0, medium: 0, large: 0 };
        const daysOfMonthMap = Array(31).fill(0).reduce((acc, _, i) => ({ ...acc, [i + 1]: 0 }), {});

        loans.forEach(t => {
            const comment = t.comment.toLowerCase();
            let category = 'Прочее';
            if (comment.includes('еда') || comment.includes('пиво') || comment.includes('пузат')) category = 'Еда и напитки';
            else if (comment.includes('сигарет')) category = 'Вредные привычки';
            else if (comment.includes('книг') || comment.includes('ленточ')) category = 'Канцелярия';
            else if (comment.includes('поповн') || comment.includes('пополн')) category = 'Пополнение счета';
            categoryMap[category] = (categoryMap[category] || 0) + t.amount;

            // Дни недели
            const day = t.sortDate.getDay();
            weekdayMap[day] += t.amount;

            // Размеры займов
            if (t.amount < 500) loanSizeBuckets.small += t.amount;
            else if (t.amount <= 2000) loanSizeBuckets.medium += t.amount;
            else loanSizeBuckets.large += t.amount;

            // Дни месяца (для тепловой карты)
            const date = t.sortDate.getDate();
            daysOfMonthMap[date]++;
        });

        const topCategories = Object.entries(categoryMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, amount]) => ({ name, amount, percentage: ((amount / totalGiven) * 100).toFixed(1) }));

        // Кумулятивные данные
        const sortedAll = [...data].sort((a, b) => a.sortDate - b.sortDate);
        let cumGiven = 0;
        let cumReceived = 0;
        const cumulativeData = sortedAll.map(t => {
            if (t.type === 'Дано в долг') cumGiven += t.amount;
            else cumReceived += t.amount;
            return {
                date: t.sortDate,
                given: cumGiven,
                received: cumReceived,
                debt: cumGiven - cumReceived
            };
        });

        // Прогноз (упрощенный линейный на основе последних 60 дней)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const recentTrans = cumulativeData.filter(d => d.date >= sixtyDaysAgo);
        let forecastData = [];
        if (recentTrans.length >= 2) {
            const start = recentTrans[0];
            const end = recentTrans[recentTrans.length - 1];
            const daysDiff = (end.date - start.date) / (1000 * 60 * 60 * 24);
            const debtDiff = end.debt - start.debt;
            const debtPerDay = debtDiff / (daysDiff || 1);

            for (let i = 1; i <= 6; i++) {
                const fDate = new Date(end.date);
                fDate.setMonth(fDate.getMonth() + i);
                forecastData.push({
                    date: fDate,
                    debt: Math.max(0, end.debt + (debtPerDay * 30 * i)),
                    isForecast: true
                });
            }
        }

        // Месячная статистика
        const monthlyMap = {};
        data.forEach(t => {
            const monthKey = t.sortDate.toISOString().slice(0, 7); // YYYY-MM
            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = { given: 0, received: 0, loans: 0, returns: 0 };
            }
            if (t.type === 'Дано в долг') {
                monthlyMap[monthKey].given += t.amount;
                monthlyMap[monthKey].loans++;
            } else {
                monthlyMap[monthKey].received += t.amount;
                monthlyMap[monthKey].returns++;
            }
        });

        const monthlyStats = Object.entries(monthlyMap)
            .sort(([a], [b]) => b.localeCompare(a))
            .slice(0, 6)
            .map(([month, stats]) => ({
                month,
                ...stats,
                net: stats.given - stats.received
            }));

        // Тренд долга (последние 3 месяца)
        const recentMonths = monthlyStats.slice(0, 3);
        let debtTrend = 'stable';
        if (recentMonths.length >= 2) {
            const trend = recentMonths[0].net - recentMonths[1].net;
            debtTrend = trend > 500 ? 'growing' : trend < -500 ? 'decreasing' : 'stable';
        }

        // Прогноз погашения (на основе среднего возврата в месяц)
        const avgReturnPerMonth = returns.length > 0 ? totalReceived / monthsDiff : 0;
        const projectedPayoff = avgReturnPerMonth > 0 ?
            Math.ceil(currentDebt / avgReturnPerMonth) : null;

        // Предупреждение о лимите (больше 100,000)
        const isOverLimit = currentDebt > 100000;

        return {
            currentDebt,
            totalGiven,
            totalReceived,
            returnRate: totalGiven > 0 ? ((totalReceived / totalGiven) * 100).toFixed(1) : 0,
            avgLoanAmount,
            loansPerMonth: loansPerMonth.toFixed(1),
            avgMonthlyGiven,
            topCategories,
            monthlyStats,
            debtTrend,
            projectedPayoff,
            isOverLimit,
            weekdayStats: Object.entries(weekdayMap).map(([day, amount]) => ({ day: parseInt(day), amount })),
            loanSizeStats: Object.entries(loanSizeBuckets).map(([size, amount]) => ({ size, amount })),
            daysOfMonthData: Object.entries(daysOfMonthMap).map(([day, count]) => ({ day: parseInt(day), count })),
            cumulativeData,
            forecastData
        };
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(t => {
            const matchesSearch = t.comment.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' || (filter === 'given' && t.type === 'Дано в долг') || (filter === 'received' && t.type === 'Возврат');
            return matchesSearch && matchesFilter;
        });
    }, [data, searchQuery, filter]);

    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const exportData = (format) => {
        const timestamp = new Date().toISOString().slice(0, 10);

        if (format === 'csv') {
            const headers = ['Дата', 'Комментарий', 'Тип', 'Сумма', 'Остаток долга'];
            const csvContent = [
                headers.join(','),
                ...data.map(t => [
                    t.formattedDate,
                    `"${t.comment}"`,
                    t.type,
                    t.amount,
                    t.currentDebt
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `долги_ганны_${timestamp}.csv`;
            link.click();
        }

        else if (format === 'json') {
            const jsonData = {
                exportDate: new Date().toISOString(),
                statistics: stats,
                transactions: data
            };

            const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `долги_ганны_${timestamp}.json`;
            link.click();
        }

        else if (format === 'report') {
            const reportHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Отчет по долгам Ганны Є.</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
                        .stat-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
                        .stat-label { font-size: 12px; color: #666; }
                        .stat-value { font-size: 18px; font-weight: bold; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>Отчет по долгам Ганны Є.</h1>
                        <p>Сгенерировано: ${new Date().toLocaleDateString('ru')}</p>
                    </div>
                    
                    <div class="stats">
                        <div class="stat-card">
                            <div class="stat-label">Текущий долг</div>
                            <div class="stat-value">${formatAmount(stats.currentDebt)} ₴</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Дано всего</div>
                            <div class="stat-value">${formatAmount(stats.totalGiven)} ₴</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Вернула всего</div>
                            <div class="stat-value">${formatAmount(stats.totalReceived)} ₴</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Процент возврата</div>
                            <div class="stat-value">${stats.returnRate}%</div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr><th>Дата</th><th>Комментарий</th><th>Тип</th><th>Сумма</th><th>Остаток</th></tr>
                        </thead>
                        <tbody>
                            ${data.map(t => `
                                <tr>
                                    <td>${t.formattedDate}</td>
                                    <td>${t.comment}</td>
                                    <td>${t.type}</td>
                                    <td>${formatAmount(t.amount)} ₴</td>
                                    <td>${formatAmount(t.currentDebt)} ₴</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `;

            const blob = new Blob([reportHtml], { type: 'text/html' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `отчет_долги_ганны_${timestamp}.html`;
            link.click();
        }
    };

    const formattedChartData = useMemo(() => {
        if (data.length === 0) return [];

        const dailyData = {};
        [...data].forEach(d => {
            const dateKey = d.formattedDate;
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: d.sortDate,
                    debt: d.currentDebt
                };
            }
        });

        return Object.values(dailyData).sort((a, b) => a.date - b.date);
    }, [data]);

    return (
        <div className="container">
            <header className="main-header">
                <div>
                    <h1>Анализатор долгов</h1>
                    <p className="subtitle">
                        Учет транзакций Ганны Є.
                        <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            {isOnline ? 'Онлайн' : 'Локально'}
                        </span>
                    </p>
                </div>
                <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </header>

            <div className="stats-grid">
                <div className={`card stat-card ${stats.isOverLimit ? 'danger blink' : 'danger'}`}>
                    <span className="label">
                        Текущий долг
                        {stats.isOverLimit && <span className="warning-icon">⚠️</span>}
                    </span>
                    <span className="value">
                        {formatAmount(stats.currentDebt)} <span className="value-symbol">₴</span>
                    </span>
                </div>
                <div className="card stat-card warning">
                    <span className="label">Дано всего</span>
                    <span className="value">{formatAmount(stats.totalGiven)} <span className="value-symbol">₴</span></span>
                </div>
                <div className="card stat-card success">
                    <span className="label">Вернула всего</span>
                    <span className="value">{formatAmount(stats.totalReceived)} <span className="value-symbol">₴</span></span>
                </div>
                <div className="card stat-card">
                    <span className="label">Процент возврата</span>
                    <span className="value">{stats.returnRate}<span className="value-symbol">%</span></span>
                </div>
                <div className="card stat-card info">
                    <span className="label">Средний займ</span>
                    <span className="value">{formatAmount(stats.avgLoanAmount)} <span className="value-symbol">₴</span></span>
                </div>
                <div className="card stat-card info">
                    <span className="label">Займов в месяц</span>
                    <span className="value">{stats.loansPerMonth}</span>
                </div>
                <div className="card stat-card info">
                    <span className="label">В среднем в месяц</span>
                    <span className="value">{formatAmount(stats.avgMonthlyGiven)} <span className="value-symbol">₴</span></span>
                </div>
                <div className={`card stat-card ${stats.debtTrend === 'growing' ? 'danger' : stats.debtTrend === 'decreasing' ? 'success' : 'info'}`}>
                    <span className="label">Тренд</span>
                    <span className="value">
                        {stats.debtTrend === 'growing' ? (
                            <><span className="value-symbol">📈</span> Растет</>
                        ) : stats.debtTrend === 'decreasing' ? (
                            <><span className="value-symbol">📉</span> Снижается</>
                        ) : (
                            <><span className="value-symbol">➡️</span> Стабильно</>
                        )}
                    </span>
                </div>
                {stats.projectedPayoff && (
                    <div className="card stat-card info">
                        <span className="label">Прогноз погашения</span>
                        <span className="value">
                            {stats.projectedPayoff} <span className="value-unit">мес.</span>
                        </span>
                    </div>
                )}
            </div>

            <div className="card upload-card">
                <input
                    type="file"
                    id="file"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".csv"
                />
                <div className="upload-actions">
                    <label htmlFor="file" className="upload-btn">
                        <Upload size={20} />
                        {uploading ? 'Загрузка...' : 'Выбрать CSV таблицу'}
                    </label>
                    {!isOnline && (
                        <button className="retry-btn" onClick={fetchData} disabled={loading}>
                            <Wifi size={16} />
                            {loading ? 'Подключение...' : 'Попробовать снова'}
                        </button>
                    )}
                </div>
            </div>

            <div className="card chart-card">
                <div className="card-header-actions">
                    <h3>{chartMode === 'debt' ? 'Динамика долга и прогноз' : 'Накопительные потоки (Flow)'}</h3>
                    <div className="header-tabs">
                        <button className={chartMode === 'debt' ? 'active' : ''} onClick={() => setChartMode('debt')}>Тренд</button>
                        <button className={chartMode === 'flow' ? 'active' : ''} onClick={() => setChartMode('flow')}>Поток</button>
                    </div>
                </div>
                <div className="chart-box">
                    {formattedChartData.length > 0 && (
                        <ParentSize>
                            {({ width, height }) => (
                                <DebtChart
                                    data={chartMode === 'debt' ? formattedChartData : stats.cumulativeData}
                                    forecastData={chartMode === 'debt' ? stats.forecastData : []}
                                    mode={chartMode}
                                    width={width}
                                    height={height}
                                    theme={theme}
                                />
                            )}
                        </ParentSize>
                    )}
                </div>
                {chartMode === 'debt' && <p className="chart-hint">Пунктирная линия — прогноз на основе последних 60 дней</p>}
            </div>

            <div className="advanced-grid">
                <div className="card analytics-card">
                    <h3>Активность по дням недели</h3>
                    <div className="chart-box-mini">
                        <WeekdayChart data={stats.weekdayStats} theme={theme} />
                    </div>
                </div>
                <div className="card analytics-card">
                    <h3>Распределение по размерам</h3>
                    <div className="chart-box-mini">
                        <LoanSizeChart data={stats.loanSizeStats} theme={theme} />
                    </div>
                </div>
                <div className="card analytics-card">
                    <h3>Частота по дням месяца</h3>
                    <div className="chart-box-mini">
                        <MonthlyHeatmap data={stats.daysOfMonthData} theme={theme} />
                    </div>
                    <p className="chart-hint">Яркость — количество транзакций в этот день месяца</p>
                </div>
            </div>

            {/* Топ категорий */}
            <div className="card analytics-card">
                <h3>Топ категорий трат</h3>
                <div className="categories-list">
                    {stats.topCategories.map((cat, i) => (
                        <div key={i} className="category-item">
                            <div className="category-info">
                                <span className="category-name">{cat.name}</span>
                                <span className="category-amount">{formatAmount(cat.amount)} ₴</span>
                            </div>
                            <div className="category-bar">
                                <div
                                    className="category-fill"
                                    style={{ width: `${cat.percentage}%` }}
                                ></div>
                            </div>
                            <span className="category-percent">{cat.percentage}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Месячная статистика */}
            <div className="card analytics-card">
                <h3>Статистика по месяцам</h3>
                <div className="monthly-stats">
                    {stats.monthlyStats.map((month, i) => (
                        <div key={i} className="month-item">
                            <div className="month-header">
                                <span className="month-name">
                                    {new Date(month.month + '-01').toLocaleDateString('ru', {
                                        year: 'numeric',
                                        month: 'long'
                                    })}
                                </span>
                                <span className={`month-net ${month.net > 0 ? 'negative' : 'positive'}`}>
                                    {month.net > 0 ? '+' : ''}{formatAmount(month.net)} ₴
                                </span>
                            </div>
                            <div className="month-details">
                                <div className="month-stat">
                                    <span>Дано: {formatAmount(month.given)} ₴ ({month.loans} раз)</span>
                                </div>
                                <div className="month-stat">
                                    <span>Вернула: {formatAmount(month.received)} ₴ ({month.returns} раз)</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Экспорт данных */}
            <div className="card export-card">
                <h3>Экспорт данных</h3>
                <div className="export-buttons">
                    <button className="export-btn csv" onClick={() => exportData('csv')}>
                        📊 Скачать CSV
                    </button>
                    <button className="export-btn json" onClick={() => exportData('json')}>
                        📄 Скачать JSON
                    </button>
                    <button className="export-btn report" onClick={() => exportData('report')}>
                        📈 Отчет (HTML)
                    </button>
                </div>
            </div>

            <div className="card list-card">
                <div className="list-header">
                    <div className="search-wrap">
                        <Search size={18} className="search-icon" />
                        <input
                            placeholder="Поиск по комментариям..."
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="filter-tabs">
                        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Все</button>
                        <button className={filter === 'given' ? 'active' : ''} onClick={() => setFilter('given')}>Выдано</button>
                        <button className={filter === 'received' ? 'active' : ''} onClick={() => setFilter('received')}>Возвраты</button>
                    </div>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Комментарий</th>
                                <th>Тип</th>
                                <th>Сумма</th>
                                <th>Остаток</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((t, i) => (
                                <tr key={i}>
                                    <td>{t.formattedDate}</td>
                                    <td>{t.comment}</td>
                                    <td>
                                        <span className={`type-badge ${t.type === 'Возврат' ? 'in' : 'out'}`}>
                                            {t.type === 'Возврат' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                            {t.type}
                                        </span>
                                    </td>
                                    <td>{formatAmount(t.amount)}</td>
                                    <td className="debt-cell">{formatAmount(t.currentDebt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="pagination">
                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Назад</button>
                    <span>{currentPage}</span>
                    <button disabled={currentPage * itemsPerPage >= filteredData.length} onClick={() => setCurrentPage(p => p + 1)}>Вперед</button>
                </div>
            </div>
        </div>
    );
};

export default App;
