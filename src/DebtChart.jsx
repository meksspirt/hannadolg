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

    // bounds
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // scales
    const dateScale = useMemo(
        () =>
            scaleTime({
                range: [0, innerWidth],
                domain: extent(data, getDate) || [new Date(), new Date()],
            }),
        [innerWidth, data],
    );

    const debtScale = useMemo(
        () =>
            scaleLinear({
                range: [innerHeight, 0],
                domain: [0, (max(data, getDebtValue) || 0) * 1.1],
                nice: true,
            }),
        [innerHeight, data],
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
                tooltipTop: debtScale(getDebtValue(d)) + margin.top,
            });
        },
        [showTooltip, debtScale, dateScale, data, margin.left, margin.top],
    );

    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';

    return (
        <div style={{ position: 'relative' }}>
            <svg width={width} height={height}>
                <LinearGradient id="area-gradient" from="#3b82f6" fromOpacity={0.3} to="#3b82f6" toOpacity={0} />
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
                            fontSize: 11,
                            textAnchor: 'middle',
                        })}
                        numTicks={width > 500 ? 5 : 3}
                    />

                    <AxisLeft
                        scale={debtScale}
                        stroke={axisColor}
                        tickStroke={axisColor}
                        tickLabelProps={() => ({
                            fill: axisColor,
                            fontSize: 11,
                            textAnchor: 'end',
                            dx: -4,
                            dy: 4,
                        })}
                        tickFormat={(v) => `${(v / 1000).toFixed(0)}k`}
                    />

                    <AreaClosed
                        data={data}
                        x={(d) => dateScale(getDate(d)) ?? 0}
                        y={(d) => debtScale(getDebtValue(d)) ?? 0}
                        yScale={debtScale}
                        strokeWidth={0}
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

                    <Bar
                        x={0}
                        y={0}
                        width={innerWidth}
                        height={innerHeight}
                        fill="transparent"
                        rx={14}
                        onTouchStart={handleTooltip}
                        onTouchMove={handleTooltip}
                        onMouseMove={handleTooltip}
                        onMouseLeave={() => hideTooltip()}
                    />

                    {tooltipData && (
                        <g>
                            <line
                                x1={dateScale(getDate(tooltipData))}
                                x2={dateScale(getDate(tooltipData))}
                                y1={0}
                                y2={innerHeight}
                                stroke="rgba(59, 130, 246, 0.5)"
                                strokeWidth={1}
                                pointerEvents="none"
                                strokeDasharray="5,2"
                            />
                            <circle
                                cx={dateScale(getDate(tooltipData))}
                                cy={debtScale(getDebtValue(tooltipData))}
                                r={6}
                                fill="#3b82f6"
                                stroke="#fff"
                                strokeWidth={2}
                                pointerEvents="none"
                            />
                        </g>
                    )}
                </Group>
            </svg>

            {tooltipData && (
                <div>
                    <TooltipWithBounds
                        key={Math.random()}
                        top={tooltipTop - 12}
                        left={tooltipLeft + 12}
                        style={tooltipStyles}
                    >
                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                            {format(getDate(tooltipData), 'dd MMM yyyy')}
                        </div>
                        <div style={{ color: '#3b82f6', fontSize: '14px', fontWeight: 700 }}>
                            {new Intl.NumberFormat('ru-RU').format(getDebtValue(tooltipData))} ₴
                        </div>
                    </TooltipWithBounds>
                </div>
            )}
        </div>
    );
};

export default withTooltip(DebtChart);
