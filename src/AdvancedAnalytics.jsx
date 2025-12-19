import React from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { HeatmapRect } from '@visx/heatmap';
import { ParentSize } from '@visx/responsive';

// --- Weekday Distribution ---
export const WeekdayChart = ({ data = [], theme }) => {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return (
        <ParentSize>
            {({ width, height }) => {
                if (width < 10) return null;
                const margin = { top: 20, right: 20, bottom: 50, left: 60 };
                const xMax = width - margin.left - margin.right;
                const yMax = height - margin.top - margin.bottom;

                const xScale = scaleBand({
                    range: [0, xMax],
                    domain: data.map(d => days[d.day]),
                    padding: 0.3,
                });
                const yScale = scaleLinear({
                    range: [yMax, 0],
                    domain: [0, Math.max(0, ...data.map(d => d.amount)) * 1.1],
                });

                const color = '#3b82f6';
                const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
                const labelFontWeight = 600;

                return (
                    <svg width={width} height={height}>
                        <Group left={margin.left} top={margin.top}>
                            {data.map((d, i) => {
                                const dayName = days[d.day];
                                const barWidth = xScale.bandwidth();
                                const barHeight = yMax - yScale(d.amount);
                                const barX = xScale(dayName);
                                const barY = yMax - barHeight;
                                return (
                                    <Bar
                                        key={i}
                                        x={barX}
                                        y={barY}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={color}
                                        rx={4}
                                    />
                                );
                            })}
                            <AxisBottom
                                top={yMax}
                                scale={xScale}
                                stroke={textColor}
                                tickStroke={textColor}
                                tickLabelProps={() => ({
                                    fill: textColor,
                                    fontSize: 12,
                                    fontWeight: labelFontWeight,
                                    textAnchor: 'middle',
                                })}
                            />
                            <AxisLeft
                                scale={yScale}
                                stroke={textColor}
                                tickStroke={textColor}
                                numTicks={4}
                                tickFormat={v => `${(v / 1000).toFixed(0)}k`}
                                tickLabelProps={() => ({
                                    fill: textColor,
                                    fontSize: 11,
                                    fontWeight: labelFontWeight,
                                    textAnchor: 'end',
                                    dx: -4,
                                })}
                            />
                        </Group>
                    </svg>
                );
            }}
        </ParentSize>
    );
};

// --- Loan Size Distribution ---
export const LoanSizeChart = ({ data = [], theme }) => {
    const labels = { small: '< 500', medium: '500-2k', large: '> 2k' };
    return (
        <ParentSize>
            {({ width, height }) => {
                if (width < 10) return null;
                const margin = { top: 20, right: 20, bottom: 50, left: 60 };
                const xMax = width - margin.left - margin.right;
                const yMax = height - margin.top - margin.bottom;

                const xScale = scaleBand({
                    range: [0, xMax],
                    domain: data.map(d => labels[d.size]),
                    padding: 0.4,
                });
                const yScale = scaleLinear({
                    range: [yMax, 0],
                    domain: [0, Math.max(0, ...data.map(d => d.amount)) * 1.1],
                });

                const textColor = theme === 'dark' ? '#cbd5e1' : '#475569';
                const labelFontWeight = 600;

                return (
                    <svg width={width} height={height}>
                        <Group left={margin.left} top={margin.top}>
                            {data.map((d, i) => {
                                const label = labels[d.size];
                                const barWidth = xScale.bandwidth();
                                const barHeight = yMax - yScale(d.amount);
                                const barX = xScale(label);
                                const barY = yMax - barHeight;
                                return (
                                    <Bar
                                        key={i}
                                        x={barX}
                                        y={barY}
                                        width={barWidth}
                                        height={barHeight}
                                        fill={d.size === 'large' ? '#ef4444' : d.size === 'medium' ? '#f59e0b' : '#3b82f6'}
                                        rx={4}
                                    />
                                );
                            })}
                            <AxisBottom
                                top={yMax}
                                scale={xScale}
                                stroke={textColor}
                                tickStroke={textColor}
                                tickLabelProps={() => ({
                                    fill: textColor,
                                    fontSize: 12,
                                    fontWeight: labelFontWeight,
                                    textAnchor: 'middle',
                                })}
                            />
                            <AxisLeft
                                scale={yScale}
                                stroke={textColor}
                                tickStroke={textColor}
                                numTicks={4}
                                tickFormat={v => `${(v / 1000).toFixed(0)}k`}
                                tickLabelProps={() => ({
                                    fill: textColor,
                                    fontSize: 11,
                                    fontWeight: labelFontWeight,
                                    textAnchor: 'end',
                                    dx: -4,
                                })}
                            />
                        </Group>
                    </svg>
                );
            }}
        </ParentSize>
    );
};

// --- Calendar Frequency Heatmap (Simplified) ---
export const MonthlyHeatmap = ({ data = [], theme }) => {
    return (
        <ParentSize>
            {({ width, height }) => {
                if (width < 10) return null;
                const margin = { top: 10, right: 10, bottom: 10, left: 10 };
                const innerWidth = width - margin.left - margin.right;
                const innerHeight = height - margin.top - margin.bottom;

                const columns = 7;
                const rows = 5;
                const size = Math.min(innerWidth / columns, innerHeight / rows) - 6;

                const maxCount = Math.max(1, ...data.map(d => d.count));
                const colorScale = scaleLinear({
                    domain: [0, maxCount],
                    range: [theme === 'dark' ? '#1e293b' : '#f1f5f9', '#3b82f6'],
                });

                return (
                    <svg width={width} height={height}>
                        <Group left={margin.left} top={margin.top}>
                            {data.map((d, i) => {
                                const col = (d.day - 1) % columns;
                                const row = Math.floor((d.day - 1) / columns);
                                return (
                                    <rect
                                        key={i}
                                        x={col * (size + 6)}
                                        y={row * (size + 6)}
                                        width={size}
                                        height={size}
                                        fill={colorScale(d.count)}
                                        rx={4}
                                    />
                                );
                            })}
                        </Group>
                    </svg>
                );
            }}
        </ParentSize>
    );
};
