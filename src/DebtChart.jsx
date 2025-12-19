import React, { useMemo, useCallback } from 'react';
import { Group } from '@visx/group';
import { AreaClosed, LinePath, Bar } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { scaleTime, scaleLinear } from '@visx/scale';
import { GridRows, GridColumns } from '@visx/grid';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { withTooltip, Tooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { extent, max, bisector } from 'd3-array';
import { format } from 'date-fns';

const tooltipStyles = {
    ...defaultStyles,
    background: '#1e293b',
    color: '#f1f5f9',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '12px',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    fontSize: '12px',
};

// accessors
const getDate = (d) => new Date(d.date);
const getDebtValue = (d) => d.debt;
const bisectDate = bisector((d) => new Date(d.date)).left;

const DebtChart = ({
    data,
    forecastData = [],
    mode = 'debt', // 'debt' or 'flow'
    width,
    height,
    margin = { top: 20, right: 30, bottom: 50, left: 60 },
    theme = 'dark',
    showTooltip,
    hideTooltip,
    tooltipData,
    tooltipTop = 0,
    tooltipLeft = 0,
}) => {
    if (width < 10) return null;

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const allData = [...data, ...forecastData];

    // scales
    const dateScale = useMemo(
        () =>
            scaleTime({
                range: [0, innerWidth],
                domain: extent(allData, getDate) || [new Date(), new Date()],
            }),
        [innerWidth, allData],
    );

    const getMaxValue = (d) => mode === 'flow' ? Math.max(d.given, d.received) : d.debt;

    const debtScale = useMemo(
        () =>
            scaleLinear({
                range: [innerHeight, 0],
                domain: [0, (max(allData, getMaxValue) || 0) * 1.1],
                nice: true,
            }),
        [innerHeight, allData, mode],
    );

    // tooltip handler
    const handleTooltip = useCallback(
        (event) => {
            const { x } = localPoint(event) || { x: 0 };
            const x0 = dateScale.invert(x - margin.left);
            const index = bisectDate(data, x0, 1);
            const d0 = data[index - 1];
            const d1 = data[index];
            let d = d0;
            if (d1 && getDate(d1)) {
                d = x0.valueOf() - getDate(d0).valueOf() > getDate(d1).valueOf() - x0.valueOf() ? d1 : d0;
            }
            showTooltip({
                tooltipData: d,
                tooltipLeft: x,
                tooltipTop: debtScale(getMaxValue(d)) + margin.top,
            });
        },
        [showTooltip, debtScale, dateScale, data, margin.left, margin.top, mode],
    );

    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';

    return (
        <div style={{ position: 'relative' }}>
            <svg width={width} height={height}>
                <LinearGradient id="area-gradient" from="#3b82f6" fromOpacity={0.2} to="#3b82f6" toOpacity={0} />
                <LinearGradient id="success-gradient" from="#22c55e" fromOpacity={0.1} to="#22c55e" toOpacity={0} />

                <Group left={margin.left} top={margin.top}>
                    <GridRows scale={debtScale} width={innerWidth} stroke={gridColor} pointerEvents="none" />
                    <GridColumns scale={dateScale} height={innerHeight} stroke={gridColor} pointerEvents="none" />

                    <AxisBottom
                        top={innerHeight}
                        scale={dateScale}
                        stroke={axisColor}
                        tickStroke={axisColor}
                        tickLabelProps={() => ({
                            fill: axisColor,
                            fontSize: 10,
                            textAnchor: 'middle',
                        })}
                        numTicks={width > 500 ? 6 : 3}
                    />

                    <AxisLeft
                        scale={debtScale}
                        stroke={axisColor}
                        tickStroke={axisColor}
                        tickLabelProps={() => ({
                            fill: axisColor,
                            fontSize: 10,
                            textAnchor: 'end',
                            dx: -4,
                            dy: 4,
                        })}
                        tickFormat={(v) => `${(v / 1000).toFixed(0)}k`}
                    />

                    {mode === 'debt' ? (
                        <>
                            <AreaClosed
                                data={data}
                                x={(d) => dateScale(getDate(d)) ?? 0}
                                y={(d) => debtScale(getDebtValue(d)) ?? 0}
                                yScale={debtScale}
                                fill="url(#area-gradient)"
                                curve={curveMonotoneX}
                            />
                            <LinePath
                                data={data}
                                x={(d) => dateScale(getDate(d)) ?? 0}
                                y={(d) => debtScale(getDebtValue(d)) ?? 0}
                                stroke="#3b82f6"
                                strokeWidth={3}
                                curve={curveMonotoneX}
                            />
                            {forecastData.length > 0 && (
                                <LinePath
                                    data={[data[data.length - 1], ...forecastData]}
                                    x={(d) => dateScale(getDate(d)) ?? 0}
                                    y={(d) => debtScale(getDebtValue(d)) ?? 0}
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    strokeDasharray="5,5"
                                    curve={curveMonotoneX}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <AreaClosed data={data} x={d => dateScale(getDate(d))} y={d => debtScale(d.given)} yScale={debtScale} fill="url(#area-gradient)" curve={curveMonotoneX} />
                            <AreaClosed data={data} x={d => dateScale(getDate(d))} y={d => debtScale(d.received)} yScale={debtScale} fill="url(#success-gradient)" curve={curveMonotoneX} />
                            <LinePath data={data} x={d => dateScale(getDate(d))} y={d => debtScale(d.given)} stroke="#3b82f6" strokeWidth={2} curve={curveMonotoneX} />
                            <LinePath data={data} x={d => dateScale(getDate(d))} y={d => debtScale(d.received)} stroke="#22c55e" strokeWidth={2} curve={curveMonotoneX} />
                        </>
                    )}

                    <Bar
                        x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent"
                        onMouseMove={handleTooltip} onMouseLeave={() => hideTooltip()}
                    />

                    {tooltipData && (
                        <g>
                            <line
                                x1={dateScale(getDate(tooltipData))} x2={dateScale(getDate(tooltipData))}
                                y1={0} y2={innerHeight} stroke={axisColor} strokeDasharray="5,2"
                            />
                            <circle
                                cx={dateScale(getDate(tooltipData))} cy={debtScale(getMaxValue(tooltipData))}
                                r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2}
                            />
                        </g>
                    )}
                </Group>
            </svg>

            {tooltipData && (
                <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{format(getDate(tooltipData), 'dd MMM yyyy')}</div>
                    {mode === 'debt' ? (
                        <div style={{ color: '#3b82f6', fontSize: '14px', fontWeight: 700 }}>{new Intl.NumberFormat('ru-RU').format(getDebtValue(tooltipData))} ₴</div>
                    ) : (
                        <div style={{ fontSize: '12px' }}>
                            <div style={{ color: '#3b82f6' }}>Дано: {new Intl.NumberFormat('ru-RU').format(tooltipData.given)} ₴</div>
                            <div style={{ color: '#22c55e' }}>Вернула: {new Intl.NumberFormat('ru-RU').format(tooltipData.received)} ₴</div>
                            <div style={{ color: '#fff', borderTop: '1px solid #444', marginTop: '4px', paddingTop: '4px' }}>Долг: {new Intl.NumberFormat('ru-RU').format(tooltipData.debt)} ₴</div>
                        </div>
                    )}
                </TooltipWithBounds>
            )}
        </div>
    );
};

export default withTooltip(DebtChart);
