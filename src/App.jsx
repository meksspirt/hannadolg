import React, { useState, useEffect, useMemo } from 'react';
import {
    Upload,
    Search,
    TrendingUp,
    CheckCircle2,
    Calendar,
    Sun,
    Moon
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
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

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
    // Форматирование чисел
    const formatAmount = (num) => {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num).replace(',', '.');
    };

    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
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
            const result = await res.json();
            if (res.ok) {
                setData(processTransactions(result, true));
            } else {
                alert('Ошибка: ' + (result.error || 'Не удалось загрузить данные'));
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
            const income = parseFloat(isDbData ? t.income : t.income) || 0;
            const outcome = parseFloat(isDbData ? t.outcome : t.outcome) || 0;
            const amount = income > 0 ? income : outcome;
            const type = income > 0 ? 'Возврат' : 'Дано в долг';

            if (type === 'Дано в долг') currentDebt += amount;
            else currentDebt -= amount;

            const dateStr = isDbData ? t.date : t.date;
            const sortDate = new Date(dateStr.split('.').reverse().join('-'));

            return {
                ...t,
                amount,
                type,
                currentDebt,
                sortDate,
                formattedDate: format(sortDate, 'dd.MM.yyyy'),
                date: sortDate // для графика
            };
        }).sort((a, b) => b.sortDate - a.sortDate);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const parsed = parseCsvLocal(text);
            if (parsed.length === 0) {
                alert('Транзакций не обнаружено. Проверьте формат файла.');
                return;
            }

            setUploading(true);
            try {
                const res = await fetch('/api/add-transactions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed)
                });
                const result = await res.json();
                if (res.ok) {
                    alert('Данные успешно сохранены!');
                    fetchData();
                } else {
                    alert('Ошибка: ' + result.error);
                }
            } catch (e) {
                console.error(e);
                alert('Ошибка сети или сервера');
            } finally {
                setUploading(false);
            }
        };
        reader.readAsText(file, 'UTF-8');
    };

    const parseCsvLocal = (csvText) => {
        const lines = csvText.split(/\r?\n/).slice(1);
        const targetName = "Ганна Є.";
        const debtCategory = "Долги";

        return lines.map(line => {
            if (!line.trim()) return null;
            const delimiter = line.includes(';') ? ';' : ',';
            const clean = line.split(delimiter).map(col => col.replace(/"/g, '').trim());
            if (clean.length < 12) return null;

            const payee = clean[2];
            const incomeAcc = clean[7];
            const outcomeAcc = clean[4];

            const matchesName = payee.toLowerCase().includes(targetName.toLowerCase());
            const matchesCategory = incomeAcc.includes(debtCategory) || outcomeAcc.includes(debtCategory);

            if (matchesName && matchesCategory) {
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

    const stats = useMemo(() => {
        if (data.length === 0) return { currentDebt: 0, totalGiven: 0, totalReceived: 0, returnRate: 0 };
        const latest = data[0];
        const totalGiven = data.filter(t => t.type === 'Дано в долг').reduce((sum, t) => sum + t.amount, 0);
        const totalReceived = data.filter(t => t.type === 'Возврат').reduce((sum, t) => sum + t.amount, 0);
        return {
            currentDebt: latest.currentDebt,
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
        labels: [...data].reverse().map(d => d.date),
        datasets: [{
            label: 'Долг',
            data: [...data].reverse().map(d => d.currentDebt),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.1, // Менее кривой график
            pointRadius: 2
        }]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { type: 'time', time: { unit: 'month' }, grid: { display: false } },
            y: { grid: { color: 'rgba(0,0,0,0.05)' } }
        }
    };

    return (
        <div className="container">
            <header>
                <h1>Анализатор долгов</h1>
                <button className="theme-toggle" onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}>
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </header>

            <div className="stats-grid">
                <div className="card stat-item">
                    <span className="stat-label">Текущий долг</span>
                    <span className="stat-value danger">{formatAmount(stats.currentDebt)} ₴</span>
                </div>
                <div className="card stat-item">
                    <span className="stat-label">Вернула всего</span>
                    <span className="stat-value success">{formatAmount(stats.totalReceived)} ₴</span>
                </div>
                <div className="card stat-item">
                    <span className="stat-label">Процент возврата</span>
                    <span className="stat-value">{stats.returnRate}%</span>
                </div>
            </div>

            <div className="card">
                <div className="upload-area">
                    <input type="file" id="csv-upload" onChange={handleFileUpload} style={{ display: 'none' }} accept=".csv" />
                    <label htmlFor="csv-upload" className="file-input-label">
                        <Upload size={20} />
                        {uploading ? 'Загрузка...' : 'Выбрать файл CSV'}
                    </label>
                    <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Файл будет автоматически синхронизирован</p>
                </div>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem' }}>Динамика долга</h3>
                <div className="chart-container">
                    {data.length > 0 ? <Line data={chartData} options={chartOptions} /> : <p>Нет данных для графика</p>}
                </div>
            </div>

            <div className="card">
                <div className="controls">
                    <div className="search-container">
                        <Search className="search-icon" size={18} />
                        <input
                            className="search-box"
                            placeholder="Поиск по комментариям..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="filter-group">
                        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Все</button>
                        <button className={`filter-btn ${filter === 'given' ? 'active' : ''}`} onClick={() => setFilter('given')}>Выдано</button>
                        <button className={`filter-btn ${filter === 'received' ? 'active' : ''}`} onClick={() => setFilter('received')}>Возвраты</button>
                    </div>
                </div>

                <div className="table-container">
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
                                    <td><span className={`badge ${t.type === 'Возврат' ? 'success' : 'danger'}`}>{t.type}</span></td>
                                    <td>{formatAmount(t.amount)}</td>
                                    <td><strong>{formatAmount(t.currentDebt)}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '10px' }}>
                    <button className="filter-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Назад</button>
                    <span style={{ alignSelf: 'center' }}>Стр. {currentPage}</span>
                    <button className="filter-btn" disabled={currentPage * itemsPerPage >= filteredData.length} onClick={() => setCurrentPage(p => p + 1)}>Вперед</button>
                </div>
            </div>
        </div>
    );
};

export default App;
