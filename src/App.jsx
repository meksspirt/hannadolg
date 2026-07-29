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
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import DebtChart from './DebtChart';
import FinancialAdvice from './FinancialAdvice';

const App = () => {
    const formatAmount = (num) => {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num).replace(',', '.');
    };

    const [chartMode, setChartMode] = useState('debt'); // 'debt' or 'flow'
    const [chartPeriod, setChartPeriod] = useState('all'); // '1d','1m','6m','ytd','1y','all'
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [safetyLimit, setSafetyLimit] = useState(localStorage.getItem('safetyLimit') || 50000);
    const [payoffTargetDate, setPayoffTargetDate] = useState(() => localStorage.getItem('payoffTargetDate') || '');
    const [extraPayment, setExtraPayment] = useState(0);
    const [monthlyIncome, setMonthlyIncome] = useState(() => Number(localStorage.getItem('monthlyIncome')) || 30000);
    const [inflationRate, setInflationRate] = useState(() => Number(localStorage.getItem('inflationRate')) || 15);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [monthlyPage, setMonthlyPage] = useState(1);
    const [statsView, setStatsView] = useState('month');
    const [weeklyPage, setWeeklyPage] = useState(1);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [exchangeRates, setExchangeRates] = useState({ usd: 41.5, eur: 44.8 });
    const [isOnline, setIsOnline] = useState(true);
    const itemsPerPage = 10;

    useEffect(() => {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.removeItem('debt-sense-transactions');
        fetchData();
        fetchRates();
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

    const processTransactions = (raw) => {
        const isHannaCounterparty = (transaction) => {
            const payee = (transaction.payee || '').toLowerCase();
            return payee.includes('ганна є');
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

    const uploadTransactions = async (
        transactions,
        emptyMessage = 'Транзакций не обнаружено.',
        showSuccessAlert = true
    ) => {
        if (!Array.isArray(transactions) || transactions.length === 0) {
            if (showSuccessAlert) {
                alert(emptyMessage);
            }
            return;
        }

        setUploading(true);
        try {
            const res = await fetch('/api/add-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactions)
            });

            if (!res.ok) {
                throw new Error('Server error');
            }

            const result = await res.json();
            if (showSuccessAlert) {
                alert(result.message || 'Данные синхронизированы с сервером!');
            }
            setIsOnline(true);
            fetchData();
        } catch (e) {
            console.warn('Не удалось загрузить на сервер:', e);
            alert(`Ошибка загрузки: ${e.message}`);
        } finally {
            setUploading(false);
        }
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

            await uploadTransactions(parsed);
        };
        reader.readAsText(file, 'UTF-8');
    };

    const stats = useMemo(() => {
        if (data.length === 0) return {
            currentDebt: 0, totalGiven: 0, totalReceived: 0, returnRate: 0,
            avgLoanAmount: 0, loansPerMonth: 0, currentMonthGiven: 0, lastWeekGiven: 0, avgMonthlyGiven: 0, topCategories: [], monthlyStats: [], weeklyStats: [],
            debtTrend: 'stable', projectedPayoff: null, isOverLimit: false,
            weekdayStats: [], loanSizeStats: [], daysOfMonthData: [], cumulativeData: [], forecastData: [],
            simulatorData: [], _monthlyReceivedRate: 0, _netMonthlyChange: 0, benchmarks: { monthlyChange: 0, intervalChange: 0 },
            badHabits: { total: 0, potentialSavings: 0 }, achievements: [], plannedPayments: [],
            inflationProfit: 0, stressScore: 0, joyBudget: 0, anomalies: [],
            strategies: { snowball: [], avalanche: [] },
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

        const avgLoanAmount = loans.length > 0 ? totalGiven / loans.length : 0;

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
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const lastWeekGiven = loans
            .filter(t => t.sortDate >= weekAgo)
            .reduce((sum, t) => sum + t.amount, 0);

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

            const day = t.sortDate.getDay();
            weekdayMap[day] += t.amount;

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

            const date = t.sortDate.getDate();
            daysOfMonthMap[date]++;
        });

        const topCategories = Object.entries(categoryMap)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, amount]) => ({ name, amount, percentage: ((amount / totalGiven) * 100).toFixed(1) }));

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

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const recentLoans   = loans.filter(t => t.sortDate >= sixtyDaysAgo);
        const recentReturns = returns.filter(t => t.sortDate >= sixtyDaysAgo);

        let forecastData = [];
        const recentGiven    = recentLoans.reduce((s, t) => s + t.amount, 0);
        const recentReceived = recentReturns.reduce((s, t) => s + t.amount, 0);
        const monthlyGivenRate    = recentGiven    / 2;
        const monthlyReceivedRate = recentReceived / 2;
        const netMonthlyChange    = monthlyGivenRate - monthlyReceivedRate;

        if (recentLoans.length > 0 || recentReturns.length > 0) {
            const currentDebtNow = data.length > 0 ? data[0].currentDebt : 0;
            for (let i = 1; i <= 6; i++) {
                const fDate = new Date();
                fDate.setMonth(fDate.getMonth() + i);
                forecastData.push({
                    date: fDate,
                    debt: Math.max(0, currentDebtNow + netMonthlyChange * i),
                    isForecast: true
                });
            }
        }

        const monthlyMap = {};
        data.forEach(t => {
            const monthKey = t.sortDate.toISOString().slice(0, 7);
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
            .map(([month, stats]) => ({
                month,
                ...stats,
                net: stats.given - stats.received
            }));

        const weeklyMap = {};
        data.forEach(t => {
            const d = t.sortDate;
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d);
            monday.setDate(diff);
            const weekKey = monday.toISOString().slice(0, 10);
            if (!weeklyMap[weekKey]) {
                weeklyMap[weekKey] = { given: 0, received: 0, loans: 0, returns: 0, weekStart: monday };
            }
            if (t.type === 'Дано в долг') {
                weeklyMap[weekKey].given += t.amount;
                weeklyMap[weekKey].loans++;
            } else {
                weeklyMap[weekKey].received += t.amount;
                weeklyMap[weekKey].returns++;
            }
        });

        const weeklyStats = Object.entries(weeklyMap)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([week, stats]) => ({
                week,
                ...stats,
                net: stats.given - stats.received
            }));

        const recentMonths = monthlyStats.slice(0, 3);
        let debtTrend = 'stable';
        if (recentMonths.length >= 2) {
            const trend = recentMonths[0].net - recentMonths[1].net;
            debtTrend = trend > 500 ? 'growing' : trend < -500 ? 'decreasing' : 'stable';
        }

        const avgReturnPerMonth = returns.length > 0 ? totalReceived / monthsDiff : 0;
        const projectedPayoff = avgReturnPerMonth > 0
            ? Math.max(0, Math.ceil(currentDebt / avgReturnPerMonth))
            : null;

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

        const isOverLimit = currentDebt > safetyLimit;

        let simulatorData = [];
        if (extraPayment > 0) {
            const totalMonthlyReturn = monthlyReceivedRate + extraPayment;
            if (totalMonthlyReturn > 0) {
                for (let i = 0; i <= 36; i++) {
                    const remaining = currentDebt - totalMonthlyReturn * i;
                    const date = new Date();
                    date.setMonth(date.getMonth() + i);
                    simulatorData.push({
                        date,
                        debt: Math.max(0, remaining)
                    });
                    if (remaining <= 0) break;
                }
            }
        }

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

        const badHabitsTotal = categoryMap['Вредные привычки'] || 0;
        const potentialSavings = badHabitsTotal * 0.5;

        const achievements = [];
        const daysSinceLastLoan = lastLoan ? (new Date() - lastLoan.sortDate) / (1000 * 60 * 60 * 24) : 999;
        if (daysSinceLastLoan >= 7) achievements.push({ id: 'discipline', icon: '🏆', title: 'Железная дисциплина', desc: '7+ дней без новых займов' });

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

        const monthlyInflation = inflationRate / 100 / 12;
        const realDebtValue = currentDebt / Math.pow(1 + monthlyInflation, monthsDiff);
        const inflationProfit = Math.max(0, currentDebt - realDebtValue);
        const inflationGainPercent = currentDebt > 0 ? ((inflationProfit / currentDebt) * 100).toFixed(1) : 0;

        const debtToIncomeRatio = monthlyIncome > 0 ? (currentDebt / monthlyIncome) : 0;
        let stressScore = Math.min(100, Math.ceil(
            (debtToIncomeRatio * 20) +
            (debtTrend === 'growing' ? 30 : 0) +
            (isOverLimit ? 20 : 0)
        ));

        const monthlyRest = Math.max(0, monthlyIncome - avgMonthlyGiven);
        const joyBudget = (monthlyRest * 0.1) / 30;

        const anomalies = [];
        const weekdayCounts = Object.values(weekdayMap);
        const avgWeekdayAmount = weekdayCounts.reduce((a, b) => a + b, 0) / 7;
        Object.entries(weekdayMap).forEach(([day, amt]) => {
            if (amt > avgWeekdayAmount * 1.5) {
                const daysNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
                anomalies.push({ type: 'day_spike', msg: `Всплеск трат в ${daysNames[day]}. Почти в ${(amt / avgWeekdayAmount).toFixed(1)} раза выше среднего.` });
            }
        });

        const entities = {};
        loans.forEach(l => {
            const name = l.comment.split(' ')[0] || 'Unknown';
            if (!entities[name]) entities[name] = 0;
            entities[name] += l.amount;
        });
        const snowball = Object.entries(entities).sort((a, b) => a[1] - b[1]);
        const avalanche = Object.entries(entities).sort((a, b) => b[1] - a[1]);

        const oldestLoan = loans.length > 0 ? loans[loans.length - 1] : null;
        const debtAgeDays = oldestLoan ? Math.floor((new Date() - oldestLoan.sortDate) / (1000 * 60 * 60 * 24)) : 0;

        const recentRepayments = recentMonths.reduce((sum, m) => sum + m.received, 0) / (recentMonths.length || 1);
        const libertyPercentage = monthlyIncome > 0 ? (recentRepayments / monthlyIncome * 100).toFixed(1) : 0;
        const libertyValue = recentRepayments;

        const opportunityCost = currentDebt * 0.15 * (monthsDiff / 12);

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
                const score = Math.max(0, Math.round((ratio * 100) - (daysSinceLast / 10)));
                return { name, score, ratio: (ratio * 100).toFixed(0), lastActivity: daysSinceLast };
            })
            .filter(d => d.name !== 'Unknown')
            .sort((a, b) => b.score - a.score);

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
            lastWeekGiven,
            avgMonthlyGiven,
            topCategories,
            monthlyStats,
            weeklyStats,
            debtTrend,
            projectedPayoff,
            isOverLimit,
            weekdayStats: Object.entries(weekdayMap).map(([day, amount]) => ({ day: parseInt(day), amount })),
            loanSizeStats: Object.entries(loanSizeBuckets).map(([size, data]) => ({ size, ...data })),
            daysOfMonthData: Object.entries(daysOfMonthMap).map(([day, count]) => ({ day: parseInt(day), count })),
            cumulativeData,
            forecastData,
            simulatorData,
            _monthlyReceivedRate: monthlyReceivedRate,
            _netMonthlyChange: netMonthlyChange,
            benchmarks,
            badHabits: { total: badHabitsTotal, potentialSavings },
            achievements,
            plannedPayments,
            inflationProfit,
            stressScore,
            joyBudget,
            anomalies,
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
                hedgeGain: (currentDebt / 40.0) - (currentDebt / exchangeRates.usd)
            }
        };
    }, [data, safetyLimit, payoffTargetDate, extraPayment, monthlyIncome, inflationRate]);

    const filteredData = useMemo(() => {
        return data.filter(t => {
            const matchesSearch = (t.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.payee || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' || (filter === 'given' && t.type === 'Дано в долг') || (filter === 'received' && t.type === 'Возврат');
            const matchesWeek = !selectedWeek || (t.sortDate >= selectedWeek.start && t.sortDate <= selectedWeek.end);
            return matchesSearch && matchesFilter && matchesWeek;
        });
    }, [data, searchQuery, filter, selectedWeek]);

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

    const periodFilteredChartData = useMemo(() => {
        if (formattedChartData.length === 0) return [];
        if (chartPeriod === 'all') return formattedChartData;

        const now = new Date();
        let from;
        if (chartPeriod === '1d') {
            from = new Date(now); from.setDate(from.getDate() - 1);
        } else if (chartPeriod === '1m') {
            from = new Date(now); from.setMonth(from.getMonth() - 1);
        } else if (chartPeriod === '6m') {
            from = new Date(now); from.setMonth(from.getMonth() - 6);
        } else if (chartPeriod === 'ytd') {
            from = new Date(now.getFullYear(), 0, 1);
        } else if (chartPeriod === '1y') {
            from = new Date(now); from.setFullYear(from.getFullYear() - 1);
        }

        const filtered = formattedChartData.filter(d => d.date >= from);
        if (filtered.length === 0) return formattedChartData.slice(-1);

        const before = formattedChartData.filter(d => d.date < from);
        if (before.length > 0) {
            const startPoint = { ...before[before.length - 1], date: from };
            return [startPoint, ...filtered];
        }
        return filtered;
    }, [formattedChartData, chartPeriod]);

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Анализатор долгов</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-3 mt-1">
                        Учет транзакций Ганны Є.
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            {isOnline ? 'Онлайн' : 'Локально'}
                        </span>
                    </p>
                </div>
                <button
                    className="p-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors shadow-2xs"
                    onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </header>

            <FinancialAdvice stats={stats} />

            {/* Achievements Section */}
            {stats.achievements.length > 0 && (
                <div className="flex flex-wrap gap-2.5 mb-6">
                    {stats.achievements.map(ach => (
                        <div key={ach.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs shadow-2xs" title={ach.desc}>
                            <span className="text-base">{ach.icon}</span>
                            <div className="flex flex-col">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{ach.title}</span>
                                <span className="text-slate-500 dark:text-slate-400 text-[11px]">{ach.desc}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* План погашения до 31.12.2026 */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 mb-6 shadow-xs">
                {(() => {
                    const target = new Date(2026, 11, 31);
                    const now = new Date();
                    const monthsLeft = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
                    const monthlyPayment = monthsLeft > 0 ? stats.currentDebt / monthsLeft : stats.currentDebt;
                    const repayPct = stats.totalGiven > 0 ? Math.min(100, (stats.totalReceived / stats.totalGiven) * 100) : 0;
                    return (
                        <>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Погашение до 31.12.2026 🎯</h3>
                                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                    {monthsLeft} мес. осталось
                                </span>
                            </div>
                            <div className="text-center p-4 my-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50">
                                <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-1">Ежемесячный платёж</div>
                                <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 flex items-baseline justify-center gap-1">
                                    {formatAmount(monthlyPayment)} <span className="text-lg font-semibold opacity-80">₴</span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    {formatAmount(stats.currentDebt)} ₴ · {monthsLeft} платежей
                                </div>
                            </div>
                            <div className="my-4">
                                <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${repayPct}%` }} />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium">
                                    <span>Выдано: {formatAmount(stats.totalGiven)} ₴</span>
                                    <span>Возвращено: {repayPct.toFixed(0)}%</span>
                                    <span>Цель: 100%</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 text-xs">
                                    <span className="text-base">📅</span>
                                    <span className="text-slate-500 dark:text-slate-400 flex-1">Осталось месяцев</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{monthsLeft}</span>
                                </div>
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 text-xs">
                                    <span className="text-base">💰</span>
                                    <span className="text-slate-500 dark:text-slate-400 flex-1">Текущий долг</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatAmount(stats.currentDebt)} <span className="font-medium opacity-80">₴</span></span>
                                </div>
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 text-xs">
                                    <span className="text-base">📊</span>
                                    <span className="text-slate-500 dark:text-slate-400 flex-1">Всего к выплате</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">{formatAmount(monthlyPayment * monthsLeft)} <span className="font-medium opacity-80">₴</span></span>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between ${stats.isOverLimit ? 'animate-blink border-red-500' : ''}`}>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                        Долг Ганны 📈
                        {stats.isOverLimit && <span className="ml-1.5 text-sm">⚠️</span>}
                    </span>
                    <span className="text-2xl font-bold text-red-500 flex items-baseline gap-1.5 flex-wrap">
                        {formatAmount(stats.currentDebt)} <span className="text-base font-medium opacity-80">₴</span>
                    </span>
                    {stats.benchmarks.monthlyChange !== 0 && (
                        <span className={`text-xs font-semibold mt-1 inline-block ${stats.benchmarks.monthlyChange > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {stats.benchmarks.monthlyChange > 0 ? '+' : ''}{stats.benchmarks.monthlyChange}% к прошлому мес.
                        </span>
                    )}
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Дано всего</span>
                    <span className="text-2xl font-bold text-amber-500 flex items-baseline gap-1.5 flex-wrap">{formatAmount(stats.totalGiven)} <span className="text-base font-medium opacity-80">₴</span></span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Вернула всего</span>
                    <span className="text-2xl font-bold text-emerald-500 flex items-baseline gap-1.5 flex-wrap">{formatAmount(stats.totalReceived)} <span className="text-base font-medium opacity-80">₴</span></span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Процент возврата</span>
                    <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-baseline gap-1.5 flex-wrap">{stats.returnRate}<span className="text-base font-medium opacity-80">%</span></span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Примерное время возврата текущего долга</span>
                    <span className="text-2xl font-bold text-blue-500 flex items-baseline gap-1.5 flex-wrap">
                        {stats.projectedPayoff !== null ? (
                            <>{stats.projectedPayoff} <span className="text-sm font-medium text-slate-500 dark:text-slate-400">мес.</span></>
                        ) : (
                            <>Нет данных</>
                        )}
                    </span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Одолжила у меня за текущий месяц</span>
                    <span className="text-2xl font-bold text-blue-500 flex items-baseline gap-1.5 flex-wrap">{formatAmount(stats.currentMonthGiven)} <span className="text-base font-medium opacity-80">₴</span></span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">только новые займы</span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Одолжила за последние 7 дней</span>
                    <span className="text-2xl font-bold text-blue-500 flex items-baseline gap-1.5 flex-wrap">{formatAmount(stats.lastWeekGiven)} <span className="text-base font-medium opacity-80">₴</span></span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">только новые займы</span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">В среднем в месяц</span>
                    <span className="text-2xl font-bold text-blue-500 flex items-baseline gap-1.5 flex-wrap">{formatAmount(stats.avgMonthlyGiven)} <span className="text-base font-medium opacity-80">₴</span></span>
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Тренд</span>
                    <span className={`text-2xl font-bold flex items-baseline gap-1.5 flex-wrap ${stats.debtTrend === 'growing' ? 'text-red-500' : stats.debtTrend === 'decreasing' ? 'text-emerald-500' : 'text-blue-500'}`}>
                        {stats.debtTrend === 'growing' ? (
                            <><span className="text-base font-medium">📈</span> Растет</>
                        ) : stats.debtTrend === 'decreasing' ? (
                            <><span className="text-base font-medium">📉</span> Снижается</>
                        ) : (
                            <><span className="text-base font-medium">➡️</span> Стабильно</>
                        )}
                    </span>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 mb-6 shadow-xs">
                <input
                    type="file"
                    id="file"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    accept=".csv"
                />
                <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="file" className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm cursor-pointer transition-colors shadow-2xs">
                        <Upload size={20} />
                        {uploading ? 'Загрузка...' : 'Выбрать CSV таблицу'}
                    </label>
                    {!isOnline && (
                        <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium text-sm cursor-pointer transition-colors" onClick={fetchData} disabled={loading}>
                            <Wifi size={16} />
                            {loading ? 'Подключение...' : 'Попробовать снова'}
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 mb-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{chartMode === 'debt' ? 'Динамика долга и прогноз' : 'Накопительные потоки (Flow)'}</h3>
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80 self-start sm:self-auto">
                        <button className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${chartMode === 'debt' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setChartMode('debt')}>Тренд</button>
                        <button className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${chartMode === 'flow' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setChartMode('flow')}>Поток</button>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                    {[
                        { key: '1d',  label: 'День'    },
                        { key: '1m',  label: 'Месяц'   },
                        { key: '6m',  label: '6 мес'   },
                        { key: 'ytd', label: 'С 1 янв' },
                        { key: '1y',  label: 'Год'     },
                        { key: 'all', label: 'Всё'     },
                    ].map(p => (
                        <button
                            key={p.key}
                            className={`px-3 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${chartPeriod === p.key ? 'bg-blue-600 border-blue-600 text-white font-semibold' : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                            onClick={() => setChartPeriod(p.key)}
                        >{p.label}</button>
                    ))}
                </div>
                <div className="w-full h-80 my-4">
                    {periodFilteredChartData.length > 0 && (
                        <ParentSize>
                            {({ width, height }) => (
                                <DebtChart
                                    data={chartMode === 'debt' ? periodFilteredChartData : stats.cumulativeData}
                                    forecastData={chartMode === 'debt' && chartPeriod === 'all' ? stats.forecastData : []}
                                    burndownData={chartMode === 'debt' ? stats.burndown : []}
                                    safetyLimit={chartMode === 'debt' ? safetyLimit : null}
                                    mode={chartMode}
                                    width={width}
                                    height={height}
                                    theme={theme}
                                    simulatorData={chartMode === 'debt' && chartPeriod === 'all' ? stats.simulatorData : []}
                                />
                            )}
                        </ParentSize>
                    )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    {/* Легенда */}
                    {chartMode === 'debt' && (
                        <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400 py-3 border-b border-slate-100 dark:border-slate-700/50 mb-4">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-4 h-0.5 bg-blue-500 inline-block"></span> Долг
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-4 h-0.5 border-t-2 border-dashed border-blue-500 inline-block"></span> Прогноз (выдача − возврат, 60 дн)
                            </span>
                            {stats.burndown.length > 0 && (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500 inline-block"></span> Цель погашения
                                </span>
                            )}
                            {extraPayment > 0 && (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-4 h-0.5 border-t-2 border-dashed border-emerald-500 inline-block"></span> Ускоренный план
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-4 h-0.5 border-t-2 border-dashed border-red-500 inline-block"></span> Лимит
                            </span>
                        </div>
                    )}

                    {/* Настройки */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50">
                        <div className="flex flex-col gap-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Параметры</span>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300" title="Порог долга — при превышении карточка мигает">⚠️ Лимит долга, ₴</label>
                                <input className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500" type="number" value={safetyLimit} min="0" step="1000" onChange={(e) => {
                                    setSafetyLimit(Number(e.target.value));
                                    localStorage.setItem('safetyLimit', e.target.value);
                                }} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300" title="Используется для расчёта стресса и бюджета на радости">💰 Месячный доход, ₴</label>
                                <input className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500" type="number" value={monthlyIncome} min="0" step="1000" onChange={(e) => {
                                    setMonthlyIncome(Number(e.target.value));
                                    localStorage.setItem('monthlyIncome', e.target.value);
                                }} />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-slate-700 dark:text-slate-300" title="Годовая инфляция для расчёта реальной стоимости долга">📈 Инфляция, % год.</label>
                                <input className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500" type="number" value={inflationRate} min="0" max="100" step="1" onChange={(e) => {
                                    setInflationRate(Number(e.target.value));
                                    localStorage.setItem('inflationRate', e.target.value);
                                }} />
                            </div>
                        </div>

                        {chartMode === 'debt' && (
                            <div className="flex flex-col gap-3">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Цель погашения</span>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" title="Оранжевый пунктир — план погашения к этой дате">🎯 Дата цели</label>
                                    <input
                                        className="px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        type="date"
                                        value={payoffTargetDate}
                                        min={new Date().toISOString().slice(0, 10)}
                                        onChange={(e) => {
                                            setPayoffTargetDate(e.target.value);
                                            localStorage.setItem('payoffTargetDate', e.target.value);
                                        }}
                                    />
                                </div>
                                {payoffTargetDate && stats.burndown.length > 0 && (() => {
                                    const target = new Date(payoffTargetDate);
                                    const daysLeft = Math.max(0, Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24)));
                                    const monthsLeft = (daysLeft / 30).toFixed(1);
                                    const requiredMonthly = daysLeft > 0
                                        ? formatAmount(stats.currentDebt / (daysLeft / 30))
                                        : '—';
                                    return (
                                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex flex-col gap-1">
                                            <span>⏳ {daysLeft} дн. ({monthsLeft} мес.)</span>
                                            <span>Нужно возвращать: <strong>{requiredMonthly} ₴/мес</strong></span>
                                        </div>
                                    );
                                })()}
                                {payoffTargetDate && (
                                    <button className="self-start text-xs text-red-500 hover:text-red-600 font-medium cursor-pointer transition-colors" onClick={() => {
                                        setPayoffTargetDate('');
                                        localStorage.removeItem('payoffTargetDate');
                                    }}>✕ Сбросить дату</button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Симулятор */}
                    {chartMode === 'debt' && (
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50">
                            <div className="flex justify-between items-center mb-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                                <label>🚀 Симулятор доплаты</label>
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                    {extraPayment > 0 ? `+${formatAmount(extraPayment)} ₴/мес` : 'выкл.'}
                                </span>
                            </div>
                            <input
                                className="w-full accent-blue-600 cursor-pointer"
                                type="range"
                                min="0"
                                max="10000"
                                step="500"
                                value={extraPayment}
                                onChange={(e) => setExtraPayment(Number(e.target.value))}
                            />
                            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                                <span>0</span><span>2 500</span><span>5 000</span><span>7 500</span><span>10 000</span>
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                                База возврата (60 дн): <strong>{formatAmount(stats._monthlyReceivedRate || 0)} ₴/мес</strong>
                                {extraPayment > 0 && <> → итого: <strong className="text-emerald-500">{formatAmount((stats._monthlyReceivedRate || 0) + extraPayment)} ₴/мес</strong></>}
                            </div>
                            {extraPayment > 0 && stats.simulatorData.length > 0 && (() => {
                                const lastPoint = stats.simulatorData[stats.simulatorData.length - 1];
                                const monthsToZero = stats.simulatorData.findIndex(d => d.debt <= 0);
                                const simMonths = stats.simulatorData.length - 1;
                                const baseReturn = stats._monthlyReceivedRate || 0;
                                const monthsWithoutExtra = baseReturn > 0
                                    ? Math.ceil(stats.currentDebt / baseReturn)
                                    : null;
                                const monthsSaved = (monthsToZero > 0 && monthsWithoutExtra)
                                    ? monthsWithoutExtra - monthsToZero
                                    : null;
                                return (
                                    <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300">
                                        {monthsToZero > 0
                                            ? <span>✅ Долг обнулится через <strong>{monthsToZero} мес.</strong></span>
                                            : <span>📉 Через {simMonths} мес. остаток: <strong>{formatAmount(lastPoint.debt)} ₴</strong></span>
                                        }
                                        {monthsSaved > 0 && (
                                            <span className="block mt-1 text-emerald-600 dark:text-emerald-400">
                                                💡 Быстрее на <strong>{monthsSaved} мес.</strong> vs без доплаты
                                            </span>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Статистика по месяцам / неделям */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 mb-6 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Статистика по {statsView === 'month' ? 'месяцам' : 'неделям'}</h3>
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80">
                        <button className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${statsView === 'month' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setStatsView('month')}>Месяцы</button>
                        <button className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${statsView === 'week' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setStatsView('week')}>Недели</button>
                    </div>
                </div>
                {statsView === 'month' ? (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {stats.monthlyStats
                                .slice((monthlyPage - 1) * 4, monthlyPage * 4)
                                .map((month, i) => (
                                <div key={i} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                            {new Date(month.month + '-01').toLocaleDateString('ru', {
                                                year: 'numeric',
                                                month: 'long'
                                            })}
                                        </span>
                                        <span className={`text-xs font-bold ${month.net > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {month.net > 0 ? '+' : ''}{formatAmount(month.net)} ₴
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-col gap-1">
                                        <div>Дано: {formatAmount(month.given)} ₴ ({month.loans} раз)</div>
                                        <div>Вернула: {formatAmount(month.received)} ₴ ({month.returns} раз)</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {stats.monthlyStats.length > 4 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 text-xs">
                                <button className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer" disabled={monthlyPage <= 1} onClick={() => setMonthlyPage(p => p - 1)}>← Пред.</button>
                                <span className="text-slate-500 dark:text-slate-400 font-medium">{monthlyPage} / {Math.ceil(stats.monthlyStats.length / 4)}</span>
                                <button className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer" disabled={monthlyPage >= Math.ceil(stats.monthlyStats.length / 4)} onClick={() => setMonthlyPage(p => p + 1)}>След. →</button>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {stats.weeklyStats
                                .slice((weeklyPage - 1) * 4, weeklyPage * 4)
                                .map((week, i) => (
                                <div key={i} className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedWeek?.week === week.week ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-900/30'}`} onClick={() => {
                                    const monday = new Date(week.week + 'T00:00:00');
                                    const sunday = new Date(monday);
                                    sunday.setDate(sunday.getDate() + 6);
                                    sunday.setHours(23, 59, 59, 999);
                                    setSelectedWeek(selectedWeek?.week === week.week ? null : { week: week.week, start: monday, end: sunday, label: `${monday.toLocaleDateString('ru', { day: 'numeric', month: 'long' })} — ${sunday.toLocaleDateString('ru', { day: 'numeric', month: 'long' })}` });
                                    setCurrentPage(1);
                                }}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                            {new Date(week.week + 'T00:00:00').toLocaleDateString('ru', {
                                                day: 'numeric',
                                                month: 'long'
                                            })} — {new Date(new Date(week.week + 'T00:00:00').getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ru', {
                                                day: 'numeric',
                                                month: 'long'
                                            })}
                                        </span>
                                        <span className={`text-xs font-bold ${week.net > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {week.net > 0 ? '+' : ''}{formatAmount(week.net)} ₴
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-col gap-1">
                                        <div>Дано: {formatAmount(week.given)} ₴ ({week.loans} раз)</div>
                                        <div>Вернула: {formatAmount(week.received)} ₴ ({week.returns} раз)</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {stats.weeklyStats.length > 4 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 text-xs">
                                <button className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer" disabled={weeklyPage <= 1} onClick={() => setWeeklyPage(p => p - 1)}>← Пред.</button>
                                <span className="text-slate-500 dark:text-slate-400 font-medium">{weeklyPage} / {Math.ceil(stats.weeklyStats.length / 4)}</span>
                                <button className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer" disabled={weeklyPage >= Math.ceil(stats.weeklyStats.length / 4)} onClick={() => setWeeklyPage(p => p + 1)}>След. →</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-6 mb-6 shadow-xs">
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center mb-4">
                    <div className="relative flex-1 w-full sm:max-w-md">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            placeholder="Поиск по комментариям или имени..."
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-700/80">
                        <button className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${filter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setFilter('all')}>Все</button>
                        <button className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${filter === 'given' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setFilter('given')}>Выдано</button>
                        <button className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${filter === 'received' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-2xs font-semibold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'}`} onClick={() => setFilter('received')}>Возвраты</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm text-left">
                        <thead>
                            <tr>
                                <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Дата</th>
                                <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Комментарий</th>
                                <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Тип</th>
                                <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Сумма</th>
                                <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">Остаток</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((t, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 whitespace-nowrap">{t.formattedDate}</td>
                                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 text-slate-800 dark:text-slate-200">{t.comment}</td>
                                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${t.type === 'Возврат' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}>
                                            {t.type === 'Возврат' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatAmount(t.amount)}</td>
                                    <td className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{formatAmount(t.currentDebt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 text-xs">
                    <button className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer transition-colors" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Назад</button>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">{currentPage} / {Math.ceil(filteredData.length / itemsPerPage)}</span>
                    <button className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-40 cursor-pointer transition-colors" disabled={currentPage * itemsPerPage >= filteredData.length} onClick={() => setCurrentPage(p => p + 1)}>Вперед</button>
                </div>
                {selectedWeek && (
                    <div className="flex items-center justify-between mt-3 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-700 dark:text-blue-300">
                        <span>📅 {selectedWeek.label}</span>
                        <button className="text-red-500 hover:text-red-600 font-medium cursor-pointer" onClick={() => { setSelectedWeek(null); setCurrentPage(1); }}>✕ Сбросить</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
