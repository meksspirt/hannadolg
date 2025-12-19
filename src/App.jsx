import React, { useState, useEffect, useMemo } from 'react';
import {
    Sun, Moon, Upload, History, TrendingUp,
    BarChart3, LifeBuoy, FileSpreadsheet, Search,
    ChevronLeft, ChevronRight, ArrowUpDown
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title as ChartTitle,
    Tooltip,
    Legend,
    TimeScale,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Регистрация ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ChartTitle,
    Tooltip,
    Legend,
    TimeScale,
    Filler
);

const App = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Состояние таблицы
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Инициализация темы
    useEffect(() => {
        document.body.className = `${theme}-theme`;
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Загрузка из БД при старте
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/get-transactions');
            if (res.ok) {
                const dbData = await res.json();
                const processed = processTransactions(dbData, true);
                setData(processed);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const processTransactions = (transactions, isFromDb) => {
        // Сортировка по дате создания для расчета бегущего итога
        const sorted = [...transactions].sort((a, b) => {
            const dateA = new Date(isFromDb ? a.created_date : a.createdDate);
            const dateB = new Date(isFromDb ? b.created_date : b.createdDate);
            return dateA - dateB;
        });

        let runningDebt = 0;
        const targetName = "Ганна Є.";
        const debtCategory = "Долги";

        return sorted.map(row => {
            const incomeAcc = isFromDb ? row.income_account_name : row.incomeAccountName;
            const outcomeAcc = isFromDb ? row.outcome_account_name : row.outcomeAccountName;
            const incomeVal = parseFloat(isFromDb ? row.income : row.income) || 0;
            const outcomeVal = parseFloat(isFromDb ? row.outcome : row.outcome) || 0;

            let type = '';
            let amount = 0;

            if (incomeAcc.includes(debtCategory) && outcomeVal > 0) {
                runningDebt += outcomeVal;
                type = 'Дано в долг';
                amount = outcomeVal;
            } else if (outcomeAcc.includes(debtCategory) && incomeVal > 0) {
                runningDebt -= incomeVal;
                type = 'Возврат долга';
                amount = incomeVal;
            }

            if (!type) return null;

            return {
                ...row,
                type,
                amount,
                currentDebt: runningDebt,
                formattedDate: new Date(isFromDb ? row.date : row.date).toLocaleDateString('ru-RU'),
                sortDate: new Date(isFromDb ? row.created_date : row.createdDate)
            };
        }).filter(Boolean);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const parsed = parseCsvLocal(text);
            if (parsed.length === 0) {
                alert('Транзакций для "Ганна Є." не обнаружено.');
                return;
            }

            setUploading(true);
            try {
                const res = await fetch('/api/add-transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed)
                });
                if (res.ok) {
                    alert('Данные синхронизированы!');
                    fetchData();
                }
            } catch (e) {
                alert('Ошибка при сохранении, показываем локально');
                setData(processTransactions(parsed, false));
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const parseCsvLocal = (csvText) => {
        const lines = csvText.split('\n').slice(1);
        const targetName = "Ганна Є.";
        const debtCategory = "Долги";

        return lines.map(line => {
            if (!line.trim()) return null;
            const columns = line.split(';');
            const clean = columns.map(col => col.replace(/"/g, '').trim());
            if (clean.length < 12) return null;

            const payee = clean[2];
            const incomeAcc = clean[7];
            const outcomeAcc = clean[4];

            if (payee.includes(targetName) && (incomeAcc.includes(debtCategory) || outcomeAcc.includes(debtCategory))) {
                return {
                    date: clean[0],
                    categoryName: clean[1],
                    payee: payee,
                    comment: clean[3],
                    outcomeAccountName: outcomeAcc,
                    outcome: parseFloat(clean[5]) || 0,
                    incomeAccountName: incomeAcc,
                    income: parseFloat(clean[8]) || 0,
                    createdDate: clean[10],
                    rawLine: line
                };
            }
            return null;
        }).filter(Boolean);
    };

    // Расчет статистики
    const stats = useMemo(() => {
        const totalGiven = data.reduce((acc, t) => t.type === 'Дано в долг' ? acc + t.amount : acc, 0);
        const totalReceived = data.reduce((acc, t) => t.type === 'Возврат долга' ? acc + t.amount : acc, 0);
        const currentDebt = data.length > 0 ? data[data.length - 1].currentDebt : 0;
        const returnRate = totalGiven > 0 ? ((totalReceived / totalGiven) * 100).toFixed(1) : 0;

        return { totalGiven, totalReceived, currentDebt, returnRate };
    }, [data]);

    // Фильтрация и сортировка для таблицы
    const filteredData = useMemo(() => {
        let result = data.filter(t => {
            const matchesSearch = t.comment?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' ||
                (filter === 'given' && t.type === 'Дано в долг') ||
                (filter === 'received' && t.type === 'Возврат долга');
            return matchesSearch && matchesFilter;
        });

        result.sort((a, b) => {
            return sortOrder === 'desc' ? b.sortDate - a.sortDate : a.sortDate - b.sortDate;
        });

        return result;
    }, [data, searchQuery, filter, sortOrder]);

    // Данные для графика
    const chartData = {
        labels: data.map(t => t.sortDate),
        datasets: [{
            label: 'Сумма долга',
            data: data.map(t => t.currentDebt),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#3b82f6'
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'time',
                time: { unit: 'month', displayFormats: { month: 'MMM yyyy' } },
                grid: { color: theme === 'dark' ? '#334155' : '#e2e8f0' },
                ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' }
            },
            y: {
                grid: { color: theme === 'dark' ? '#334155' : '#e2e8f0' },
                ticks: { color: theme === 'dark' ? '#94a3b8' : '#64748b' }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                titleColor: theme === 'dark' ? '#f1f5f9' : '#1e293b',
                bodyColor: theme === 'dark' ? '#f1f5f9' : '#1e293b'
            }
        }
    };

    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
    const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="container">
            <header>
                <div className="header-top">
                    <h1>Анализатор долгов <span style={{ fontSize: '1rem', color: 'var(--accent-color)' }}>React Edition</span></h1>
                    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="btn-icon">
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </button>
                </div>
                <p className="intro">Умная система учета долговых обязательств с использованием Supabase и React.</p>
            </header>

            <div className="stats-grid">
                <div className="upload-section card">
                    <div className="file-input-wrapper">
                        <input type="file" id="csvFileInput" accept=".csv" onChange={handleFileUpload} />
                        <label htmlFor="csvFileInput" className="btn-secondary">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <Upload size={18} /> {uploading ? 'Загрузка...' : 'Выбрать файл CSV'}
                            </div>
                        </label>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Файл будет автоматически синхронизирован с облаком
                    </p>
                </div>

                {data.length > 0 && (
                    <div className="card stats-summary">
                        <div className="stat-item">
                            <span className="stat-label">Текущий долг</span>
                            <span className="stat-value danger">{stats.currentDebt.toFixed(2)} ₴</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Вернула всего</span>
                            <span className="stat-value success">{stats.totalReceived.toFixed(2)} ₴</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Выдано всего</span>
                            <span className="stat-value">{stats.totalGiven.toFixed(2)} ₴</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Процент возврата</span>
                            <span className="stat-value">{stats.returnRate}%</span>
                        </div>
                    </div>
                )}
            </div>

            {data.length === 0 && !loading && (
                <div className="card text-center" style={{ padding: '3rem' }}>
                    <FileSpreadsheet size={64} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <h3>Нет данных для анализа</h3>
                    <p>Загрузите CSV файл из ZenMoney для начала работы.</p>
                </div>
            )}

            {data.length > 0 && (
                <div id="analytics-section">
                    <div className="grid-2-cols">
                        <div className="card analytics-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <TrendingUp size={20} className="accent-color" />
                                <h3 style={{ margin: 0 }}>Прогноз погашения</h3>
                            </div>
                            {stats.currentDebt > 0 ? (
                                <div>
                                    <p>При текущей динамике возвратов осталось примерно:</p>
                                    <div className="forecast-badge">
                                        {Math.ceil(stats.currentDebt / (stats.totalReceived / (data.filter(t => t.type === 'Возврат долга').length || 1)))} платежа(ей)
                                    </div>
                                </div>
                            ) : (
                                <p className="success-text">Долг полностью погашен! 🎉</p>
                            )}
                        </div>
                        <div className="card analytics-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                                <LifeBuoy size={20} className="accent-color" />
                                <h3 style={{ margin: 0 }}>Эффективность</h3>
                            </div>
                            <p>Дисциплина возвратов:</p>
                            <span className={`stat-value ${stats.returnRate > 70 ? 'success' : stats.returnRate > 40 ? 'accent' : 'danger'}`}>
                                {stats.returnRate > 70 ? 'Высокая' : stats.returnRate > 40 ? 'Средняя' : 'Низкая'}
                            </span>
                        </div>
                    </div>

                    <div className="card chart-card">
                        <div className="chart-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <BarChart3 size={20} className="accent-color" />
                                <h3 style={{ margin: 0 }}>Динамика долга</h3>
                            </div>
                        </div>
                        <div style={{ height: '300px' }}>
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>

                    <div className="card transactions-card">
                        <div className="transactions-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <History size={20} className="accent-color" />
                                <h3 style={{ margin: 0 }}>История операций</h3>
                            </div>
                            <div className="controls">
                                <div style={{ position: 'relative' }}>
                                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                                    <input
                                        type="text"
                                        placeholder="Поиск..."
                                        style={{ paddingLeft: '35px' }}
                                        value={searchQuery}
                                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                <div className="filter-buttons">
                                    <button onClick={() => { setFilter('all'); setCurrentPage(1); }} className={filter === 'all' ? 'active' : ''}>Все</button>
                                    <button onClick={() => { setFilter('given'); setCurrentPage(1); }} className={filter === 'given' ? 'active' : ''}>Выдано</button>
                                    <button onClick={() => { setFilter('received'); setCurrentPage(1); }} className={filter === 'received' ? 'active' : ''}>Возвраты</button>
                                </div>
                            </div>
                        </div>

                        <div id="transactions-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} style={{ cursor: 'pointer' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                Дата <ArrowUpDown size={14} />
                                            </div>
                                        </th>
                                        <th>Комментарий</th>
                                        <th>Тип</th>
                                        <th>Сумма</th>
                                        <th>Долг</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedData.map((t, i) => (
                                        <tr key={i}>
                                            <td>{t.formattedDate}</td>
                                            <td>{t.comment}</td>
                                            <td>
                                                <span className={`badge ${t.type === 'Дано в долг' ? 'danger' : 'success'}`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td>{t.amount.toFixed(2)}</td>
                                            <td><strong>{t.currentDebt.toFixed(2)}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {filteredData.length > itemsPerPage && (
                                <div className="pagination">
                                    <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft /></button>
                                    <span className="page-info">Страница {currentPage} из {totalPages}</span>
                                    <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight /></button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <footer>
                <p>&copy; 2024 Анализатор долгов Ганны. Построено на React + Supabase.</p>
            </footer>
        </div>
    );
};

export default App;
