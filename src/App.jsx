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
import FinancialAdvice from './FinancialAdvice';
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
    const [safetyLimit, setSafetyLimit] = useState(localStorage.getItem('safetyLimit') || 50000);
    const [payoffTargetDate, setPayoffTargetDate] = useState(() => localStorage.getItem('payoffTargetDate') || '');
    const [extraPayment, setExtraPayment] = useState(0);
    const [monthlyIncome, setMonthlyIncome] = useState(() => Number(localStorage.getItem('monthlyIncome')) || 30000);
    const [inflationRate, setInflationRate] = useState(() => Number(localStorage.getItem('inflationRate')) || 15);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [syncingZen, setSyncingZen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [exchangeRates, setExchangeRates] = useState({ usd: 41.5, eur: 44.8 });
    const [isOnline, setIsOnline] = useState(true);
    const itemsPerPage = 10;

    useEffect(() => {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        // Очищаем старые локальные данные транзакций, чтобы использовать только серверные
        localStorage.removeItem('debt-sense-transactions');
        fetchData();
        fetchRates();
    }, []);

    useEffect(() => {
        const maybeAutoSync = async () => {
            const lastSyncAt = Number(localStorage.getItem('zenmoneyLastSyncAt') || 0);
            const twelveHoursMs = 12 * 60 * 60 * 1000;
            if (Date.now() - lastSyncAt < twelveHoursMs) return;
            await handleZenMoneySync(false);
        };

        maybeAutoSync();
    }, []);

    const fetchRates = async () => {
        try {
            const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
            if (res.ok) {
                const data = await res.json();
                const usd = data.find(c => c.cc === 'USD')?.rate || 41.5;
                const eur = data.find(c => c.cc === 'EUR')?.rate || 44.8;
                setExchangeRates({ usd, eur });
            }
        } catch (e) {
            console.error('Rates fetch error:', e);
        }
    };

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
            } else {
                throw new Error('Server error');
            }
        } catch (e) {
            console.error('Ошибка загрузки данных:', e);
            setData([]);
            setIsOnline(false);
        } finally {
            setLoading(false);
        }
    };

    const processTransactions = (raw, isDbData) => {
        const isHannaCounterparty = (transaction) => {
            const haystack = [
                transaction.payee,
                transaction.comment,
                transaction.category_name,
                transaction.categoryName
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes('ганна є');
        };

        const dateStr = (t) => t.date ?? '';
        const toSortDate = (t) => {
            const s = dateStr(t);
            if (!s) return new Date(0);
            return new Date(s.includes('.') ? s.split('.').reverse().join('-') : s);
        };

        const rows = raw.filter(isHannaCounterparty).map(t => {
            const income = parseFloat(t.income ?? t.income_amount) || 0;
            const outcome = parseFloat(t.outcome ?? t.outcome_amount) || 0;

            // Правильная логика: определяем тип по счетам
            // Если деньги идут В "Долги" - это "Дано в долг"
            // Если деньги идут ИЗ "Долги" - это "Возврат"
            let amount, type;

            const incomeAccount = (t.income_account_name || '').toLowerCase();
            const outcomeAccount = (t.outcome_account_name || '').toLowerCase();

            const isDebtIncome = incomeAccount.includes('долги') || incomeAccount.includes('долг');
            const isDebtOutcome = outcomeAccount.includes('долги') || outcomeAccount.includes('долг');

            if (isDebtIncome) {
                amount = income;
                type = 'Дано в долг';
            } else if (isDebtOutcome) {
                amount = outcome;
                type = 'Возврат';
            } else {
                // Не учитываем транзакции, не связанные со счетом "Долги"
                return null;
            }

            const d = dateStr(t);
            const sortDate = toSortDate(t);

            return {
                ...t,
                amount,
                type,
                sortDate,
                formattedDate: d
            };
        }).filter(Boolean);

        rows.sort((a, b) => {
            const diff = a.sortDate - b.sortDate;
            if (diff !== 0) return diff;
            const ca = new Date(a.created_date || a.createdDate || 0).getTime();
            const cb = new Date(b.created_date || b.createdDate || 0).getTime();
            return ca - cb;
        });

        let currentDebt = 0;
        return rows
            .map(t => {
                if (t.type === 'Дано в долг') {
                    currentDebt += t.amount;
                } else {
                    currentDebt -= t.amount;
                }
                return { ...t, currentDebt };
            })
            .sort((a, b) => b.sortDate - a.sortDate);
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
                if (!clean[2].includes("Ганна Є") || (!clean[4].includes("Долги") && !clean[7].includes("Долги"))) return null;
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

                const addedCount = formatted.length;
                alert(`Успешно загружено: ${addedCount} транзакций`);
                setIsOnline(true);
                fetchData();
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleZenMoneySync = async (showSuccessAlert = true) => {
        setSyncingZen(true);
        try {
            const res = await fetch('/api/sync-zenmoney', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || 'ZenMoney sync failed');
            }

            localStorage.setItem('zenmoneyLastSyncAt', String(Date.now()));
            if (showSuccessAlert) {
                alert(result.message || 'Синхронизация ZenMoney завершена');
            }
            setIsOnline(true);
            await fetchData();
        } catch (error) {
            console.error('ZenMoney sync error:', error);
            if (showSuccessAlert) {
                alert(`Ошибка синхронизации ZenMoney: ${error.message}`);
            }
        } finally {
            setSyncingZen(false);
        }
    };

    const stats = useMemo(() => {
        if (data.length === 0) return {
            currentDebt: 0, totalGiven: 0, totalReceived: 0, returnRate: 0,
            avgLoanAmount: 0, loansPerMonth: 0, currentMonthGiven: 0, avgMonthlyGiven: 0, topCategories: [], monthlyStats: [],
            debtTrend: 'stable', projectedPayoff: null, isOverLimit: false,
            weekdayStats: [], loanSizeStats: [], daysOfMonthData: [], cumulativeData: [], forecastData: [],
            simulatorData: [], benchmarks: { monthlyChange: 0, intervalChange: 0 },
            badHabits: { total: 0, potentialSavings: 0 }, achievements: [], plannedPayments: [],
            inflationProfit: 0, stressScore: 0, joyBudget: 0, anomalies: [],
            milestones: [], strategies: { snowball: [], avalanche: [] },
            intervals: { avg: 0, trend: 'stable' }, burndown: [], safetyLimit,
            debtAgeDays: 0, liberty: { percentage: 0, value: 0 },
            opportunityCost: 0, reliabilityRanking: [], staleLoans: [],
            realValue: { nominal: 0, real: 0, gain: 0, percent: 0 },
            currency: { usd: 0, eur: 0, rates: { usd: 41.5, eur: 44.8 }, hedgeGain: 0 }
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
        const now = new Date();
        const currentMonthGiven = loans
            .filter((t) => (
                t.sortDate.getFullYear() === now.getFullYear() &&
                t.sortDate.getMonth() === now.getMonth()
            ))
            .reduce((sum, t) => sum + t.amount, 0);

        // Топ категорий (по комментариям)
        const categoryMap = {};
        const weekdayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        const loanSizeBuckets = {
            small: { amount: 0, count: 0 },
            medium: { amount: 0, count: 0 },
            large: { amount: 0, count: 0 }
        };
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
            if (t.amount < 500) {
                loanSizeBuckets.small.amount += t.amount;
                loanSizeBuckets.small.count++;
            } else if (t.amount <= 2000) {
                loanSizeBuckets.medium.amount += t.amount;
                loanSizeBuckets.medium.count++;
            } else {
                loanSizeBuckets.large.amount += t.amount;
                loanSizeBuckets.large.count++;
            }

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
        const projectedPayoff = avgReturnPerMonth > 0
            ? Math.max(0, Math.ceil(currentDebt / avgReturnPerMonth))
            : null;

        // Анализ интервалов
        let intervals = [];
        for (let i = 0; i < loans.length - 1; i++) {
            const diff = (loans[i].sortDate - loans[i + 1].sortDate) / (1000 * 60 * 60 * 24);
            intervals.push(diff);
        }
        const avgInterval = intervals.length > 0 ? (intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1) : 0;
        const recentIntervals = intervals.slice(0, 5);
        const prevIntervals = intervals.slice(5, 10);
        const intervalTrend = recentIntervals.length > 0 && prevIntervals.length > 0 ?
            (recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length < prevIntervals.reduce((a, b) => a + b, 0) / prevIntervals.length ? 'decreasing' : 'increasing') : 'stable';

        // План погашения (Burndown)
        let burndown = [];
        if (payoffTargetDate) {
            const target = new Date(payoffTargetDate);
            const start = new Date();
            const startDebt = currentDebt;
            const daysLeft = Math.max(1, (target - start) / (1000 * 60 * 60 * 24));

            for (let i = 0; i <= 10; i++) {
                const date = new Date(start);
                date.setDate(date.getDate() + (daysLeft / 10) * i);
                burndown.push({
                    date,
                    debt: Math.max(0, startDebt - (startDebt / 10) * i)
                });
            }
        }

        // Предупреждение о лимите (пользовательский лимит)
        const isOverLimit = currentDebt > safetyLimit;

        // Интерактивный симулятор (Что если?)
        let simulatorData = [];
        if (extraPayment > 0) {
            const monthlyRepayment = (returns.length > 0 ? (totalReceived / monthsDiff) : 0) + extraPayment;
            if (monthlyRepayment > 0) {
                const monthsToPayoff = Math.ceil(currentDebt / monthlyRepayment);
                for (let i = 0; i <= Math.min(12, monthsToPayoff); i++) {
                    const date = new Date();
                    date.setMonth(date.getMonth() + i);
                    simulatorData.push({
                        date,
                        debt: Math.max(0, currentDebt - monthlyRepayment * i)
                    });
                }
            }
        }

        // 2. Сравнение периодов (Бенчмарки)
        let benchmarks = {
            monthlyChange: 0,
            intervalChange: 0,
            returnSpeedChange: 0
        };
        if (monthlyStats.length >= 2) {
            benchmarks.monthlyChange = (((monthlyStats[0].given / monthlyStats[1].given) - 1) * 100).toFixed(1);
        }
        if (recentIntervals.length > 0 && prevIntervals.length > 0) {
            const currentAvg = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
            const prevAvg = prevIntervals.reduce((a, b) => a + b, 0) / prevIntervals.length;
            benchmarks.intervalChange = (currentAvg - prevAvg).toFixed(1);
        }

        // 3. Детектор вредных привычек
        const badHabitsTotal = categoryMap['Вредные привычки'] || 0;
        const potentialSavings = badHabitsTotal * 0.5;

        // 4. Геймификация (Достижения)
        const achievements = [];
        const daysSinceLastLoan = lastLoan ? (new Date() - lastLoan.sortDate) / (1000 * 60 * 60 * 24) : 999;

        if (daysSinceLastLoan >= 7) achievements.push({ id: 'discipline', icon: '🏆', title: 'Железная дисциплина', desc: '7+ дней без новых займов' });
        if (recentMonths.length > 0 && recentMonths[0].received > (currentDebt + totalReceived) * 0.3)
            achievements.push({ id: 'reactive', icon: '🚀', title: 'Реактивный возврат', desc: 'Вернули >30% долга за месяц' });
        if (debtTrend === 'decreasing') achievements.push({ id: 'freedom', icon: '📉', title: 'Тренд на свободу', desc: 'Долг стабильно падает' });

        // 5. Мини-планировщик (анализ обещаний в комментах)
        const plannedPayments = data.filter(t => t.comment.match(/\d{2}\.\d{2}/)).map(t => {
            const dateMatch = t.comment.match(/\d{2}\.\d{2}/);
            return {
                id: (t.id || Math.random()),
                date: dateMatch ? dateMatch[0] : '',
                amount: t.amount,
                comment: t.comment,
                type: t.type
            };
        }).slice(0, 5);

        // 6. Учет инфляции (Real Value)
        const monthlyInflation = inflationRate / 100 / 12;
        const realDebtValue = currentDebt / Math.pow(1 + monthlyInflation, monthsDiff);
        const inflationProfit = Math.max(0, currentDebt - realDebtValue);
        const inflationGainPercent = currentDebt > 0 ? ((inflationProfit / currentDebt) * 100).toFixed(1) : 0;

        // 7. Температура стресса (0-100)
        const debtToIncomeRatio = monthlyIncome > 0 ? (currentDebt / monthlyIncome) : 0;
        let stressScore = Math.min(100, Math.ceil(
            (debtToIncomeRatio * 20) +
            (debtTrend === 'growing' ? 30 : 0) +
            (isOverLimit ? 20 : 0)
        ));

        // 8. Бюджет на радости
        const monthlyRest = Math.max(0, monthlyIncome - avgMonthlyGiven);
        const joyBudget = (monthlyRest * 0.1) / 30; // 10% от остатка на радости в день

        // 9. Детектор аномалий (Черные дыры)
        const anomalies = [];
        const weekdayCounts = Object.values(weekdayMap);
        const avgWeekdayAmount = weekdayCounts.reduce((a, b) => a + b, 0) / 7;
        Object.entries(weekdayMap).forEach(([day, amt]) => {
            if (amt > avgWeekdayAmount * 1.5) {
                const daysNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
                anomalies.push({ type: 'day_spike', msg: `Всплеск трат в ${daysNames[day]}. Почти в ${(amt / avgWeekdayAmount).toFixed(1)} раза выше среднего.` });
            }
        });

        // 10. Мили (Milestones)
        const maxDebtEver = Math.max(...cumulativeData.map(d => d.debt), currentDebt);
        const achievements_milestones = [
            { label: '25%', value: 0.25, reached: currentDebt <= maxDebtEver * 0.75 },
            { label: '50%', value: 0.50, reached: currentDebt <= maxDebtEver * 0.50 },
            { label: '75%', value: 0.75, reached: currentDebt <= maxDebtEver * 0.25 },
        ];

        // 11. Снежный ком vs Лавина
        const entities = {};
        loans.forEach(l => {
            const name = l.comment.split(' ')[0] || 'Unknown';
            if (!entities[name]) entities[name] = 0;
            entities[name] += l.amount;
        });
        const snowball = Object.entries(entities).sort((a, b) => a[1] - b[1]); // Сначала мелкие
        const avalanche = Object.entries(entities).sort((a, b) => b[1] - a[1]); // Сначала крупные

        // 12. Стаж долгов (Aging)
        const oldestLoan = loans.length > 0 ? loans[loans.length - 1] : null;
        const debtAgeDays = oldestLoan ? Math.floor((new Date() - oldestLoan.sortDate) / (1000 * 60 * 60 * 24)) : 0;

        // 13. Финансовая свобода (Liberty)
        const recentRepayments = recentMonths.reduce((sum, m) => sum + m.received, 0) / (recentMonths.length || 1);
        const libertyPercentage = monthlyIncome > 0 ? (recentRepayments / monthlyIncome * 100).toFixed(1) : 0;
        const libertyValue = recentRepayments;

        // 14. Упущенная выгода (Opportunity Cost)
        // Считаем сколько бы заработали эти деньги под 15% годовых
        const opportunityCost = currentDebt * 0.15 * (monthsDiff / 12);

        // 15. Рейтинг надежности (Trust Score)
        const debtorStats = {};
        data.forEach(t => {
            const name = t.comment.split(' ')[0] || 'Unknown';
            if (!debtorStats[name]) debtorStats[name] = { given: 0, received: 0, count: 0, lastActivity: t.sortDate };
            if (t.type === 'Дано в долг') debtorStats[name].given += t.amount;
            else debtorStats[name].received += t.amount;
            debtorStats[name].count++;
            if (t.sortDate > debtorStats[name].lastActivity) debtorStats[name].lastActivity = t.sortDate;
        });

        const reliabilityRanking = Object.entries(debtorStats)
            .map(([name, s]) => {
                const ratio = s.given > 0 ? (s.received / s.given) : 0;
                const daysSinceLast = Math.floor((new Date() - s.lastActivity) / (1000 * 60 * 60 * 24));
                // Простая формула: % возврата - штраф за простой
                const score = Math.max(0, Math.round((ratio * 100) - (daysSinceLast / 10)));
                return { name, score, ratio: (ratio * 100).toFixed(0), lastActivity: daysSinceLast };
            })
            .filter(d => d.name !== 'Unknown')
            .sort((a, b) => b.score - a.score);

        // 16. Список "зависших" долгов (Stale Loans)
        const staleLoans = reliabilityRanking
            .filter(d => d.lastActivity > 60 && d.score < 100)
            .slice(0, 5);

        return {
            currentDebt,
            totalGiven,
            totalReceived,
            returnRate: totalGiven > 0 ? ((totalReceived / totalGiven) * 100).toFixed(1) : 0,
            avgLoanAmount,
            loansPerMonth: loansPerMonth.toFixed(1),
            currentMonthGiven,
            avgMonthlyGiven,
            topCategories,
            monthlyStats,
            debtTrend,
            projectedPayoff,
            isOverLimit,
            weekdayStats: Object.entries(weekdayMap).map(([day, amount]) => ({ day: parseInt(day), amount })),
            loanSizeStats: Object.entries(loanSizeBuckets).map(([size, data]) => ({ size, ...data })),
            daysOfMonthData: Object.entries(daysOfMonthMap).map(([day, count]) => ({ day: parseInt(day), count })),
            cumulativeData,
            forecastData,
            simulatorData,
            benchmarks,
            badHabits: { total: badHabitsTotal, potentialSavings },
            achievements,
            plannedPayments,
            inflationProfit,
            stressScore,
            joyBudget,
            anomalies,
            milestones: achievements_milestones,
            strategies: { snowball: snowball.slice(0, 3), avalanche: avalanche.slice(0, 3) },
            intervals: { avg: avgInterval, trend: intervalTrend },
            burndown,
            safetyLimit,
            debtAgeDays,
            liberty: { percentage: libertyPercentage, value: libertyValue },
            opportunityCost,
            reliabilityRanking,
            staleLoans,
            realValue: { nominal: currentDebt, real: realDebtValue, gain: inflationProfit, percent: inflationGainPercent },
            currency: {
                usd: currentDebt / exchangeRates.usd,
                eur: currentDebt / exchangeRates.eur,
                rates: exchangeRates,
                // Гипотетический убыток если курс вырос с 40.0 до текущего
                hedgeGain: (currentDebt / 40.0) - (currentDebt / exchangeRates.usd)
            }
        };
    }, [data, safetyLimit, payoffTargetDate, extraPayment, monthlyIncome, inflationRate]);

    const filteredData = useMemo(() => {
        return data.filter(t => {
            const matchesSearch = (t.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.payee || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' || (filter === 'given' && t.type === 'Дано в долг') || (filter === 'received' && t.type === 'Возврат');
            return matchesSearch && matchesFilter;
        });
    }, [data, searchQuery, filter]);

    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


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

            <FinancialAdvice stats={stats} />

            {/* Achievements Section */}
            {stats.achievements.length > 0 && (
                <div className="achievements-bar">
                    {stats.achievements.map(ach => (
                        <div key={ach.id} className="achievement-chip" title={ach.desc}>
                            <span className="ach-icon">{ach.icon}</span>
                            <div className="ach-info">
                                <span className="ach-title">{ach.title}</span>
                                <span className="ach-desc">{ach.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Milestones Progress Table */}
            <div className="card milestones-card">
                <h3>Финансовые мили (Milestones) 🗺️</h3>
                <div className="milestones-track">
                    {stats.milestones.map((ms, i) => (
                        <div key={i} className={`milestone-step ${ms.reached ? 'reached' : ''}`}>
                            <div className="step-circle">{ms.reached ? '✅' : i + 1}</div>
                            <span className="step-label">{ms.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="stats-grid">
                <div className={`card stat-card ${stats.isOverLimit ? 'danger blink' : 'danger'}`}>
                    <span className="label">
                        Долг Ганны 📈
                        {stats.isOverLimit && <span className="warning-icon">⚠️</span>}
                    </span>
                    <span className="value">
                        {formatAmount(stats.currentDebt)} <span className="value-symbol">₴</span>
                    </span>
                    {stats.benchmarks.monthlyChange !== 0 && (
                        <span className={`stat-delta ${stats.benchmarks.monthlyChange > 0 ? 'up' : 'down'}`}>
                            {stats.benchmarks.monthlyChange > 0 ? '+' : ''}{stats.benchmarks.monthlyChange}% к прошлому мес.
                        </span>
                    )}
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
                    <span className="label">Примерное время возврата текущего долга</span>
                    <span className="value">
                        {stats.projectedPayoff !== null ? (
                            <>{stats.projectedPayoff} <span className="value-unit">мес.</span></>
                        ) : (
                            <>Нет данных</>
                        )}
                    </span>
                </div>
                <div className="card stat-card info">
                    <span className="label">Одолжила у меня за текущий месяц</span>
                    <span className="value">{formatAmount(stats.currentMonthGiven)} <span className="value-symbol">₴</span></span>
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
                    <button className="retry-btn" onClick={handleZenMoneySync} disabled={syncingZen || uploading}>
                        {syncingZen ? 'Синхронизация ZenMoney...' : 'Синхронизировать с ZenMoney'}
                    </button>
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
                                    burndownData={chartMode === 'debt' ? stats.burndown : []}
                                    safetyLimit={chartMode === 'debt' ? safetyLimit : null}
                                    mode={chartMode}
                                    width={width}
                                    height={height}
                                    theme={theme}
                                    simulatorData={stats.simulatorData}
                                />
                            )}
                        </ParentSize>
                    )}
                </div>
                <div className="chart-footer">
                    {chartMode === 'debt' && <p className="chart-hint">Пунктир — прогноз (60 дн). <span style={{ color: '#f59e0b' }}>Оранжевый пунктир</span> — линия цели.</p>}
                    <div className="chart-settings">
                        <div className="setting-item">
                            <label>Лимит:</label>
                            <input type="number" value={safetyLimit} onChange={(e) => {
                                setSafetyLimit(Number(e.target.value));
                                localStorage.setItem('safetyLimit', e.target.value);
                            }} />
                        </div>
                        <div className="setting-item">
                            <label>Доход:</label>
                            <input type="number" value={monthlyIncome} onChange={(e) => {
                                setMonthlyIncome(Number(e.target.value));
                                localStorage.setItem('monthlyIncome', e.target.value);
                            }} />
                        </div>
                        <div className="setting-item">
                            <label>Инфляция (%):</label>
                            <input type="number" value={inflationRate} onChange={(e) => {
                                setInflationRate(Number(e.target.value));
                                localStorage.setItem('inflationRate', e.target.value);
                            }} />
                        </div>
                    </div>
                    {chartMode === 'debt' && (
                        <div className="simulator-control">
                            <label>Симулятор: +{formatAmount(extraPayment)} ₴/мес к возврату</label>
                            <input
                                type="range"
                                min="0"
                                max="10000"
                                step="500"
                                value={extraPayment}
                                onChange={(e) => setExtraPayment(Number(e.target.value))}
                            />
                            {extraPayment > 0 && <span className="simulator-hint">Зеленый пунктир — ускоренный план</span>}
                        </div>
                    )}
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


            <div className="card list-card">
                <div className="list-header">
                    <div className="search-wrap">
                        <Search size={18} className="search-icon" />
                        <input
                            placeholder="Поиск по комментариям или имени..."
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
