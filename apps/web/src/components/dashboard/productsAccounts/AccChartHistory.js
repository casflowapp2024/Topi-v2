import { useMemo } from 'react';
import { connect } from 'react-redux';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ChartTooltip from '../../charts/ChartTooltip';
import ChartLegend from '../../ui/ChartLegend';
import { formatMoney, formatMoneyCompact, accountClass } from '../../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin, monthlyRows, metricValue } from '../../charts/chartTheme';

// Saldo histórico de la cuenta elegida, en su moneda. Color por clase de cuenta:
// efectivo = azul, inversión = teal, tarjeta (deuda) = coral.
function AccChartHistory({ history_month, current_Year, account_activated }) {
  const c = useChartColors();
  const cls = accountClass(account_activated);
  const color = cls === 'investment' ? c.inversion : cls === 'credit' ? c.gasto : c.balance;
  const currency = account_activated?.currency;

  const data = useMemo(() => {
    if (!history_month?.month) return [];
    return monthlyRows(history_month, current_Year).map((r, i) => ({
      ...r,
      value: metricValue(history_month.balance?.[i]),
      diff: Number(history_month.balance?.[i]?.diff ?? 0),
    }));
  }, [history_month, current_Year]);

  const last = data[data.length - 1];
  const lead = last && {
    label: cls === 'credit' ? `deuda en ${last.longLabel.split(' ')[0]}` : last.longLabel,
    value: formatMoneyCompact(cls === 'credit' ? Math.abs(last.value) : last.value, currency),
    tone: cls !== 'credit' && last.value < 0 ? 'neg' : undefined,
  };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: cls === 'credit' ? 'Deuda' : 'Saldo', value: formatMoney(cls === 'credit' ? Math.abs(p.value) : p.value, currency), color },
          p.diff ? { label: 'Cambio vs mes anterior', value: `${p.diff > 0 ? '+' : ''}${formatMoney(p.diff, currency)}`, tone: p.diff < 0 ? 'out' : 'in' } : null,
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend lead={lead} className="px-0 pb-1" />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargin}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v, currency)} />
            <Tooltip content={tooltip} cursor={{ fill: c.neutral, fillOpacity: 0.08 }} />
            <ReferenceLine y={0} stroke={c.neutral} strokeOpacity={0.4} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const mapStateToProps = state => ({
  history_month: state.Reports.history_accounts_by_month?.monthly,
  current_Year: state.Reports.current_Year,
  account_activated: state.Reports.account_activated,
});

export default connect(mapStateToProps)(AccChartHistory);
