import { useMemo } from 'react';
import { connect } from 'react-redux';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { formatMoney, formatMoneyCompact } from '../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin, monthlyRows, dailyRows, metricValue } from './chartTheme';

// Saldo en cuentas de efectivo: barras por mes o área por día.
const BalanceChart = ({ history_dash, current_Year, granularity = 'monthly' }) => {
  const c = useChartColors();

  const data = useMemo(() => {
    if (!history_dash) return [];
    if (granularity === 'daily') {
      const vals = history_dash.daily?.running_savings_balance || [];
      return dailyRows(history_dash.daily).map((r, i) => ({ ...r, value: Number(vals[i] ?? 0) }));
    }
    const vals = history_dash.monthly?.running_savings_balance || [];
    return monthlyRows(history_dash.monthly, current_Year).map((r, i) => ({
      ...r, value: metricValue(vals[i]), diff: Number(vals[i]?.diff ?? 0),
    }));
  }, [history_dash, current_Year, granularity]);

  const last = data[data.length - 1];
  const lead = last && { label: last.longLabel, value: formatMoneyCompact(last.value), tone: last.value < 0 ? 'neg' : undefined };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: 'Saldo', value: formatMoney(p.value), tone: p.value < 0 ? 'out' : undefined },
          granularity === 'monthly' && p.diff ? { label: 'Cambio vs mes anterior', value: `${p.diff > 0 ? '+' : ''}${formatMoney(p.diff)}`, tone: p.diff < 0 ? 'out' : 'in' } : null,
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend lead={lead} className="pt-2" />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {granularity === 'daily' ? (
            <AreaChart data={data} margin={chartMargin}>
              <defs>
                <linearGradient id="topiBalanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c.balance} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={c.balance} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v)} />
              <Tooltip content={tooltip} cursor={{ stroke: c.neutral, strokeDasharray: '3 3' }} />
              <ReferenceLine y={0} stroke={c.neutral} strokeOpacity={0.4} />
              <Area type="monotone" dataKey="value" stroke={c.balance} strokeWidth={2} fill="url(#topiBalanceFill)"
                activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={chartMargin}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v)} />
              <Tooltip content={tooltip} cursor={{ fill: c.neutral, fillOpacity: 0.08 }} />
              <ReferenceLine y={0} stroke={c.neutral} strokeOpacity={0.4} />
              <Bar dataKey="value" fill={c.balance} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  history_dash: state.Reports.history_dash,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps)(BalanceChart);
