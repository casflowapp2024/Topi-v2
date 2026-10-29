import { useMemo } from 'react';
import { connect } from 'react-redux';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { formatMoney, formatMoneyCompact } from '../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin, monthlyRows, metricValue } from './chartTheme';

// Flujo del mes: ingresos hacia arriba, gastos hacia abajo, en el mismo eje, y el ahorro neto
// (ingresos − gastos) como punto. Las transferencias y valoraciones no entran (las excluye la API).
const FlowChart = ({ history_dash, current_Year }) => {
  const c = useChartColors();

  const data = useMemo(() => {
    const m = history_dash?.monthly;
    if (!m) return [];
    return monthlyRows(m, current_Year).map((r, i) => {
      const income = Math.abs(metricValue(m.income?.[i]));
      const expense = Math.abs(metricValue(m.expense?.[i]));
      return { ...r, income, expense: -expense, net: income - expense };
    });
  }, [history_dash, current_Year]);

  const last = data[data.length - 1];
  const lead = last && {
    label: `ahorro neto en ${last.longLabel.split(' ')[0]}`,
    value: formatMoneyCompact(last.net),
    tone: last.net < 0 ? 'neg' : 'ok',
  };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: 'Ingresos', value: formatMoney(p.income), color: c.ingreso, tone: 'in' },
          { label: 'Gastos', value: formatMoney(Math.abs(p.expense)), color: c.gasto, tone: 'out' },
          { label: 'Ahorro neto', value: formatMoney(p.net), color: c.ahorro, tone: p.net < 0 ? 'out' : 'in' },
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend
        lead={lead}
        items={[
          { type: 'bar', color: c.ingreso, label: 'Ingresos' },
          { type: 'bar', color: c.gasto, label: 'Gastos' },
          { type: 'dot', color: c.ahorro, label: 'Ahorro neto' },
        ]}
        className="pt-2"
      />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={chartMargin} stackOffset="sign" barGap={0}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v)} />
            <Tooltip content={tooltip} cursor={{ fill: c.neutral, fillOpacity: 0.08 }} />
            <ReferenceLine y={0} stroke={c.neutral} strokeOpacity={0.5} />
            <Bar dataKey="income" stackId="flow" fill={c.ingreso} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            <Bar dataKey="expense" stackId="flow" fill={c.gasto} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            <Line dataKey="net" stroke="none" isAnimationActive={false} legendType="circle"
              dot={{ r: 4.5, fill: c.ahorro, stroke: c.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: c.ahorro, stroke: c.surface, strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  history_dash: state.Reports.history_dash,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps)(FlowChart);
