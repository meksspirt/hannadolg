import React, { useState, useEffect, useMemo } from 'react';
import {
    Upload,
    Search,
    Sun,
    Moon,
    ArrowUpRight,
    ArrowDownLeft
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { format } from 'date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
);

const App = () => {
    const formatAmount = (num) => {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num).replace(',', '.');
    };

    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
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
            const res = await fetch('/api/get-transactions');
            if (res.ok) {
                const result = await res.json();
                setData(processTransactions(result, true));
            } else {
                const err = await res.json();
                console.error('API Error:', err);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const processTransactions = (raw, isDbData) => {
        let currentDebt = 0;
        return raw.map(t => {
            const income = parseFloat(t.income) || 0;
            const outcome = parseFloat(t.outcome) || 0;
            const amount = income > 0 ? income : outcome;
            const type = income > 0 ? 'Возврат' : 'Дано в долг';

            if (income > 0) currentDebt -= income;
            else currentDebt += outcome;

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
                const res = await fetch('/api/add-transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed)
                });
                if (res.ok) {
                    alert('Данные синхронизированы!');
                    fetchData();
                } else {
                    const err = await res.json();
                    alert('Ошибка сервера: ' + err.error);
                }
            } catch (e) {
                alert('Ошибка сети');
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const stats = useMemo(() => {
        if (data.length === 0) return { currentDebt: 0, totalGiven: 0, totalReceived: 0, returnRate: 0 };
        const totalGiven = data.filter(t => t.type === 'Дано в долг').reduce((sum, t) => sum + t.amount, 0);
        const totalReceived = data.filter(t => t.type === 'Возврат').reduce((sum, t) => sum + t.amount, 0);
        return {
            currentDebt: totalGiven - totalReceived,
            totalGiven,
            totalReceived,
            returnRate: totalGiven > 0 ? ((totalReceived / totalGiven) * 100).toFixed(1) : 0
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

    const chartData = {
        labels: [...data].reverse().map(d => d.sortDate),
        datasets: [{
            label: 'Долг',
            data: [...data].reverse().map(d => d.currentDebt),
            borderColor: '#60a5fa',
            backgroundColor: 'rgba(96, 165, 250, 0.1)',
            fill: true,
            tension: 0.2,
            pointRadius: 3
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { type: 'time', time: { unit: 'month' }, grid: { display: false }, ticks: { color: '#94a3b8' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        },
        plugins: { legend: { display: false } }
    };

    return (
        <div className="container">
            <header className="main-header">
                <div>
                    <h1>Анализатор долгов</h1>
                    <p className="subtitle">Учет транзакций Ганны Є.</p>
                </div>
                <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </header>

            <div className="stats-grid">
                <div className="card stat-card danger">
                    <span className="label">Текущий долг</span>
                    <span className="value">{formatAmount(stats.currentDebt)} ₴</span>
                </div>
                <div className="card stat-card success">
                    <span className="label">Вернула всего</span>
                    <span className="value">{formatAmount(stats.totalReceived)} ₴</span>
                </div>
                <div className="card stat-card">
                    <span className="label">Процент возврата</span>
                    <span className="value">{stats.returnRate}%</span>
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
                <label htmlFor="file" className="upload-btn">
                    <Upload size={20} />
                    {uploading ? 'Загрузка...' : 'Выбрать CSV таблицу'}
                </label>
            </div>

            <div className="card chart-card">
                <h3>Динамика долга</h3>
                <div className="chart-box">
                    {data.length > 0 && <Line data={chartData} options={chartOptions} />}
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
