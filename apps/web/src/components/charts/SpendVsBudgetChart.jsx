import { useMemo } from 'react';
import { connect } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Rectangle } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { formatMoney, formatMoneyCompact } from '../helpers';
import {
  useChartColors, xAxisProps, yAxisProps, chartMargin, monthlyRows, metricValue, isCurrentMonth, daysInMonth,
} from './chartTheme';

// Gastos por mes contra el presupuesto. En el mes en curso dibuja la proyección al cierre
// (gasto ÷ días transcurridos × días del mes) y marca con ▲ los meses que se pasaron.
//   source: 'total' (todas las categorías) | 'category' (la categoría activa en Presupuestos)
const SpendVsBudgetChart = ({ source = 'total', history_dash, history_category, current_Year }) => {
  const c = useChartColors();
  const series = source === 'category' ? history_category?.monthly : history_dash?.monthly;
  const budget = Math.abs(Number(source === 'category' ? history_category?.budget : history_dash?.expense_budget) || 0);

  const data = useMemo(() => {
    if (!series) return [];
    const today = new Date();
    return monthlyRows(series, current_Year).map((r, i) => {
      const spent = Math.abs(metricValue(series.expense?.[i]));
      const current = isCurrentMonth(r.year, r.month);
      const elapsed = today.getDate();
      const projected = current && elapsed > 0 ? (spent / elapsed) * daysInMonth(r.year, r.month) : null;
      const reference = current ? projected : spent;
      return {
        ...r,
        spent,
        current,
        projected,
        projExtra: projected && projected > spent ? projected - spent : 0,
        over: budget > 0 && reference > budget ? reference / budget - 1 : null,
      };
    });
  }, [series, current_Year, budget]);

  const last = data[data.length - 1];
  let lead = null;
  if (last) {
    if (last.current && last.projected != null && budget > 0) {
      const ok = last.projected <= budget;
      lead = { label: ok ? 'vas en camino: proyectas' : 'a este ritmo te pasas: proyectas', value: `${formatMoneyCompact(last.projected)} de ${formatMoneyCompact(budget)}`, tone: ok ? 'ok' : 'crit' };
    } else {
      lead = { label: last.longLabel.split(' ')[0], value: budget > 0 ? `${formatMoneyCompact(last.spent)} de ${formatMoneyCompact(budget)}` : formatMoneyCompact(last.spent), tone: last.over ? 'crit' : undefined };
    }
  }

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    const ref = p.current ? p.projected : p.spent;
    const diff = budget > 0 && ref != null ? budget - ref : null;
    return (
      <ChartTooltip
        title={`${p.longLabel}${p.current ? ' · en curso' : ''}`}
        rows={[
          { label: 'Gastado', value: formatMoney(p.spent), color: c.gasto, tone: 'out' },
          p.current && p.projected != null ? { label: 'Proyección al cierre', value: formatMoney(p.projected) } : null,
          budget > 0 ? { label: 'Presupuesto', value: formatMoney(budget), tone: 'muted' } : null,
          diff != null ? { label: diff < 0 ? (p.current ? 'Te pasarías por' : 'Te pasaste por') : (p.current ? 'Te sobraría' : 'Te sobró'), value: formatMoney(Math.abs(diff)), tone: diff < 0 ? 'crit' : 'ok' } : null,
        ]}
      />
    );
  };

  // Marca ▲ sobre los meses que se pasaron (forma + color, no solo color). El último mes lleva
  // además el porcentaje; en los demás el detalle está en el tooltip, así no se amontonan.
  const overLabel = ({ x, y, width, index }) => {
    const p = data[index];
    if (!p?.over) return null;
    const isLast = index === data.length - 1;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor={isLast ? 'end' : 'middle'} dx={isLast ? width / 2 : 0}
        fontSize={11} fontWeight={700} fill={c.crit}>
        {isLast ? `▲ +${Math.round(p.over * 100)}%` : '▲'}
      </text>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend
        lead={lead}
        items={[
          data.some(d => d.projExtra > 0) ? { type: 'bar', color: c.gasto, faded: true, label: 'Proyección' } : null,
          budget > 0 ? { type: 'line', label: 'Presupuesto', value: formatMoneyCompact(budget) } : null,
        ]}
        className="pt-2"
      />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ ...chartMargin, top: 22 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v)} />
            <Tooltip content={tooltip} cursor={{ fill: c.neutral, fillOpacity: 0.08 }} />
            {budget > 0 && (
              <ReferenceLine y={budget} className="topi-budget-line" stroke={c.neutral} strokeWidth={1.5} strokeDasharray="6 4" ifOverflow="extendDomain" />
            )}
            <Bar dataKey="spent" stackId="s" fill={c.gasto} maxBarSize={28} isAnimationActive={false}
              shape={(props) => <Rectangle {...props} radius={props.payload.projExtra > 0 ? [0, 0, 0, 0] : [4, 4, 0, 0]} />}
              label={(props) => (data[props.index]?.projExtra > 0 ? null : overLabel(props))} />
            <Bar dataKey="projExtra" stackId="s" fill={c.gasto} fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}
              label={(props) => (data[props.index]?.projExtra > 0 ? overLabel(props) : null)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  history_dash: state.Reports.history_dash,
  history_category: state.Reports.history_category,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps)(SpendVsBudgetChart);
