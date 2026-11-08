import { useEffect, useMemo } from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import 'moment/locale/es';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ChartLegend from '../ui/ChartLegend';
import ChartTooltip from './ChartTooltip';
import { SkeletonChart } from '../ui/Skeleton';
import { get_net_worth_history } from '../../redux/actions/fx';
import { formatMoney, formatMoneyCompact, getBaseCurrency } from '../helpers';
import { useChartColors, xAxisProps, yAxisProps, chartMargin } from './chartTheme';

// Puntos de GET /analysis/net-worth/history -> filas de la gráfica. El último es hoy (no un cierre de mes).
export const netWorthRows = (history) => {
  const points = history?.points || [];
  return points.map((p, i) => {
    const date = moment(p.date, 'YYYY-MM-DD').locale('es');
    const today = i === points.length - 1;
    const total = Number(p.total);
    const prev = i > 0 ? Number(points[i - 1].total) : null;
    return {
      key: p.date,
      label: today ? 'hoy' : date.format('MMM').replace(/\./g, ''),
      // el título del tooltip pone mayúscula a cada palabra: mismo formato que las otras gráficas
      longLabel: today ? `${date.format('MMMM YYYY')} · hoy` : date.format('MMMM YYYY'),
      value: total,
      cash: Number(p.cash_total),
      investments: Number(p.investments_total),
      credit: Number(p.credit_total),
      // con tasas faltantes en cualquiera de los dos meses la resta no es confiable
      diff: prev == null || p.missing_rates || points[i - 1].missing_rates ? null : total - prev,
      missing: p.missing_rates,
    };
  });
};

/**
 * Patrimonio al cierre de cada mes, hasta hoy: la misma cuenta de la tarjeta Patrimonio a cada fecha
 * (tarjetas por su deuda estimada entonces, inversiones por su valoración de entonces).
 * Va en Cuentas › Todo; no depende del mes elegido en la barra superior.
 */
const NetWorthChart = ({ net_worth_history, net_worth_total, get_net_worth_history }) => {
  const c = useChartColors();
  const base = net_worth_history?.base_currency || getBaseCurrency();
  // La tarjeta Patrimonio ya la pide; esto cubre cuando la gráfica se abre antes
  useEffect(() => { if (!net_worth_history) get_net_worth_history(); }, [net_worth_history, get_net_worth_history]);
  const data = useMemo(() => netWorthRows(net_worth_history), [net_worth_history]);

  if (!net_worth_history) return <SkeletonChart />;
  if (data.length < 2) {
    return (
      <div className="h-full flex items-center justify-center px-6 text-center text-sm text-ink-2 dark:text-gray-400">
        Tu historia de patrimonio empieza este mes. Desde el próximo verás cómo cambia mes a mes.
      </div>
    );
  }

  const first = data[0];
  const last = data[data.length - 1];
  const change = last.value - first.value;
  const lead = { label: `Hoy${last.missing ? '*' : ''}`, value: formatMoneyCompact(net_worth_total ?? last.value, base) };
  const items = [{
    type: 'solid', color: c.ahorro,
    label: change === 0 ? `Igual que en ${first.label}` : `${change < 0 ? 'Bajó' : 'Subió'} desde ${first.label}`,
    value: change === 0 ? null : formatMoneyCompact(Math.abs(change), base),
  }];

  const tooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <ChartTooltip
        title={p.longLabel}
        rows={[
          { label: 'Patrimonio', value: formatMoney(p.value, base), tone: p.value < 0 ? 'out' : undefined },
          p.cash ? { label: 'Efectivo', value: formatMoney(p.cash, base), color: c.balance } : null,
          p.investments ? { label: 'Inversiones', value: formatMoney(p.investments, base), color: c.inversion } : null,
          p.credit ? { label: 'Tarjetas (aprox.)', value: formatMoney(p.credit, base), color: c.crit } : null,
          p.diff != null ? { label: 'Cambio vs mes anterior', value: `${p.diff > 0 ? '+' : ''}${formatMoney(p.diff, base)}`, tone: p.diff < 0 ? 'out' : 'in' } : null,
          p.missing ? { label: '* Falta alguna tasa de cambio', value: '', tone: 'muted' } : null,
        ]}
      />
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <ChartLegend lead={lead} items={items} className="pt-2" />
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={chartMargin}>
            <defs>
              <linearGradient id="topiNetWorthFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c.ahorro} stopOpacity={0.28} />
                <stop offset="100%" stopColor={c.ahorro} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatMoneyCompact(v, base)} />
            <Tooltip content={tooltip} cursor={{ stroke: c.neutral, strokeDasharray: '3 3' }} />
            <ReferenceLine y={0} stroke={c.neutral} strokeOpacity={0.4} />
            <Area type="monotone" dataKey="value" name="Patrimonio" stroke={c.ahorro} strokeWidth={2} fill="url(#topiNetWorthFill)"
              dot={{ r: 3, fill: c.ahorro, stroke: c.surface, strokeWidth: 1 }}
              activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  net_worth_history: state.Fx?.net_worth_history,
  net_worth_total: state.Fx?.net_worth?.total,
});

export default connect(mapStateToProps, { get_net_worth_history })(NetWorthChart);
