/**
 * debt-analytics.js
 * Ядро финансовых расчетов и аналитики проекта DebtSense Analytics.
 * Спроектировано по принципам clean-code и finance-expert:
 * чистые функции, финансовая точность, изолированная бизнес-логика.
 */

export const roundMoney = (num) => Math.round((Number(num) || 0) * 100) / 100;

export const formatAmount = (num) => {
    return new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num || 0).replace(',', '.');
};

/**
 * Проверка контрагента с защитой от регистра и различий в украинской/русской раскладке (Є / Е).
 */
export const isHannaCounterparty = (transaction) => {
    const payee = (transaction?.payee || '').toLowerCase();
    return payee.includes('ганна є') || payee.includes('ганна е') || payee.includes('ганна');
};

/**
 * Парсинг даты в объект Date для надежной сортировки
 */
export const toSortDate = (t) => {
    const s = t?.date ?? '';
    if (!s) return new Date(0);
    return new Date(s.includes('.') ? s.split('.').reverse().join('-') : s);
};

/**
 * Обработка и трансформация сырых транзакций
 */
export const processTransactions = (raw = []) => {
    if (!Array.isArray(raw)) return [];

    const rows = raw.filter(isHannaCounterparty).map(t => {
        const income = parseFloat(t.income ?? t.income_amount) || 0;
        const outcome = parseFloat(t.outcome ?? t.outcome_amount) || 0;

        const incomeAccount = (t.income_account_name || t.incomeAccountName || '').toLowerCase();
        const outcomeAccount = (t.outcome_account_name || t.outcomeAccountName || '').toLowerCase();

        const isDebtIncome = incomeAccount.includes('долги') || incomeAccount.includes('долг');
        const isDebtOutcome = outcomeAccount.includes('долги') || outcomeAccount.includes('долг');

        let amount = 0;
        let type = '';

        if (isDebtIncome) {
            amount = roundMoney(income);
            type = 'Дано в долг';
        } else if (isDebtOutcome) {
            amount = roundMoney(outcome);
            type = 'Возврат';
        } else {
            return null;
        }

        const d = t.date ?? '';
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
                currentDebt = roundMoney(currentDebt + t.amount);
            } else {
                currentDebt = roundMoney(currentDebt - t.amount);
            }
            return { ...t, currentDebt };
        })
        .sort((a, b) => b.sortDate - a.sortDate);
};

/**
 * Парсинг загружаемого CSV файла
 */
