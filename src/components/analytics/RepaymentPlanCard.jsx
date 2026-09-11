import React, { memo } from 'react';
import { formatAmount } from '@/utils/debt-analytics';

const RepaymentPlanCard = memo(({ stats, payoffTargetDate }) => {
    // Используем целевую дату пользователя, если задана, иначе по умолчанию 31.12.2026
    const targetDate = payoffTargetDate ? new Date(payoffTargetDate) : new Date(2026, 11, 31);
    const now = new Date();
    
    const diffMonths = (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth());
    const monthsLeft = Math.max(1, diffMonths);
    const monthlyPayment = monthsLeft > 0 ? stats.currentDebt / monthsLeft : stats.currentDebt;
    const repayPct = stats.totalGiven > 0 ? Math.min(100, (stats.totalReceived / stats.totalGiven) * 100) : 0;
    
    const formattedTarget = targetDate.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    });

    return (
        <div className="card milestones-card">
            <div className="repayment-header">
                <h3>Погашение к {formattedTarget} 🎯</h3>
                <span className="repayment-badge">
                    {monthsLeft} мес. осталось
                </span>
            </div>
            <div className="repayment-hero">
                <div className="repayment-hero-label">Необходимый ежемесячный платёж</div>
                <div className="repayment-hero-amount">
                    {formatAmount(monthlyPayment)} <span className="value-symbol">₴</span>
                </div>
                <div className="repayment-hero-sub">
                    Текущий остаток: {formatAmount(stats.currentDebt)} ₴ · {monthsLeft} платежей
                </div>
            </div>
            <div className="repayment-progress">
                <div className="repayment-progress-bar">
                    <div className="repayment-progress-fill" style={{ width: `${repayPct}%` }} />
                </div>
                <div className="repayment-progress-labels">
                    <span>Выдано: {formatAmount(stats.totalGiven)} ₴</span>
                    <span>Возвращено: {repayPct.toFixed(0)}%</span>
                    <span>Цель: 100%</span>
                </div>
            </div>
            <div className="repayment-details">
                <div className="repayment-item">
                    <span className="repayment-item-icon">📅</span>
                    <span className="repayment-label">Осталось месяцев</span>
                    <span className="repayment-value">{monthsLeft}</span>
                </div>
                <div className="repayment-item">
                    <span className="repayment-item-icon">💰</span>
                    <span className="repayment-label">Текущий долг</span>
                    <span className="repayment-value">{formatAmount(stats.currentDebt)} <span className="value-symbol">₴</span></span>
                </div>
                <div className="repayment-item">
                    <span className="repayment-item-icon">📊</span>
                    <span className="repayment-label">Всего к выплате</span>
                    <span className="repayment-value">{formatAmount(monthlyPayment * monthsLeft)} <span className="value-symbol">₴</span></span>
                </div>
            </div>
        </div>
    );
});

RepaymentPlanCard.displayName = 'RepaymentPlanCard';

export default RepaymentPlanCard;
