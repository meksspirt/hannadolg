import React, { useMemo, useState } from 'react';
import { Lightbulb, TrendingDown, Target, ShieldCheck, Zap, RefreshCw } from 'lucide-react';

const FinancialAdvice = ({ stats }) => {
    const [refreshTrigger, setRefreshTrigger] = useState(() => Math.random());

    const advice = useMemo(() => {
        const generalPool = [
            {
                id: 'rule503020',
                icon: <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />,
                title: 'Правило 50/30/20',
                text: '50% дохода — на жизнь, 30% — на хочу, 20% — на долги и накопления. Это база.'
            },
            {
                id: 'snowball',
                icon: <Target className="w-5 h-5 text-amber-500 shrink-0" />,
                title: 'Метод "Снежного кома"',
                text: 'Закрывайте сначала самые мелкие долги. Психологическая победа важнее математики.'
            },
            {
                id: 'pause',
                icon: <Zap className="w-5 h-5 text-yellow-500 shrink-0" />,
                title: 'Пауза 24 часа',
                text: 'Перед покупкой не первой необходимости подождите сутки. В 70% случаев желание пройдет.'
            },
            {
                id: 'tracking',
                icon: <Lightbulb className="w-5 h-5 text-emerald-500 shrink-0" />,
                title: 'Сила учета',
                text: 'Тот факт, что вы видите этот график, уже делает вас финансово грамотнее 80% людей.'
            },
            {
                id: 'inflation',
                icon: <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />,
                title: 'Помни про инфляцию',
                text: 'Деньги сегодня дороже, чем деньги завтра. Возвращать долги сейчас — дешевле, чем потом.'
            },
            {
                id: 'safety_net',
                icon: <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />,
                title: 'Подушка безопасности',
                text: 'Цель №1 после долгов — собрать сумму на 3 месяца жизни. Это ваш щит от новых кредитов.'
            },
            {
                id: 'psychology',
                icon: <Lightbulb className="w-5 h-5 text-yellow-500 shrink-0" />,
                title: 'Эмоциональные траты',
                text: 'Часто мы берем в долг, когда устали или расстроены. Найдите бесплатный способ радовать себя.'
            },
            {
                id: 'small_leaks',
                icon: <TrendingDown className="w-5 h-5 text-amber-500 shrink-0" />,
                title: 'Мелкие траты',
                text: 'Мелкие займы до 500 ₴ незаметно складываются в огромные суммы. Следите за ними внимательнее.'
            }
        ];

        let contextualAlerts = [];

        if (stats.isOverLimit) {
            contextualAlerts.push({
                id: 'limit_breach',
                icon: <Zap className="w-5 h-5 text-red-500 shrink-0" />,
                title: 'Критический уровень!',
                text: `Долг превысил ваш лимит в ${new Intl.NumberFormat('ru-RU').format(stats.safetyLimit)} ₴. Рекомендуется режим жесткой экономии.`
            });
        }

        if (stats.burndown && stats.burndown.length > 0) {
            const lastBurndown = stats.burndown[0];
            if (stats.currentDebt > lastBurndown.debt * 1.05) {
                contextualAlerts.push({
                    id: 'off_track',
                    icon: <Target className="w-5 h-5 text-amber-500 shrink-0" />,
                    title: 'Отставание от графика',
                    text: 'Вы выше линии цели. Чтобы успеть к сроку, нужно увеличить сумму возвратов в этом месяце.'
                });
            }
        }

        if (stats.intervals && stats.intervals.trend === 'decreasing') {
            contextualAlerts.push({
                id: 'intensity_warning',
                icon: <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />,
                title: 'Учащение займов',
                text: 'Паузы между займами сокращаются. Это опасный признак формирования привычки "жить в долг".'
            });
        }

        if (stats.debtTrend === 'growing' && contextualAlerts.length < 2) {
            contextualAlerts.push({
                id: 'stop_growth',
                icon: <TrendingDown className="w-5 h-5 text-amber-500 shrink-0" />,
                title: 'Стоп-кран',
                text: 'Долг растет 3 месяца подряд. Попробуйте неделю "нулевых трат" (только самое необходимое).'
            });
        }

        if (stats.debtTrend === 'decreasing') {
            contextualAlerts.push({
                id: 'keep_going',
                icon: <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />,
                title: 'Вы на верном пути',
                text: 'Долг стабильно падает. Не расслабляйтесь, пока не увидите 0 на графике!'
            });
        }

        const shuffledGeneral = [...generalPool].sort(() => 0.5 - Math.random());
        const shuffledAlerts = [...contextualAlerts].sort(() => 0.5 - Math.random());

        let result = [];
        if (shuffledAlerts.length > 0) {
            result.push(shuffledAlerts[0]);
            result.push(shuffledGeneral[0]);
        } else {
            result = shuffledGeneral.slice(0, 2);
        }

        return result;
    }, [stats, refreshTrigger]);

    return (
        <div className="flex flex-col gap-3 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {advice.map((item) => (
                    <div
                        key={item.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-xl p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                        <div className="flex items-center gap-2.5 mb-2 font-semibold text-slate-800 dark:text-slate-100">
                            {item.icon}
                            <span className="text-base">{item.title}</span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.text}</p>
                    </div>
                ))}
            </div>
            <button
                className="self-end inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors shadow-2xs"
                onClick={() => setRefreshTrigger(prev => prev + 1)}
            >
                <RefreshCw size={14} />
                Другие советы
            </button>
        </div>
    );
};

export default FinancialAdvice;
