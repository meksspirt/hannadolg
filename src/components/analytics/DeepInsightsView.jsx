import React, { memo } from 'react';
import {
    TrendingDown,
    DollarSign,
    Flame,
    Clock,
    ShieldAlert,
    PiggyBank,
    BarChart3,
    Calendar,
    Coins
} from 'lucide-react';
import { formatAmount } from '@/utils/debt-analytics';
import { WeekdayChart, LoanSizeChart, MonthlyHeatmap } from '@/AdvancedAnalytics';

const DeepInsightsView = memo(({ stats, theme }) => {
    const { realValue, currency, opportunityCost, badHabits, staleLoans, weekdayStats, loanSizeStats, daysOfMonthData } = stats;

    return (
        <div className="deep-insights-container">
            {/* Секция 1: Финансовая математика (Инфляция, Упущенная выгода, Валюта) */}
            <div className="insights-grid">
                {/* Карточка 1: Инфляция */}
                <div className="card insight-card">
                    <div className="insight-card-header">
                        <div className="insight-icon-wrap red">
                            <TrendingDown size={20} />
                        </div>
                        <div>
                            <h4>Реальная стоимость долга</h4>
                            <span className="insight-subtitle">С учетом инфляции {stats.realValue?.nominal ? '' : ''}</span>
                        </div>
                    </div>
                    <div className="insight-body">
                        <div className="insight-main-stat">
                            <span className="insight-value">{formatAmount(realValue?.real || 0)} ₴</span>
                            <span className="insight-tag danger">
                                -{formatAmount(realValue?.gain || 0)} ₴ ({realValue?.percent}%)
                            </span>
                        </div>
                        <p className="insight-description">
                            Номинально долг равен <strong>{formatAmount(realValue?.nominal || 0)} ₴</strong>, но из-за инфляции покупательная способность возвращенных денег снизилась на <strong>{formatAmount(realValue?.gain || 0)} ₴</strong>.
                        </p>
                    </div>
                </div>

                {/* Карточка 2: Упущенная выгода */}
                <div className="card insight-card">
                    <div className="insight-card-header">
                        <div className="insight-icon-wrap orange">
                            <PiggyBank size={20} />
                        </div>
                        <div>
                            <h4>Упущенная выгода (APR 15%)</h4>
                            <span className="insight-subtitle">Альтернативная доходность</span>
                        </div>
                    </div>
                    <div className="insight-body">
                        <div className="insight-main-stat">
                            <span className="insight-value">{formatAmount(opportunityCost || 0)} ₴</span>
                            <span className="insight-tag warning">15% годовых</span>
                        </div>
                        <p className="insight-description">
                            Столько вы могли бы заработать на депозите или облигациях ОВГЗ, если бы эти деньги не находились в беспроцентном займе.
                        </p>
                    </div>
                </div>

                {/* Карточка 3: Мультивалютный срез */}
                <div className="card insight-card">
                    <div className="insight-card-header">
                        <div className="insight-icon-wrap blue">
                            <Coins size={20} />
                        </div>
                        <div>
                            <h4>Валютный эквивалент</h4>
                            <span className="insight-subtitle">По курсу НБУ ({currency?.rates?.usd?.toFixed(2)} / {currency?.rates?.eur?.toFixed(2)})</span>
                        </div>
                    </div>
                    <div className="insight-body">
                        <div className="currency-pills">
                            <div className="currency-pill">
                                <span className="curr-label">USD:</span>
                                <span className="curr-val">${formatAmount(currency?.usd || 0)}</span>
                            </div>
                            <div className="currency-pill">
                                <span className="curr-label">EUR:</span>
                                <span className="curr-val">€{formatAmount(currency?.eur || 0)}</span>
                            </div>
                        </div>
                        <p className="insight-description">
                            Курсовой хедж-эффект по сравнению с базовым курсом 40.0: <strong className={currency?.hedgeGain >= 0 ? 'text-success' : 'text-danger'}>
                                {currency?.hedgeGain >= 0 ? '+' : ''}{formatAmount(currency?.hedgeGain || 0)} $
                            </strong>.
                        </p>
                    </div>
                </div>
            </div>

            {/* Секция 2: Привычки и Зависшие долги */}
            <div className="insights-grid secondary">
                {/* Карточка: Вредные привычки */}
                <div className="card insight-card">
                    <div className="insight-card-header">
                        <div className="insight-icon-wrap yellow">
                            <Flame size={20} />
                        </div>
                        <div>
                            <h4>Вредные привычки</h4>
                            <span className="insight-subtitle">Анализ трат на сигареты, алкоголь и т.д.</span>
                        </div>
                    </div>
                    <div className="insight-body">
                        <div className="insight-main-stat">
                            <span className="insight-value">{formatAmount(badHabits?.total || 0)} ₴</span>
                            <span className="insight-tag success">Экономия: {formatAmount(badHabits?.potentialSavings || 0)} ₴</span>
                        </div>
                        <p className="insight-description">
                            Сократив траты на эту категорию хотя бы на 50%, можно направлять дополнительно до <strong>{formatAmount(badHabits?.potentialSavings || 0)} ₴</strong> в ускоренное погашение.
                        </p>
                    </div>
                </div>

                {/* Карточка: Зависшие долги */}
                <div className="card insight-card">
                    <div className="insight-card-header">
                        <div className="insight-icon-wrap red">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h4>Зависшие позиции (&gt; 60 дней)</h4>
                            <span className="insight-subtitle">Долги без платежей более 2 месяцев</span>
                        </div>
                    </div>
                    <div className="insight-body">
                        {staleLoans && staleLoans.length > 0 ? (
                            <div className="stale-loans-list">
                                {staleLoans.map((loan, idx) => (
                                    <div key={idx} className="stale-loan-item">
                                        <div className="stale-loan-name">
                                            <span>{loan.name}</span>
                                            <span className="stale-days">{loan.lastActivity} дн. без возвратов</span>
                                        </div>
                                        <span className="stale-score">Trust: {loan.score}%</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="insight-description success-text">
                                ✅ Зависших займов старше 60 дней не обнаружено!
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Секция 3: Визуализации распределений (AdvancedAnalytics) */}
            <div className="distribution-charts-header">
                <h3>📊 Паттерны поведения и распределение займов</h3>
                <p>Математические модели выявления аномалий и регулярности займов</p>
            </div>

            <div className="distribution-charts-grid">
                {/* 1. По дням недели */}
                <div className="card chart-subcard">
                    <div className="chart-subcard-header">
                        <div className="flex-title">
                            <BarChart3 size={18} />
                            <h4>Займы по дням недели</h4>
                        </div>
                        <span className="chart-hint">Объем в ₴</span>
                    </div>
                    <div className="subchart-container" style={{ height: '240px' }}>
                        <WeekdayChart data={weekdayStats} theme={theme} />
                    </div>
                </div>

                {/* 2. По размерам займов */}
                <div className="card chart-subcard">
                    <div className="chart-subcard-header">
                        <div className="flex-title">
                            <BarChart3 size={18} />
                            <h4>Структура чеков</h4>
                        </div>
                        <span className="chart-hint">Мелкие, средние, крупные</span>
                    </div>
                    <div className="subchart-container" style={{ height: '240px' }}>
                        <LoanSizeChart data={loanSizeStats} theme={theme} />
                    </div>
                </div>

                {/* 3. Календарная тепловая карта */}
                <div className="card chart-subcard">
                    <div className="chart-subcard-header">
                        <div className="flex-title">
                            <Calendar size={18} />
                            <h4>Тепловая карта чисел месяца</h4>
                        </div>
                        <span className="chart-hint">Числа с 1 по 31</span>
                    </div>
                    <div className="subchart-container" style={{ height: '240px' }}>
                        <MonthlyHeatmap data={daysOfMonthData} theme={theme} />
                    </div>
                </div>
            </div>
        </div>
    );
});

DeepInsightsView.displayName = 'DeepInsightsView';

export default DeepInsightsView;
