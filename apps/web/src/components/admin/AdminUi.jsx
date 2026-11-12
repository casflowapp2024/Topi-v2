import { useCallback, useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import Card, { CardHeader } from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import ChartTooltip from '../charts/ChartTooltip';
import { useChartColors, xAxisProps, yAxisProps, chartMargin } from '../charts/chartTheme';
import { getAdminMetric, isForbidden } from '../../apiCalls/admin';

// Formatos del panel: enteros y porcentajes en es-CO (el dinero va con formatMoney de helpers)
const intFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
export const fmtInt = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : intFmt.format(Number(v)));
export const fmtPct = (v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? '—' : `${decFmt.format(Number(v))} %`);
export const pct = (part, total) => (Number(total) > 0 ? (100 * Number(part)) / Number(total) : null);

const dayFmt = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtDay = (day) => {
  if (!day) return '—';
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? day : dayFmt.format(d);
};
const dateTimeFmt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFmt.format(d);
};
export const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(d);
};

/** Carga una sección del panel; `forbidden` si la sesión no es de un admin. */
export const useAdminMetric = (section, reloadKey = 0) => {
  const [state, setState] = useState({ data: null, loading: true, error: null, forbidden: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await getAdminMetric(section);
      setState({ data, loading: false, error: null, forbidden: false });
    } catch (err) {
      setState({ data: null, loading: false, error: err, forbidden: isForbidden(err) });
    }
  }, [section]);
  useEffect(() => { load(); }, [load, reloadKey]);
  return state;
};

/** Cifra grande con etiqueta y una línea de contexto. */
export const Stat = ({ label, value, hint, tone }) => (
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-xs font-medium text-ink-2 dark:text-gray-400 truncate">{label}</span>
    <span className={`text-2xl font-bold tabular-nums ${tone === 'warn' ? 'text-status-warn-text dark:text-amber-300' : tone === 'crit' ? 'text-status-crit-text dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
    {hint && <span className="text-xs text-ink-2 dark:text-gray-400">{hint}</span>}
  </div>
);

export const StatGrid = ({ children, className = '' }) => (
  <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>{children}</div>
);

export const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <Card className={className}>
    <CardHeader title={title} subtitle={subtitle} action={action} />
    {children}
  </Card>
);

export const PanelSkeleton = ({ rows = 3 }) => (
  <div className="flex flex-col gap-4" role="status" aria-label="Cargando">
    {Array.from({ length: rows }).map((_, i) => (
      <Card key={i}><Skeleton className="h-4 w-1/3 mb-4" /><Skeleton className="h-24 w-full" /></Card>
    ))}
  </div>
);

export const PanelError = ({ state }) => (
  <Card>
    <p className="text-sm text-status-crit-text dark:text-red-400">
      {state.forbidden ? 'Esta sección es solo para administradores.' : 'No se pudo cargar esta sección. Intenta de nuevo.'}
    </p>
  </Card>
);

/** Rellena con 0 los días sin fila entre el primer y el último día pedidos. */
// Hoy en Bogotá (los días de las métricas son de America/Bogota, no del navegador ni UTC)
export const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export const fillDays = (series = {}, keys = [], days = 90, end = null) => {
  const last = new Date(`${end || todayBogota()}T00:00:00Z`);
  const rows = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() - i));
    const day = d.toISOString().slice(0, 10);
    const row = { day };
    keys.forEach((k) => { row[k] = 0; });
    rows.push(row);
  }
  const index = Object.fromEntries(rows.map((r, i) => [r.day, i]));
  keys.forEach((k) => (series[k] || []).forEach((p) => {
    if (index[p.day] !== undefined) rows[index[p.day]][k] = p.value;
  }));
  return rows;
};

const tooltip = (lines) => ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip title={fmtDay(label)} rows={payload.map((p) => ({
      label: lines.find((l) => l.key === p.dataKey)?.label || p.dataKey, value: fmtInt(p.value), color: p.color,
    }))} />
  );
};

/** Líneas por día. lines: [{ key, label, color }] (color = clave de useChartColors). */
export const DailyLines = ({ rows, lines, height = 220 }) => {
  const colors = useChartColors();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={chartMargin}>
          <CartesianGrid vertical={false} stroke={colors.neutral} strokeOpacity={0.15} />
          <XAxis dataKey="day" tickFormatter={fmtDay} {...xAxisProps} stroke={colors.neutral} />
          <YAxis allowDecimals={false} {...yAxisProps} stroke={colors.neutral} />
          <Tooltip content={tooltip(lines)} />
          {lines.length > 1 && <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} formatter={(v) => lines.find((l) => l.key === v)?.label || v} />}
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} stroke={colors[l.color] || colors.balance} strokeWidth={2}
              dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Barras apiladas por día. */
export const DailyBars = ({ rows, bars, height = 220 }) => {
  const colors = useChartColors();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={chartMargin}>
          <CartesianGrid vertical={false} stroke={colors.neutral} strokeOpacity={0.15} />
          <XAxis dataKey="day" tickFormatter={fmtDay} {...xAxisProps} stroke={colors.neutral} />
          <YAxis allowDecimals={false} {...yAxisProps} stroke={colors.neutral} />
          <Tooltip content={tooltip(bars)} cursor={{ fill: colors.neutral, fillOpacity: 0.08 }} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} formatter={(v) => bars.find((b) => b.key === v)?.label || v} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} stackId="s" fill={colors[b.color] || colors.balance} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Lista con barra proporcional: [{ name, value, hint }]. */
export const BarList = ({ items, empty = 'Sin datos', format = fmtInt }) => {
  const max = Math.max(1, ...items.map((i) => Number(i.value) || 0));
  if (!items.length) return <p className="text-sm text-ink-2 dark:text-gray-400 py-2">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-gray-800 dark:text-gray-200">{item.name}</span>
            <span className="shrink-0 tabular-nums font-semibold text-gray-900 dark:text-gray-100">
              {format(item.value)}{item.hint && <span className="ml-1 font-normal text-xs text-ink-2 dark:text-gray-400">{item.hint}</span>}
            </span>
          </div>
          <span className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full bg-topi-500 dark:bg-topi-200" style={{ width: `${(100 * (Number(item.value) || 0)) / max}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
};

/** Tabla simple y accesible; columns: [{ key, label, align, render }]. Se desplaza en horizontal en el celular. */
export const SimpleTable = ({ columns, rows, rowKey, empty = 'Sin datos' }) => (
  <div className="overflow-x-auto -mx-4 px-4">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-2 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
          {columns.map((c) => (
            <th key={c.key} scope="col" className={`py-2 pr-3 font-medium whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={columns.length} className="py-4 text-ink-2 dark:text-gray-400">{empty}</td></tr>
        )}
        {rows.map((row, i) => (
          <tr key={rowKey ? rowKey(row) : i} className="border-b border-gray-100 dark:border-gray-700/60 last:border-0">
            {columns.map((c) => (
              <td key={c.key} className={`py-2 pr-3 whitespace-nowrap text-gray-800 dark:text-gray-200 ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
