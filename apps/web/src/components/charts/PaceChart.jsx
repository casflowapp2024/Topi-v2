import { useMemo } from 'react';
import { connect } from 'react-redux';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { formatMoney, formatMoneyCompact } from '../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin, dailyRows, isCurrentMonth, daysInMonth } from './chartTheme';

// Ritmo de gasto del mes: gasto acumulado día a día contra la línea ideal que llega justo al
// presupuesto el último día. La distancia entre las dos es la respuesta a "¿voy bien?".
const PaceChart = ({ history_dash, current_Year, current_Month }) => {
  const c = useChartColors();
  const budget = Math.abs(Number(history_dash?.expense_budget) || 0);

  const { data, todayPoint, gap } = useMemo(() => {
    const daily = history_dash?.daily;
    if (!daily) return { data: [], todayPoint: null, gap: null };
    const total = daysInMonth(current_Year, current_Month);
    const cum = daily.mtd_expense || [];
    const rows = dailyRows(daily).filter(r => r.date.getMonth() + 1 === Number(current_Month));
    const byDay = new Map(rows.map((r) => [r.day, r]));
    const idxByKey = new Map((daily.date || []).map((d, i) => [d, i]));
    const current = isCurrentMonth(current_Year, current_Month);
    const lastDay = current ? new Date().getDate() : total;

    const data = [];
    let lastSpent = 0;
    for (let d = 1; d <= total; d += 1) {
      const r = byDay.get(d);
      if (r) lastSpent = Math.abs(Number(cum[idxByKey.get(r.key)] ?? lastSpent));
      data.push({
        day: d,
        label: String(d),
        longLabel: `${d} de ${new Date(current_Year, current_Month - 1, 1).toLocaleString('es-CO', { month: 'long' })}`,
        spent: d <= lastDay ? lastSpent : null,
        ideal: budget > 0 ? (budget * d) / total : null,
      });
    }
    const tp = data[lastDay - 1];
    return { data, todayPoint: tp, gap: tp && tp.ideal != null ? tp.spent - tp.ideal : null };
  }, [history_dash, current_Year, current_Month, budget]);

  const ahead = gap != null && gap > 0;
  const statusColor = gap == null ? c.gasto : ahead ? c.warn : c.ok;
  const lead = gap != null
    ? { label: ahead ? 'vas por encima del ritmo' : 'vas por debajo del ritmo', value: formatMoneyCompact(Math.abs(gap)), tone: ahead ? 'warn' : 'ok' }
    : todayPoint && { label: 'gastado en el mes', value: formatMoneyCompact(todayPoint.spent) };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    if (p.spent == null) {
      return <ChartTooltip title={p.longLabel} rows={[p.ideal != null && { label: 'Ritmo ideal', value: formatMoney(p.ideal), tone: 'muted' }]} />;
    }
    const diff = p.ideal != null ? p.spent - p.ideal : null;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: 'Gastado', value: formatMoney(p.spent), color: c.gasto, tone: 'out' },
          p.ideal != null && { label: 'Ritmo ideal', value: formatMoney(p.ideal), tone: 'muted' },
          diff != null && { label: diff > 0 ? 'Por encima' : 'Por debajo', value: formatMoney(Math.abs(diff)), tone: diff > 0 ? 'warn' : 'ok' },
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend
        lead={lead}
        items={[budget > 0 ? { type: 'line', label: 'Ritmo ideal hasta', value: formatMoneyCompact(budget) } : null]}
        className="pt-2"
      />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ ...chartMargin, right: 20 }}>
            <defs>
              <linearGradient id="topiPaceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={statusColor} stopOpacity={0.25} />
                <stop offset="100%" stopColor={statusColor} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} ticks={['1', '8', '15', '22', String(data.length)]} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v)} />
            <Tooltip content={tooltip} cursor={{ stroke: c.neutral, strokeDasharray: '3 3' }} />
            {budget > 0 && (
              <Line dataKey="ideal" stroke={c.neutral} strokeWidth={1.5} strokeDasharray="6 4" dot={false} activeDot={false} isAnimationActive={false} />
            )}
            <Area type="monotone" dataKey="spent" stroke={c.gasto} strokeWidth={2.25} fill="url(#topiPaceFill)" connectNulls={false}
              dot={false} activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
            {todayPoint && todayPoint.spent != null && (
              <ReferenceDot x={todayPoint.label} y={todayPoint.spent} r={5} fill={c.gasto} stroke={c.surface} strokeWidth={2} />
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

export default connect(mapStateToProps)(PaceChart);