export const parseCsvFile = (csvText) => {
    if (!csvText || typeof csvText !== 'string') return [];
    const lines = csvText.split(/\r?\n/).slice(1);

    return lines.map(line => {
        if (!line.trim()) return null;
        const delimiter = line.includes(';') ? ';' : ',';
        const clean = line.split(delimiter).map(col => col.replace(/"/g, '').trim());
        if (clean.length < 10) return null;

        const payee = (clean[2] || '').toLowerCase();
        const outcomeAcc = (clean[4] || '').toLowerCase();
        const incomeAcc = (clean[7] || '').toLowerCase();

        const isHanna = payee.includes('ганна');
        const isDebt = outcomeAcc.includes('долг') || incomeAcc.includes('долг');

        if (!isHanna || !isDebt) return null;

        return {
            date: clean[0],
            categoryName: clean[1] || '',
            payee: clean[2] || '',
            comment: clean[3] || '',
            outcomeAccountName: clean[4] || '',
            outcome: parseFloat(clean[5]) || 0,
            outcomeCurrency: clean[6] || 'UAH',
            incomeAccountName: clean[7] || '',
            income: parseFloat(clean[8]) || 0,
            incomeCurrency: clean[9] || 'UAH',
            createdDate: clean[10] || new Date().toISOString(),
            rawLine: line
        };
    }).filter(Boolean);
};

/**
 * Комплексный расчет финансовой статистики и предиктивных метрик
 */
export const calculateDebtStats = ({
    data = [],
    safetyLimit = 50000,
    payoffTargetDate = '',
    extraPayment = 0,
    monthlyIncome = 30000,
    inflationRate = 15,
    exchangeRates = { usd: 41.5, eur: 44.8 }
}) => {
    if (!data || data.length === 0) {
        return {
            currentDebt: 0, totalGiven: 0, totalReceived: 0, returnRate: '0.0',
            avgLoanAmount: 0, loansPerMonth: '0.0', currentMonthGiven: 0, lastWeekGiven: 0, avgMonthlyGiven: 0,
            topCategories: [], monthlyStats: [], weeklyStats: [],
            debtTrend: 'stable', projectedPayoff: null, isOverLimit: false,
            weekdayStats: [], loanSizeStats: [], daysOfMonthData: [], cumulativeData: [], forecastData: [],
            simulatorData: [], _monthlyReceivedRate: 0, _netMonthlyChange: 0,
            benchmarks: { monthlyChange: 0, intervalChange: 0 },
            badHabits: { total: 0, potentialSavings: 0 }, achievements: [], plannedPayments: [],
            inflationProfit: 0, stressScore: 0, joyBudget: 0, anomalies: [],
            strategies: { snowball: [], avalanche: [] },
            intervals: { avg: 0, trend: 'stable' }, burndown: [], safetyLimit,
            debtAgeDays: 0, liberty: { percentage: '0.0', value: 0 },
            opportunityCost: 0, reliabilityRanking: [], staleLoans: [],
            realValue: { nominal: 0, real: 0, gain: 0, percent: '0.0' },
            currency: { usd: 0, eur: 0, rates: exchangeRates, hedgeGain: 0 }
        };
    }

    const loans = data.filter(t => t.type === 'Дано в долг');
    const returns = data.filter(t => t.type === 'Возврат');
    const totalGiven = roundMoney(loans.reduce((sum, t) => sum + t.amount, 0));
    const totalReceived = roundMoney(returns.reduce((sum, t) => sum + t.amount, 0));
    const currentDebt = roundMoney(totalGiven - totalReceived);

    const avgLoanAmount = loans.length > 0 ? roundMoney(totalGiven / loans.length) : 0;

    // Срок в месяцах
    const firstLoan = loans[loans.length - 1];
    const lastLoan = loans[0];
    const monthsDiff = firstLoan && lastLoan ?
        Math.max(1, Math.ceil((lastLoan.sortDate - firstLoan.sortDate) / (1000 * 60 * 60 * 24 * 30))) : 1;

    const loansPerMonth = (loans.length / monthsDiff).toFixed(1);
    const avgMonthlyGiven = roundMoney(totalGiven / monthsDiff);

    const now = new Date();
    const currentMonthGiven = roundMoney(loans
        .filter(t => t.sortDate.getFullYear() === now.getFullYear() && t.sortDate.getMonth() === now.getMonth())
        .reduce((sum, t) => sum + t.amount, 0));

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const lastWeekGiven = roundMoney(loans
        .filter(t => t.sortDate >= weekAgo)
        .reduce((sum, t) => sum + t.amount, 0));

    // Топ категорий
    const categoryMap = {};
    const weekdayMap = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    const loanSizeBuckets = {
        small: { amount: 0, count: 0 },
        medium: { amount: 0, count: 0 },
        large: { amount: 0, count: 0 }
    };
    const daysOfMonthMap = Array(31).fill(0).reduce((acc, _, i) => ({ ...acc, [i + 1]: 0 }), {});

    loans.forEach(t => {
        const comment = (t.comment || '').toLowerCase();
        let category = 'Прочее';
        if (comment.includes('еда') || comment.includes('пиво') || comment.includes('пузат') || comment.includes('кафе')) category = 'Еда и напитки';
        else if (comment.includes('сигарет') || comment.includes('табак') || comment.includes('вейп')) category = 'Вредные привычки';
        else if (comment.includes('книг') || comment.includes('ленточ') || comment.includes('канц')) category = 'Канцелярия';
        else if (comment.includes('поповн') || comment.includes('пополн') || comment.includes('связь')) category = 'Пополнение счета';
        else if (comment.includes('такси') || comment.includes('проезд') || comment.includes('билет')) category = 'Транспорт';

        categoryMap[category] = roundMoney((categoryMap[category] || 0) + t.amount);

        const day = t.sortDate.getDay();
        weekdayMap[day] = roundMoney(weekdayMap[day] + t.amount);

        if (t.amount < 500) {
            loanSizeBuckets.small.amount = roundMoney(loanSizeBuckets.small.amount + t.amount);
            loanSizeBuckets.small.count++;
        } else if (t.amount <= 2000) {
            loanSizeBuckets.medium.amount = roundMoney(loanSizeBuckets.medium.amount + t.amount);
            loanSizeBuckets.medium.count++;
        } else {
            loanSizeBuckets.large.amount = roundMoney(loanSizeBuckets.large.amount + t.amount);
            loanSizeBuckets.large.count++;
        }

        const date = t.sortDate.getDate();
        if (date >= 1 && date <= 31) {
            daysOfMonthMap[date]++;
        }
    });

    const topCategories = Object.entries(categoryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({
            name,
            amount,
            percentage: totalGiven > 0 ? ((amount / totalGiven) * 100).toFixed(1) : '0.0'
        }));

    // Кумулятивные данные для графика
    const sortedAll = [...data].sort((a, b) => a.sortDate - b.sortDate);
    let cumGiven = 0;
    let cumReceived = 0;
    const cumulativeData = sortedAll.map(t => {
        if (t.type === 'Дано в долг') cumGiven = roundMoney(cumGiven + t.amount);
        else cumReceived = roundMoney(cumReceived + t.amount);
        return {
            date: t.sortDate,
            given: cumGiven,
            received: cumReceived,
            debt: roundMoney(cumGiven - cumReceived)
        };
    });

    // Прогноз активности на базе 60 дней
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const recentLoans = loans.filter(t => t.sortDate >= sixtyDaysAgo);
    const recentReturns = returns.filter(t => t.sortDate >= sixtyDaysAgo);

    const recentGiven = recentLoans.reduce((s, t) => s + t.amount, 0);
    const recentReceived = recentReturns.reduce((s, t) => s + t.amount, 0);
    const monthlyGivenRate = roundMoney(recentGiven / 2);
    const monthlyReceivedRate = roundMoney(recentReceived / 2);
    const netMonthlyChange = roundMoney(monthlyGivenRate - monthlyReceivedRate);

    const forecastData = [];
    if (recentLoans.length > 0 || recentReturns.length > 0) {
        const currentDebtNow = data.length > 0 ? data[0].currentDebt : 0;
        for (let i = 1; i <= 6; i++) {
            const fDate = new Date();
            fDate.setMonth(fDate.getMonth() + i);
            forecastData.push({
                date: fDate,
                debt: Math.max(0, roundMoney(currentDebtNow + netMonthlyChange * i)),
                isForecast: true
            });
        }
    }

    // Месячная группировка
    const monthlyMap = {};
    data.forEach(t => {
        const monthKey = t.sortDate.toISOString().slice(0, 7);
        if (!monthlyMap[monthKey]) {
            monthlyMap[monthKey] = { given: 0, received: 0, loans: 0, returns: 0 };
        }
        if (t.type === 'Дано в долг') {
            monthlyMap[monthKey].given = roundMoney(monthlyMap[monthKey].given + t.amount);
            monthlyMap[monthKey].loans++;
        } else {
            monthlyMap[monthKey].received = roundMoney(monthlyMap[monthKey].received + t.amount);
            monthlyMap[monthKey].returns++;
        }
    });

    const monthlyStats = Object.entries(monthlyMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, stats]) => ({
            month,
            ...stats,
            net: roundMoney(stats.given - stats.received)
        }));

    // Недельная группировка
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
            weeklyMap[weekKey].given = roundMoney(weeklyMap[weekKey].given + t.amount);
            weeklyMap[weekKey].loans++;
        } else {
            weeklyMap[weekKey].received = roundMoney(weeklyMap[weekKey].received + t.amount);
            weeklyMap[weekKey].returns++;
        }
    });

    const weeklyStats = Object.entries(weeklyMap)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([week, stats]) => ({
            week,
            ...stats,
            net: roundMoney(stats.given - stats.received)
        }));

    // Тренд долга
    const recentMonths = monthlyStats.slice(0, 3);
    let debtTrend = 'stable';
    if (recentMonths.length >= 2) {
        const trend = recentMonths[0].net - recentMonths[1].net;
        debtTrend = trend > 500 ? 'growing' : trend < -500 ? 'decreasing' : 'stable';
    }

    // Прогноз срока погашения
    const avgReturnPerMonth = returns.length > 0 ? totalReceived / monthsDiff : 0;
    const projectedPayoff = avgReturnPerMonth > 0
        ? Math.max(0, Math.ceil(currentDebt / avgReturnPerMonth))
        : null;

    // Интервалы между займами
    const intervals = [];
    for (let i = 0; i < loans.length - 1; i++) {
        const diff = (loans[i].sortDate - loans[i + 1].sortDate) / (1000 * 60 * 60 * 24);
        intervals.push(diff);
    }
    const avgInterval = intervals.length > 0 ? (intervals.reduce((a, b) => a + b, 0) / intervals.length).toFixed(1) : 0;
    const recentIntervals = intervals.slice(0, 5);
    const prevIntervals = intervals.slice(5, 10);
    const intervalTrend = recentIntervals.length > 0 && prevIntervals.length > 0 ?
        (recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length < prevIntervals.reduce((a, b) => a + b, 0) / prevIntervals.length ? 'decreasing' : 'increasing') : 'stable';

    // Burndown график к целевой дате
    const burndown = [];
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
                debt: Math.max(0, roundMoney(startDebt - (startDebt / 10) * i))
            });
        }
    }

    const isOverLimit = currentDebt > safetyLimit;

    // Симулятор доплаты
    const simulatorData = [];
    if (extraPayment > 0) {
        const totalMonthlyReturn = monthlyReceivedRate + extraPayment;
        if (totalMonthlyReturn > 0) {
            for (let i = 0; i <= 36; i++) {
                const remaining = roundMoney(currentDebt - totalMonthlyReturn * i);
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

    // Сравнение бенчмарков
    const benchmarks = {
        monthlyChange: 0,
        intervalChange: 0
    };
    if (monthlyStats.length >= 2 && monthlyStats[1].given > 0) {
        benchmarks.monthlyChange = (((monthlyStats[0].given / monthlyStats[1].given) - 1) * 100).toFixed(1);
    }
    if (recentIntervals.length > 0 && prevIntervals.length > 0) {
        const currentAvg = recentIntervals.reduce((a, b) => a + b, 0) / recentIntervals.length;
        const prevAvg = prevIntervals.reduce((a, b) => a + b, 0) / prevIntervals.length;
        benchmarks.intervalChange = (currentAvg - prevAvg).toFixed(1);
    }

    // Вредные привычки
    const badHabitsTotal = categoryMap['Вредные привычки'] || 0;
    const potentialSavings = roundMoney(badHabitsTotal * 0.5);

    // Достижения
    const achievements = [];
    const daysSinceLastLoan = lastLoan ? Math.floor((new Date() - lastLoan.sortDate) / (1000 * 60 * 60 * 24)) : 999;
    if (daysSinceLastLoan >= 7) {
        achievements.push({
            id: 'discipline',
            icon: '🏆',
            title: 'Железная дисциплина',
            desc: `${daysSinceLastLoan} дн. без новых займов`
        });
    }
    if (totalReceived > 0 && totalGiven > 0 && (totalReceived / totalGiven) >= 0.5) {
        achievements.push({
            id: 'halfway',
            icon: '⚡',
            title: 'Экватор возвратов',
            desc: `Возвращено более 50% от всех выданных средств!`
        });
    }

    // Анализ обещаний в комментариях
    const plannedPayments = data.filter(t => t.comment && t.comment.match(/\d{2}\.\d{2}/)).map(t => {
        const dateMatch = t.comment.match(/\d{2}\.\d{2}/);
        return {
            id: t.id || `${t.formattedDate}-${t.amount}`,
            date: dateMatch ? dateMatch[0] : '',
            amount: t.amount,
            comment: t.comment,
            type: t.type
        };
    }).slice(0, 5);

    // Учет инфляции и реальная покупательная способность
    const monthlyInflation = (inflationRate || 0) / 100 / 12;
    const realDebtValue = roundMoney(currentDebt / Math.pow(1 + monthlyInflation, monthsDiff));
    const inflationProfit = Math.max(0, roundMoney(currentDebt - realDebtValue));
    const inflationGainPercent = currentDebt > 0 ? ((inflationProfit / currentDebt) * 100).toFixed(1) : '0.0';

    // Индекс стресса (0-100)
    const debtToIncomeRatio = monthlyIncome > 0 ? (currentDebt / monthlyIncome) : 0;
    const stressScore = Math.min(100, Math.ceil(
        (debtToIncomeRatio * 20) +
        (debtTrend === 'growing' ? 30 : 0) +
        (isOverLimit ? 20 : 0)
    ));

    // Бюджет на радости
    const monthlyRest = Math.max(0, monthlyIncome - avgMonthlyGiven);
    const joyBudget = roundMoney((monthlyRest * 0.1) / 30);

    // Детектор всплесков (аномалий)
    const anomalies = [];
    const weekdayCounts = Object.values(weekdayMap);
    const avgWeekdayAmount = weekdayCounts.reduce((a, b) => a + b, 0) / 7;
    Object.entries(weekdayMap).forEach(([day, amt]) => {
        if (avgWeekdayAmount > 0 && amt > avgWeekdayAmount * 1.5) {
            const daysNames = ['воскресенье', 'понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу'];
            anomalies.push({
                type: 'day_spike',
                msg: `Всплеск трат в ${daysNames[day]}. В ${(amt / avgWeekdayAmount).toFixed(1)} раза выше обычного.`
            });
        }
    });

    // Снежный ком и лавина
    const entities = {};
    loans.forEach(l => {
        const name = (l.comment || '').split(' ')[0] || 'Unknown';
        entities[name] = roundMoney((entities[name] || 0) + l.amount);
    });
    const snowball = Object.entries(entities).sort((a, b) => a[1] - b[1]);
    const avalanche = Object.entries(entities).sort((a, b) => b[1] - a[1]);

    // Стаж долгов
    const oldestLoan = loans.length > 0 ? loans[loans.length - 1] : null;
    const debtAgeDays = oldestLoan ? Math.floor((new Date() - oldestLoan.sortDate) / (1000 * 60 * 60 * 24)) : 0;

    // Степень финансовой свободы
    const recentRepayments = recentMonths.reduce((sum, m) => sum + m.received, 0) / (recentMonths.length || 1);
    const libertyPercentage = monthlyIncome > 0 ? ((recentRepayments / monthlyIncome) * 100).toFixed(1) : '0.0';
    const libertyValue = roundMoney(recentRepayments);

    // Упущенная выгода (под 15% годовых при альтернативном депозите)
    const opportunityCost = roundMoney(currentDebt * 0.15 * (monthsDiff / 12));

    // Рейтинг надежности (Trust Score)
    const debtorStats = {};
    data.forEach(t => {
        const name = (t.comment || '').split(' ')[0] || 'Основной';
        if (!debtorStats[name]) {
            debtorStats[name] = { given: 0, received: 0, count: 0, lastActivity: t.sortDate };
        }
        if (t.type === 'Дано в долг') debtorStats[name].given = roundMoney(debtorStats[name].given + t.amount);
        else debtorStats[name].received = roundMoney(debtorStats[name].received + t.amount);
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

    // Зависшие долги без возврата >60 дней
    const staleLoans = reliabilityRanking
        .filter(d => d.lastActivity > 60 && d.score < 100)
        .slice(0, 5);

    // Валютные расчеты
    const rateUsd = exchangeRates.usd || 41.5;
    const rateEur = exchangeRates.eur || 44.8;
    const debtUsd = roundMoney(currentDebt / rateUsd);
    const debtEur = roundMoney(currentDebt / rateEur);
    const hedgeGain = roundMoney((currentDebt / 40.0) - debtUsd);

    return {
        currentDebt,
        totalGiven,
        totalReceived,
        returnRate: totalGiven > 0 ? ((totalReceived / totalGiven) * 100).toFixed(1) : '0.0',
        avgLoanAmount,
        loansPerMonth,
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
            usd: debtUsd,
            eur: debtEur,
            rates: exchangeRates,
            hedgeGain
        }
    };
};
