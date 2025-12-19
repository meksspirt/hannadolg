import React, { useMemo } from 'react';
import { Lightbulb, TrendingDown, Target, ShieldCheck, Zap } from 'lucide-react';

const FinancialAdvice = ({ stats }) => {
    const advice = useMemo(() => {
        const pool = [
            {
                id: 'rule503020',
                icon: <ShieldCheck className="advice-icon blue" />,
                title: 'Правило 50/30/20',
                text: 'Старайтесь направлять 50% дохода на нужды, 30% на желания и 20% на погашение долгов или накопления.'
            },
            {
                id: 'snowball',
                icon: <Target className="advice-icon orange" />,
                title: 'Метод "Снежного кома"',
                text: 'Попробуйте закрывать сначала самые маленькие долги. Это даст психологический стимул двигаться дальше.'
            },
            {
                id: 'pause',
                icon: <Zap className="advice-icon yellow" />,
                title: 'Правило 24 часов',
                text: 'Перед любой не запланированной покупкой подождите сутки. Часто желание "горит" только в моменте.'
            },
            {
                id: 'tracking',
                icon: <Lightbulb className="advice-icon green" />,
                title: 'Тотальный учет',
                text: 'Запись каждой гривны помогает увидеть, куда "утекают" деньги. Вы уже делаете это — и это 50% успеха!'
            }
        ];

        // Контекстные советы
        if (stats.debtTrend === 'growing') {
            pool.unshift({
                id: 'stop_borrowing',
                icon: <TrendingDown className="advice-icon red" />,
                title: 'Остановить рост',
                text: 'Тренд растет. Попробуйте установить жесткий лимит на новые займы в этом месяце (например, не более 1000 ₴).'
            });
        }

        if (stats.returnRate < 30) {
            pool.unshift({
                id: 'low_return',
                icon: <Zap className="advice-icon orange" />,
                title: 'Фокус на возвратах',
                text: 'Процент возврата низкий. Сейчас приоритет — не увеличивать "тело" долга, а зафиксировать график выплат.'
            });
        }

        if (stats.debtTrend === 'decreasing') {
            pool.unshift({
                id: 'good_job',
                icon: <ShieldCheck className="advice-icon green" />,
                title: 'Отличная динамика!',
                text: 'Долг снижается. Главное — не брать новый займ "в награду" за то, что старый уменьшился.'
            });
        }

        // Выбираем 2 случайных совета из пула (или первые два, если они контекстные)
        return pool.slice(0, 2);
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
