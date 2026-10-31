import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment-timezone';
import { fetch_credit_card_cycles } from '../../../redux/actions/creditCards';
import ChartTooltip from '../../charts/ChartTooltip';
import ChartLegend from '../../ui/ChartLegend';
import { formatMoney, formatMoneyCompact } from '../../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin } from '../../charts/chartTheme';

// Compras de cada corte junto a lo que se pagó después de ese corte. La diferencia acumulada es lo
// pagado por encima de lo comprado: intereses, seguros y cuotas, pero también compras que no
// llegaron por correo. Se lee como tendencia: mes a mes las cuotas la mueven mucho.
// Sin día de corte no hay cortes: se muestra `fallback`.
const CardCyclesChart = ({ account, fallback = null }) => {
  const c = useChartColors();
  const currency = account?.currency || 'COP';
  const [report, setReport] = useState(null); // null = cargando

  useEffect(() => {
    let active = true;
    setReport(null);
    if (account?.id) fetch_credit_card_cycles(account.id).then(r => { if (active) setReport(r || { cycles: [] }); });
    return () => { active = false; };
  }, [account?.id]);

  const data = useMemo(() => (report?.cycles || []).map(r => ({
    label: moment(r.statement_date).format('MMM'),
    longLabel: `Corte del ${moment(r.statement_date).format('DD-MM-YYYY')}`,
    purchases: Number(r.purchases),
    payments: Number(r.payments),
    diff: Number(r.payments) - Number(r.purchases),
    counted: r.counted,
  })), [report]);

  if (report === null) return null;
  if (data.length === 0) return fallback;

  const overpaid = Number(report.overpaid);
  const counted = data.filter(r => r.counted).length;
  const lead = counted > 0 && {
    label: overpaid >= 0 ? 'pagado por encima de tus compras' : 'pagado por debajo de tus compras',
    value: formatMoneyCompact(Math.abs(overpaid), currency),
    tone: overpaid > 0 ? 'warn' : undefined,
  };

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: 'Compras y cargos', value: formatMoney(p.purchases, currency), color: c.gasto },
          { label: 'Pagado después del corte', value: formatMoney(p.payments, currency), color: c.ingreso },
          p.counted ? { label: 'Diferencia', value: `${p.diff > 0 ? '+' : ''}${formatMoney(p.diff, currency)}`, tone: p.diff > 0 ? 'warn' : 'muted' } : null,
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend lead={lead} className="px-0 pb-1"
        items={[
          { type: 'bar', color: c.gasto, label: 'Compras' },
          { type: 'bar', color: c.ingreso, label: 'Pagos' },
        ]} />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={chartMargin} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v, currency)} />
            <Tooltip content={tooltip} cursor={{ fill: c.neutral, fillOpacity: 0.08 }} />
            <Bar dataKey="purchases" fill={c.gasto} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="payments" fill={c.ingreso} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CardCyclesChart;
