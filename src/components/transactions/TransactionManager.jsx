import React, { useState, useMemo, memo } from 'react';
import { Search, ArrowUpRight, ArrowDownLeft, Calendar } from 'lucide-react';
import { formatAmount } from '@/utils/debt-analytics';
import * as Paginations from '@/components/application/pagination/pagination';

const TransactionManager = memo(({ data = [], stats }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState('all'); // 'all', 'given', 'received'
    const [currentPage, setCurrentPage] = useState(1);
    const [statsView, setStatsView] = useState('month'); // 'month' or 'week'
    const [monthlyPage, setMonthlyPage] = useState(1);
    const [weeklyPage, setWeeklyPage] = useState(1);
    const [selectedWeek, setSelectedWeek] = useState(null);
    const itemsPerPage = 10;

    // Фильтрация данных
    const filteredData = useMemo(() => {
        return data.filter(t => {
            const matchesSearch = (t.comment || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.payee || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = filter === 'all' ||
                (filter === 'given' && t.type === 'Дано в долг') ||
                (filter === 'received' && t.type === 'Возврат');
            const matchesWeek = !selectedWeek || (t.sortDate >= selectedWeek.start && t.sortDate <= selectedWeek.end);
            return matchesSearch && matchesFilter && matchesWeek;
        });
    }, [data, searchQuery, filter, selectedWeek]);

    const paginatedData = useMemo(() => {
        return filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    }, [filteredData, currentPage]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

    return (
        <div className="transaction-manager-container">
            {/* Блок 1: Помесячная и Понедельная сводка */}
            <div className="card analytics-card">
                <div className="stats-view-header">
                    <h3>Сводка по {statsView === 'month' ? 'месяцам' : 'неделям'}</h3>
                    <div className="stats-view-tabs">
                        <button
                            className={statsView === 'month' ? 'active' : ''}
                            onClick={() => setStatsView('month')}
                        >
                            Месяцы
                        </button>
                        <button
                            className={statsView === 'week' ? 'active' : ''}
                            onClick={() => setStatsView('week')}
                        >
                            Недели
                        </button>
                    </div>
                </div>

                {statsView === 'month' ? (
                    <>
                        <div className="monthly-stats">
                            {stats.monthlyStats
                                .slice((monthlyPage - 1) * 4, monthlyPage * 4)
                                .map((month, i) => (
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
                        {stats.monthlyStats.length > 4 && (
                            <div className="pagination">
                                <button
                                    disabled={monthlyPage <= 1}
                                    onClick={() => setMonthlyPage(p => p - 1)}
                                >
                                    ← Пред.
                                </button>
                                <span className="page-info">
                                    {monthlyPage} / {Math.ceil(stats.monthlyStats.length / 4)}
                                </span>
                                <button
                                    disabled={monthlyPage >= Math.ceil(stats.monthlyStats.length / 4)}
                                    onClick={() => setMonthlyPage(p => p + 1)}
                                >
                                    След. →
                                </button>
                            </div>
                        )}
                        {stats.monthlyStats.length > 0 && (() => {
                            const pos = stats.monthlyStats.filter(m => m.received > m.given).length;
                            const neg = stats.monthlyStats.filter(m => m.given > m.received).length;
                            return (
                                <div className="month-summary">
                                    <span>Положительная динамика: <strong>{pos}</strong> мес.</span>
                                    <span>Отрицательная динамика: <strong>{neg}</strong> мес.</span>
                                    <span>Всего месяцев: <strong>{stats.monthlyStats.length}</strong></span>
                                </div>
                            );
                        })()}
                    </>
                ) : (
                    <>
                        <div className="monthly-stats">
                            {stats.weeklyStats
                                .slice((weeklyPage - 1) * 4, weeklyPage * 4)
                                .map((week, i) => (
                                    <div
                                        key={i}
                                        className={`month-item week-item ${selectedWeek?.week === week.week ? 'active' : ''}`}
                                        onClick={() => {
                                            const monday = new Date(week.week + 'T00:00:00');
                                            const sunday = new Date(monday);
                                            sunday.setDate(sunday.getDate() + 6);
                                            sunday.setHours(23, 59, 59, 999);
                                            setSelectedWeek(selectedWeek?.week === week.week ? null : {
                                                week: week.week,
                                                start: monday,
                                                end: sunday,
                                                label: `${monday.toLocaleDateString('ru', { day: 'numeric', month: 'long' })} — ${sunday.toLocaleDateString('ru', { day: 'numeric', month: 'long' })}`
                                            });
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <div className="month-header">
                                            <span className="month-name">
                                                {new Date(week.week + 'T00:00:00').toLocaleDateString('ru', {
                                                    day: 'numeric',
                                                    month: 'long'
                                                })} — {new Date(new Date(week.week + 'T00:00:00').getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('ru', {
                                                    day: 'numeric',
                                                    month: 'long'
                                                })}
                                            </span>
                                            <span className={`month-net ${week.net > 0 ? 'negative' : 'positive'}`}>
                                                {week.net > 0 ? '+' : ''}{formatAmount(week.net)} ₴
                                            </span>
                                        </div>
                                        <div className="month-details">
                                            <div className="month-stat">
                                                <span>Дано: {formatAmount(week.given)} ₴ ({week.loans} раз)</span>
                                            </div>
                                            <div className="month-stat">
                                                <span>Вернула: {formatAmount(week.received)} ₴ ({week.returns} раз)</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                        {stats.weeklyStats.length > 4 && (
                            <div className="pagination">
                                <button
                                    disabled={weeklyPage <= 1}
                                    onClick={() => setWeeklyPage(p => p - 1)}
                                >
                                    ← Пред.
                                </button>
                                <span className="page-info">
                                    {weeklyPage} / {Math.ceil(stats.weeklyStats.length / 4)}
                                </span>
                                <button
                                    disabled={weeklyPage >= Math.ceil(stats.weeklyStats.length / 4)}
                                    onClick={() => setWeeklyPage(p => p + 1)}
                                >
                                    След. →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Блок 2: Реестр транзакций */}
            <div className="card list-card">
                <div className="list-header">
                    <div className="search-wrap">
                        <Search size={18} className="search-icon" />
                        <input
                            placeholder="Поиск по комментариям или имени..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>
                    <div className="filter-tabs">
                        <button
                            className={filter === 'all' ? 'active' : ''}
                            onClick={() => { setFilter('all'); setCurrentPage(1); }}
                        >
                            Все
                        </button>
                        <button
                            className={filter === 'given' ? 'active' : ''}
                            onClick={() => { setFilter('given'); setCurrentPage(1); }}
                        >
                            Выдано
                        </button>
                        <button
                            className={filter === 'received' ? 'active' : ''}
                            onClick={() => { setFilter('received'); setCurrentPage(1); }}
                        >
                            Возвраты
                        </button>
                    </div>
                </div>

                {selectedWeek && (
                    <div className="week-filter-bar">
                        <span>📅 Фильтр по неделе: <strong>{selectedWeek.label}</strong></span>
                        <button
                            className="clear-week-btn"
                            onClick={() => { setSelectedWeek(null); setCurrentPage(1); }}
                        >
                            ✕ Сбросить
                        </button>
                    </div>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Комментарий</th>
                                <th>Тип</th>
                                <th>Сумма</th>
                                <th>Остаток долга</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.length > 0 ? (
                                paginatedData.map((t, i) => (
                                    <tr key={i}>
                                        <td>{t.formattedDate}</td>
                                        <td>{t.comment}</td>
                                        <td>
                                            <span className={`type-badge ${t.type === 'Возврат' ? 'in' : 'out'}`}>
                                                {t.type === 'Возврат' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="amount-cell">{formatAmount(t.amount)} ₴</td>
                                        <td className="debt-cell">{formatAmount(t.currentDebt)} ₴</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                        Транзакций не найдено
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div style={{ marginTop: '1rem' }}>
                        <Paginations.PaginationPageDefault
                            page={currentPage}
                            total={totalPages}
                            onPageChange={(page) => setCurrentPage(page)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

TransactionManager.displayName = 'TransactionManager';

export default TransactionManager;
