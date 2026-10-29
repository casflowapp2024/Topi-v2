import { useMemo } from 'react';
import { connect } from 'react-redux';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, ReferenceLine } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { formatMoney, formatMoneyCompact } from '../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin, dailyRows, isCurrentMonth, daysInMonth } from './chartTheme';
import { niceMax } from './chartTheme';

// Proyección del gasto del mes: lo gastado día a día (área) y, desde hoy, cómo cerraría el mes si
// sigue al mismo ritmo (línea punteada), contra el presupuesto (línea horizontal).
// En un mes pasado muestra cómo cerró, sin proyección.
const ProjectionChart = ({ history_dash, current_Year, current_Month }) => {
  const c = useChartColors();
  const budget = Math.abs(Number(history_dash?.expense_budget) || 0);

  const m = useMemo(() => {
    const daily = history_dash?.daily;
    if (!daily) return null;
    const total = daysInMonth(current_Year, current_Month);
    const cum = daily.mtd_expense || [];
    const idxByKey = new Map((daily.date || []).map((d, i) => [d, i]));
    const byDay = new Map(dailyRows(daily)
      .filter(r => r.date.getMonth() + 1 === Number(current_Month))
      .map(r => [r.day, r]));
    const current = isCurrentMonth(current_Year, current_Month);
    const lastDay = current ? new Date().getDate() : total;
    const monthName = new Date(current_Year, current_Month - 1, 1).toLocaleString('es-CO', { month: 'long' });

    const data = [];
    let spentSoFar = 0;
    for (let d = 1; d <= lastDay; d += 1) {
      const r = byDay.get(d);
      if (r) spentSoFar = Math.abs(Number(cum[idxByKey.get(r.key)] ?? spentSoFar));
      data.push({ day: d, label: String(d), longLabel: `${d} de ${monthName}`, spent: spentSoFar, projected: null });
    }
    const rate = lastDay > 0 ? spentSoFar / lastDay : 0;
    const showProjection = current && lastDay < total;
    if (showProjection) {
      data[lastDay - 1].projected = spentSoFar; // une la línea punteada con hoy
      for (let d = lastDay + 1; d <= total; d += 1) {
        data.push({ day: d, label: String(d), longLabel: `${d} de ${monthName}`, spent: null, projected: spentSoFar + rate * (d - lastDay) });
      }
    }
    const closing = showProjection ? spentSoFar + rate * (total - lastDay) : spentSoFar;
    // Día en que, a este ritmo, se acabaría el presupuesto (si pasa este mes)
    const crossDay = budget > 0 && rate > 0 && spentSoFar < budget ? Math.ceil(budget / rate) : null;
    return {
      data, total, lastDay, current, showProjection, closing, spentSoFar,
      crossDay: crossDay && crossDay <= total ? crossDay : null,
      todayLabel: String(lastDay),
    };
  }, [history_dash, current_Year, current_Month, budget]);

  if (!m) return null;
  const over = budget > 0 && m.closing > budget;
  const vs = budget > 0 ? ` de ${formatMoneyCompact(budget)}` : '';
  const lead = m.showProjection
    ? {
      label: over ? (m.crossDay ? `a este ritmo te pasas el día ${m.crossDay}: cerrarías en` : 'a este ritmo cerrarías en') : 'a este ritmo cerrarías en',
      value: `${formatMoneyCompact(m.closing)}${vs}`,
      tone: budget > 0 ? (over ? 'crit' : 'ok') : undefined,
    }
    : { label: m.current ? 'gastado en el mes' : 'cerraste el mes en', value: `${formatMoneyCompact(m.closing)}${vs}`, tone: budget > 0 ? (over ? 'crit' : 'ok') : undefined };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const value = p.spent ?? p.projected;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          p.spent != null
            ? { label: 'Gastado hasta ese día', value: formatMoney(p.spent), color: c.gasto, tone: 'out' }
            : { label: 'Proyección', value: formatMoney(p.projected), color: c.gasto },
          budget > 0 && { label: 'Presupuesto', value: formatMoney(budget), tone: 'muted' },
          budget > 0 && { label: value > budget ? 'Por encima' : 'Disponible', value: formatMoney(Math.abs(budget - value)), tone: value > budget ? 'crit' : 'ok' },
        ]}
      />
    );
  };

  const ticks = [1, 8, 15, 22, m.total].map(String);
  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend
        lead={lead}
        items={[
          m.showProjection ? { type: 'line', label: 'Proyección', color: c.gasto, projection: true } : null,
          budget > 0 ? { type: 'line', label: 'Presupuesto', value: formatMoneyCompact(budget) } : null,
        ]}
        className="pt-2"
      />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={m.data} margin={{ ...chartMargin, right: 20 }}>
            <defs>
              <linearGradient id="topiSpentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.gasto} stopOpacity={0.25} />
                <stop offset="100%" stopColor={c.gasto} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} ticks={ticks} />
            <YAxis {...yAxisProps} tickCount={4} domain={[0, (dataMax) => niceMax(dataMax, budget)]} tickFormatter={(v) => formatMoneyCompact(v)} />
            <Tooltip content={tooltip} cursor={{ stroke: c.neutral, strokeDasharray: '3 3' }} />
            {budget > 0 && (
              <ReferenceLine y={budget} className="topi-budget-line" stroke={c.neutral} strokeWidth={1.5} strokeDasharray="6 4" />
            )}
            <Area type="monotone" dataKey="spent" stroke={c.gasto} strokeWidth={2.25} fill="url(#topiSpentFill)" connectNulls={false}
              dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
            {m.showProjection && (
              <Line dataKey="projected" stroke={c.gasto} strokeWidth={2} strokeDasharray="5 4" strokeOpacity={0.8} dot={false}
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            )}
            {m.current && (
              <ReferenceDot x={m.todayLabel} y={m.spentSoFar} r={5} fill={c.gasto} stroke={c.surface} strokeWidth={2} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  history_dash: state.Reports.history_dash,
  current_Year: state.Reports.current_Year,
  current_Month: state.Reports.current_Month,
});

export default connect(mapStateToProps)(ProjectionChart);
