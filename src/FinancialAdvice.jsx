import React, { useMemo } from 'react';
import { Lightbulb, TrendingDown, Target, ShieldCheck, Zap } from 'lucide-react';

const FinancialAdvice = ({ stats }) => {
    const advice = useMemo(() => {
        const generalPool = [
            {
                id: 'rule503020',
                icon: <ShieldCheck className="advice-icon blue" />,
                title: 'Правило 50/30/20',
                text: '50% дохода — на жизнь, 30% — на хочу, 20% — на долги и накопления. Это база.'
            },
            {
                id: 'snowball',
                icon: <Target className="advice-icon orange" />,
                title: 'Метод "Снежного кома"',
                text: 'Закрывайте сначала самые мелкие долги. Психологическая победа важнее математики.'
            },
            {
                id: 'pause',
                icon: <Zap className="advice-icon yellow" />,
                title: 'Пауза 24 часа',
                text: 'Перед покупкой не первой необходимости подождите сутки. В 70% случаев желание пройдет.'
            },
            {
                id: 'tracking',
                icon: <Lightbulb className="advice-icon green" />,
                title: 'Сила учета',
                text: 'Тот факт, что вы видите этот график, уже делает вас финансово грамотнее 80% людей.'
            },
            {
                id: 'inflation',
                icon: <TrendingDown className="advice-icon red" />,
                title: 'Помни про инфляцию',
                text: 'Деньги сегодня дороже, чем деньги завтра. Возвращать долги сейчас — дешевле, чем потом.'
            },
            {
                id: 'safety_net',
                icon: <ShieldCheck className="advice-icon blue" />,
                title: 'Подушка безопасности',
                text: 'Цель №1 после долгов — собрать сумму на 3 месяца жизни. Это ваш щит от новых кредитов.'
            },
            {
                id: 'psychology',
                icon: <Lightbulb className="advice-icon yellow" />,
                title: 'Эмоциональные траты',
                text: 'Часто мы берем в долг, когда устали или расстроены. Найдите бесплатный способ радовать себя.'
            },
            {
                id: 'small_leaks',
                icon: <TrendingDown className="advice-icon orange" />,
                title: 'Мелкие траты',
                text: 'Мелкие займы до 500 ₴ незаметно складываются в огромные суммы. Следите за ними внимательнее.'
            }
        ];

        let contextualAlerts = [];

        // 1. Алерты по лимитам и целям
        if (stats.isOverLimit) {
            contextualAlerts.push({
                id: 'limit_breach',
                icon: <Zap className="advice-icon red" />,
                title: 'Критический уровень!',
                text: `Долг превысил ваш лимит в ${new Intl.NumberFormat('ru-RU').format(stats.safetyLimit)} ₴. Рекомендуется режим жесткой экономии.`
            });
        }

        if (stats.burndown && stats.burndown.length > 0) {
            const lastBurndown = stats.burndown[0];
            if (stats.currentDebt > lastBurndown.debt * 1.05) {
                contextualAlerts.push({
                    id: 'off_track',
                    icon: <Target className="advice-icon orange" />,
                    title: 'Отставание от графика',
                    text: 'Вы выше линии цели. Чтобы успеть к сроку, нужно увеличить сумму возвратов в этом месяце.'
                });
            }
        }

        // 2. Алерты по трендам
        if (stats.intervals && stats.intervals.trend === 'decreasing') {
            contextualAlerts.push({
                id: 'intensity_warning',
                icon: <TrendingDown className="advice-icon red" />,
                title: 'Учащение займов',
                text: 'Паузы между займами сокращаются. Это опасный признак формирования привычки "жить в долг".'
            });
        }

        if (stats.debtTrend === 'growing' && contextualAlerts.length < 2) {
            contextualAlerts.push({
                id: 'stop_growth',
                icon: <TrendingDown className="advice-icon orange" />,
                title: 'Стоп-кран',
                text: 'Долг растет 3 месяца подряд. Попробуйте неделю "нулевых трат" (только самое необходимое).'
            });
        }

        if (stats.debtTrend === 'decreasing') {
            contextualAlerts.push({
                id: 'keep_going',
                icon: <ShieldCheck className="advice-icon green" />,
                title: 'Вы на верном пути',
                text: 'Долг стабильно падает. Не расслабляйтесь, пока не увидите 0 на графике!'
            });
        }

        // Перемешиваем общий пул для разнообразия
        const shuffledGeneral = [...generalPool].sort(() => 0.5 - Math.random());

        // Формируем итоговый список: сначала важные алерты, потом случайные советы
        const result = [...contextualAlerts, ...shuffledGeneral].slice(0, 3);
        return result;
    }, [stats]);

    return (
        <div className="advice-container">
            {advice.map((item) => (
                <div key={item.id} className="card advice-card">
                    <div className="advice-header">
                        {item.icon}
                        <span className="advice-title">{item.title}</span>
                    </div>
                    <p className="advice-text">{item.text}</p>
                </div>
            ))}
        </div>
    );
};

export default FinancialAdvice;
