import React, { memo } from 'react';
import { formatAmount } from '@/utils/debt-analytics';

const StatsOverviewGrid = memo(({ stats }) => {
    return (
        <div className="stats-grid">
            <div className={`card stat-card ${stats.isOverLimit ? 'danger blink' : 'danger'}`}>
                <span className="label">
                    Долг Ганны 📈
                    {stats.isOverLimit && <span className="warning-icon">⚠️</span>}
                </span>
                <span className="value">
                    {formatAmount(stats.currentDebt)} <span className="value-symbol">₴</span>
                </span>
                {stats.benchmarks?.monthlyChange !== 0 && (
                    <span className={`stat-delta ${Number(stats.benchmarks?.monthlyChange) > 0 ? 'up' : 'down'}`}>
                        {Number(stats.benchmarks?.monthlyChange) > 0 ? '+' : ''}{stats.benchmarks?.monthlyChange}% к прошлому мес.
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
                <span className="label">Одолжила за текущий месяц</span>
                <span className="value">{formatAmount(stats.currentMonthGiven)} <span className="value-symbol">₴</span></span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>только новые займы</span>
            </div>

            <div className="card stat-card info">
                <span className="label">Одолжила за последние 7 дней</span>
                <span className="value">{formatAmount(stats.lastWeekGiven)} <span className="value-symbol">₴</span></span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>только новые займы</span>
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
    );
});

StatsOverviewGrid.displayName = 'StatsOverviewGrid';

export default StatsOverviewGrid;
