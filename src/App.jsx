import React, { useState, useEffect, useMemo } from 'react';
import {
    Upload,
    Sun,
    Moon,
    Wifi,
    WifiOff,
    LayoutDashboard,
    LineChart,
    TableProperties
} from 'lucide-react';
import { ParentSize } from '@visx/responsive';
import DebtChart from './DebtChart';
import FinancialAdvice from './FinancialAdvice';
import StatsOverviewGrid from './components/analytics/StatsOverviewGrid';
import RepaymentPlanCard from './components/analytics/RepaymentPlanCard';
import DeepInsightsView from './components/analytics/DeepInsightsView';
import TransactionManager from './components/transactions/TransactionManager';
import {
    processTransactions,
    calculateDebtStats,
    parseCsvFile,
    formatAmount
} from './utils/debt-analytics';

const App = () => {
    // Навигация верхнего уровня
    const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'insights', 'transactions'

    // Настройки графика и визуализации
    const [chartMode, setChartMode] = useState('debt'); // 'debt' or 'flow'
    const [chartPeriod, setChartPeriod] = useState('all'); // '1d','1m','6m','ytd','1y','all'
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

    // Финансовые параметры пользователя
    const [safetyLimit, setSafetyLimit] = useState(() => Number(localStorage.getItem('safetyLimit')) || 50000);
    const [payoffTargetDate, setPayoffTargetDate] = useState(() => localStorage.getItem('payoffTargetDate') || '');
    const [extraPayment, setExtraPayment] = useState(0);
    const [monthlyIncome, setMonthlyIncome] = useState(() => Number(localStorage.getItem('monthlyIncome')) || 30000);
    const [inflationRate, setInflationRate] = useState(() => Number(localStorage.getItem('inflationRate')) || 15);

    // Данные и состояние сети
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [exchangeRates, setExchangeRates] = useState({ usd: 41.5, eur: 44.8 });
    const [isOnline, setIsOnline] = useState(true);

    // Применение темы
    useEffect(() => {
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Начальная загрузка
    useEffect(() => {
        fetchData();
        fetchRates();
    }, []);

    const fetchRates = async () => {
        try {
            const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
            if (res.ok) {
                const nbuData = await res.json();
                const usd = nbuData.find(c => c.cc === 'USD')?.rate || 41.5;
                const eur = nbuData.find(c => c.cc === 'EUR')?.rate || 44.8;
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
                const processed = processTransactions(result);
                setData(processed);
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

    const uploadTransactions = async (transactions) => {
        if (!Array.isArray(transactions) || transactions.length === 0) {
            alert('Транзакций Ганны не обнаружено в загруженном файле.');
            return;
        }

        setUploading(true);
        try {
            const res = await fetch('/api/add-transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactions)
            });

            if (!res.ok) throw new Error('Server error');

            const result = await res.json();
            alert(result.message || 'Данные синхронизированы!');
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
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result;
            const parsed = parseCsvFile(text);
            await uploadTransactions(parsed);
        };
        reader.readAsText(file, 'UTF-8');
        e.target.value = '';
    };

    // Вычисление расширенной аналитики через вынесенный модуль
    const stats = useMemo(() => {
        return calculateDebtStats({
            data,
            safetyLimit,
            payoffTargetDate,
            extraPayment,
            monthlyIncome,
            inflationRate,
            exchangeRates
        });
    }, [data, safetyLimit, payoffTargetDate, extraPayment, monthlyIncome, inflationRate, exchangeRates]);

    // Подготовка данных графика долга
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
        <div className="container">
            {/* Главный заголовок */}
            <header className="main-header">
                <div>
                    <h1>DebtSense Analytics</h1>
                    <p className="subtitle">
                        Учет и поведенческий анализ займов Ганны Є.
                        <span className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
                            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                            {isOnline ? 'Онлайн' : 'Локально'}
                        </span>
                    </p>
                </div>
                <button
                    className="theme-toggle"
                    aria-label="Переключить тему"
                    onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </header>

            {/* Навигационные вкладки верхнего уровня */}
            <nav className="nav-tabs-bar">
                <button
                    className={`nav-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    <LayoutDashboard size={18} />
                    <span>Обзор</span>
                </button>
                <button
                    className={`nav-tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
                    onClick={() => setActiveTab('insights')}
                >
                    <LineChart size={18} />
                    <span>Глубокая аналитика</span>
                </button>
                <button
                    className={`nav-tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transactions')}
                >
                    <TableProperties size={18} />
                    <span>Реестр транзакций</span>
                </button>
            </nav>

            {/* Вкладка 1: Главный дашборд */}
            {activeTab === 'dashboard' && (
                <>
                    <FinancialAdvice stats={stats} />

                    {/* Достижения */}
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

                    {/* План погашения */}
                    <RepaymentPlanCard stats={stats} payoffTargetDate={payoffTargetDate} />

                    {/* Сетка ключевых KPI */}
                    <StatsOverviewGrid stats={stats} />

                    {/* Загрузка данных */}
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
                                {uploading ? 'Загрузка...' : 'Выбрать CSV выписку'}
                            </label>
                            {!isOnline && (
                                <button className="retry-btn" onClick={fetchData} disabled={loading}>
                                    <Wifi size={16} />
                                    {loading ? 'Подключение...' : 'Повторить подключение'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* График динамики долга */}
                    <div className="card chart-card">
                        <div className="card-header-actions">
                            <h3>{chartMode === 'debt' ? 'Динамика долга и прогноз' : 'Накопительные потоки (Flow)'}</h3>
                            <div className="header-tabs">
                                <button className={chartMode === 'debt' ? 'active' : ''} onClick={() => setChartMode('debt')}>Тренд</button>
                                <button className={chartMode === 'flow' ? 'active' : ''} onClick={() => setChartMode('flow')}>Поток</button>
                            </div>
                        </div>

                        <div className="period-tabs">
                            {[
                                { key: '1d', label: 'День' },
                                { key: '1m', label: 'Месяц' },
                                { key: '6m', label: '6 мес' },
                                { key: 'ytd', label: 'С 1 янв' },
                                { key: '1y', label: 'Год' },
                                { key: 'all', label: 'Всё' },
                            ].map(p => (
                                <button
                                    key={p.key}
                                    className={chartPeriod === p.key ? 'active' : ''}
                                    onClick={() => setChartPeriod(p.key)}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <div className="chart-box">
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

                        <div className="chart-footer">
                            {/* Легенда */}
                            {chartMode === 'debt' && (
                                <div className="chart-legend">
                                    <span className="legend-item">
                                        <span className="legend-line solid blue"></span> Долг
                                    </span>
                                    <span className="legend-item">
                                        <span className="legend-line dashed blue"></span> Прогноз (60 дн)
                                    </span>
                                    {stats.burndown.length > 0 && (
                                        <span className="legend-item">
                                            <span className="legend-line dashed orange"></span> Цель погашения
                                        </span>
                                    )}
                                    {extraPayment > 0 && (
                                        <span className="legend-item">
                                            <span className="legend-line dashed green"></span> Ускоренный план
                                        </span>
                                    )}
                                    <span className="legend-item">
                                        <span className="legend-line dashed red"></span> Лимит
                                    </span>
                                </div>
                            )}

                            {/* Настройки параметров */}
                            <div className="chart-settings">
                                <div className="settings-group">
                                    <span className="settings-group-label">Параметры аналитики</span>
                                    <div className="setting-item">
                                        <label title="Порог долга — при превышении карточка предупреждает">⚠️ Лимит долга, ₴</label>
                                        <input
                                            type="number"
                                            value={safetyLimit}
                                            min="0"
                                            step="1000"
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setSafetyLimit(val);
                                                localStorage.setItem('safetyLimit', e.target.value);
                                            }}
                                        />
                                    </div>
                                    <div className="setting-item">
                                        <label title="Используется для расчёта стресса и бюджета">💰 Месячный доход, ₴</label>
                                        <input
                                            type="number"
                                            value={monthlyIncome}
                                            min="0"
                                            step="1000"
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setMonthlyIncome(val);
                                                localStorage.setItem('monthlyIncome', e.target.value);
                                            }}
                                        />
                                    </div>
                                    <div className="setting-item">
                                        <label title="Годовая инфляция для расчета реальной стоимости долга">📈 Инфляция, % год.</label>
                                        <input
                                            type="number"
                                            value={inflationRate}
                                            min="0"
                                            max="100"
                                            step="1"
                                            onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setInflationRate(val);
                                                localStorage.setItem('inflationRate', e.target.value);
                                            }}
                                        />
                                    </div>
                                </div>

                                {chartMode === 'debt' && (
                                    <div className="settings-group">
                                        <span className="settings-group-label">Цель погашения</span>
                                        <div className="setting-item">
                                            <label title="План погашения к этой дате">🎯 Дата цели</label>
                                            <input
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
                                                <div className="burndown-info">
                                                    <span>⏳ {daysLeft} дн. ({monthsLeft} мес.)</span>
                                                    <span>Нужно возвращать: <strong>{requiredMonthly} ₴/мес</strong></span>
                                                </div>
                                            );
                                        })()}
                                        {payoffTargetDate && (
                                            <button
                                                className="clear-date-btn"
                                                onClick={() => {
                                                    setPayoffTargetDate('');
                                                    localStorage.removeItem('payoffTargetDate');
                                                }}
                                            >
                                                ✕ Сбросить дату
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Симулятор доплаты */}
                            {chartMode === 'debt' && (
                                <div className="simulator-control">
                                    <div className="simulator-header">
                                        <label>🚀 Симулятор ускоренного возврата</label>
                                        <span className="simulator-value">
                                            {extraPayment > 0 ? `+${formatAmount(extraPayment)} ₴/мес` : 'выкл.'}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10000"
                                        step="500"
                                        value={extraPayment}
                                        onChange={(e) => setExtraPayment(Number(e.target.value))}
                                    />
                                    <div className="simulator-ticks">
                                        <span>0</span><span>2 500</span><span>5 000</span><span>7 500</span><span>10 000</span>
                                    </div>
                                    <div className="simulator-base-hint">
                                        База возврата (60 дн): <strong>{formatAmount(stats._monthlyReceivedRate || 0)} ₴/мес</strong>
                                        {extraPayment > 0 && (
                                            <> → итого: <strong style={{ color: '#10b981' }}>{formatAmount((stats._monthlyReceivedRate || 0) + extraPayment)} ₴/мес</strong></>
                                        )}
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
                                            <div className="simulator-result">
                                                {monthsToZero > 0
                                                    ? <span>✅ Долг обнулится через <strong>{monthsToZero} мес.</strong></span>
                                                    : <span>📉 Через {simMonths} мес. остаток: <strong>{formatAmount(lastPoint.debt)} ₴</strong></span>
                                                }
                                                {monthsSaved > 0 && (
                                                    <span style={{ display: 'block', marginTop: '4px', color: '#10b981' }}>
                                                        💡 Быстрее на <strong>{monthsSaved} мес.</strong> чем при текущем темпе
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Вкладка 2: Глубокая аналитика */}
            {activeTab === 'insights' && (
                <DeepInsightsView stats={stats} theme={theme} />
            )}

            {/* Вкладка 3: Реестр транзакций и сводка */}
            {activeTab === 'transactions' && (
                <TransactionManager data={data} stats={stats} />
            )}
        </div>
    );
};

export default App;
