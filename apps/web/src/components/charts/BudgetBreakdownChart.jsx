import { useMemo } from 'react';
import { connect } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Rectangle } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { formatMoney, formatMoneyCompact, capitalizeWords } from '../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin, monthlyRows, metricValue } from './chartTheme';
import { niceMax } from './chartTheme';

// Presupuestos: el total del mes (gastos o ingresos, según la pestaña de la lista) es la barra de
// fondo y la categoría elegida llena su parte desde abajo. Así se ve cuánto pesa la categoría en
// el total y cómo cambia mes a mes. highlight=false muestra solo el total.
const BudgetBreakdownChart = ({
  highlight = true, history_dash, history_category, category_activated, active_report_tab,
  expenses_report, income_report, current_Year,
}) => {
  const c = useChartColors();
  const isIncome = active_report_tab !== 'Expenses';
  const color = isIncome ? c.ingreso : c.gasto;
  const list = (isIncome ? income_report : expenses_report) || [];
  // Solo se resalta si la categoría pertenece a la lista que se está viendo (gastos o ingresos)
  const catOk = highlight && category_activated && list.some(x => x.category_id === category_activated.category_id) && history_category?.monthly;
  const catName = catOk ? capitalizeWords(category_activated.name) : null;
  const totalBudget = Math.abs(Number(isIncome ? history_dash?.income_budget : history_dash?.expense_budget) || 0);
  const catBudget = catOk ? Math.abs(Number(history_category?.budget) || 0) : 0;

  const data = useMemo(() => {
    const m = history_dash?.monthly;
    if (!m) return [];
    const totals = isIncome ? m.income : m.expense;
    const catByKey = new Map();
    if (catOk) {
      monthlyRows(history_category.monthly, current_Year).forEach((r, i) => {
        catByKey.set(r.key, Math.abs(metricValue(history_category.monthly.expense?.[i])));
      });
    }
    return monthlyRows(m, current_Year).map((r, i) => {
      const total = Math.abs(metricValue(totals?.[i]));
      const cat = catOk ? Math.min(catByKey.get(r.key) ?? 0, total || Infinity) : 0;
      return { ...r, total, cat, rest: Math.max(total - cat, 0), share: total > 0 ? cat / total : 0 };
    });
  }, [history_dash, history_category, catOk, isIncome, current_Year]);

  const last = data[data.length - 1];
  const month = last?.longLabel.split(' ')[0];
  let lead = null;
  if (last && catOk) {
    lead = {
      label: `${catName} en ${month} (${Math.round(last.share * 100)}% del total)`,
      value: catBudget > 0 ? `${formatMoneyCompact(last.cat)} de ${formatMoneyCompact(catBudget)}` : formatMoneyCompact(last.cat),
      tone: !isIncome && catBudget > 0 && last.cat > catBudget ? 'crit' : undefined,
    };
  } else if (last) {
    lead = {
      label: `${isIncome ? 'ingresos' : 'gasto total'} en ${month}`,
      value: totalBudget > 0 ? `${formatMoneyCompact(last.total)} de ${formatMoneyCompact(totalBudget)}` : formatMoneyCompact(last.total),
      tone: !isIncome && totalBudget > 0 && last.total > totalBudget ? 'crit' : undefined,
    };
  }

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: isIncome ? 'Ingresos totales' : 'Gasto total', value: formatMoney(p.total), color, tone: isIncome ? 'in' : 'out' },
          catOk && { label: `${catName} · ${Math.round(p.share * 100)}%`, value: formatMoney(p.cat), color },
          catOk && catBudget > 0 && { label: `Presupuesto ${catName}`, value: formatMoney(catBudget), tone: 'muted' },
          totalBudget > 0 && { label: 'Presupuesto total', value: formatMoney(totalBudget), tone: 'muted' },
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend
        lead={lead}
        items={[
          catOk ? { type: 'bar', color, label: catName } : null,
          catOk ? { type: 'bar', color, faded: true, label: 'Resto' } : null,
          catOk && catBudget > 0 ? { type: 'line', color, label: `Presup. ${catName}` } : null,
          totalBudget > 0 ? { type: 'line', label: 'Presup. total' } : null,
        ]}
        className="pt-2"
      />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickCount={4} domain={[0, (dataMax) => niceMax(dataMax, totalBudget, catBudget)]} tickFormatter={(v) => formatMoneyCompact(v)} />
            <Tooltip content={tooltip} cursor={{ fill: c.neutral, fillOpacity: 0.08 }} />
            {totalBudget > 0 && (
              <ReferenceLine y={totalBudget} className="topi-budget-line" stroke={c.neutral} strokeWidth={1.5} strokeDasharray="6 4" />
            )}
            {catOk && catBudget > 0 && (
              <ReferenceLine y={catBudget} stroke={color} strokeWidth={1.5} strokeDasharray="4 4" strokeOpacity={0.9} />
            )}
            {/* La categoría abajo (sólida) y el resto del total encima (tenue): una sola barra por mes */}
            <Bar dataKey={catOk ? 'cat' : 'total'} stackId="b" fill={color} maxBarSize={28} isAnimationActive={false}
              shape={(props) => <Rectangle {...props} radius={catOk && props.payload.rest > 0 ? [0, 0, 0, 0] : [4, 4, 0, 0]} />} />
            {catOk && (
              <Bar dataKey="rest" stackId="b" fill={color} fillOpacity={0.28} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  history_dash: state.Reports.history_dash,
  history_category: state.Reports.history_category,
  category_activated: state.Reports.category_activated,
  expenses_report: state.Reports.expenses_report,
  income_report: state.Reports.income_report,
  active_report_tab: state.UI.active_report_tab,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps)(BudgetBreakdownChart);
