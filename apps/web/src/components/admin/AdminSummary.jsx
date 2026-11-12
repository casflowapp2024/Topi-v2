import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import Card from '../ui/Card';
import ChartTooltip from '../charts/ChartTooltip';
import { useChartColors, xAxisProps, yAxisProps, chartMargin } from '../charts/chartTheme';
import {
  useAdminMetric, Panel, PanelSkeleton, PanelError, Stat, StatGrid, DailyLines, SimpleTable,
  fmtInt, fmtPct, fmtDay, fmtDateTime, pct,
} from './AdminUi';

const NorthStarTrend = ({ points }) => {
  const colors = useChartColors();
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={chartMargin}>
          <CartesianGrid vertical={false} stroke={colors.neutral} strokeOpacity={0.15} />
          <XAxis dataKey="day" tickFormatter={fmtDay} {...xAxisProps} stroke={colors.neutral} />
          <YAxis allowDecimals={false} {...yAxisProps} stroke={colors.neutral} />
          <Tooltip content={({ active, payload, label }) => (active && payload?.length
            ? <ChartTooltip title={`7 días al ${fmtDay(label)}`} rows={[{ label: 'Usuarios al día', value: fmtInt(payload[0].value), color: colors.balance }]} />
            : null)} />
          <Line type="monotone" dataKey="value" stroke={colors.balance} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const delta = (now, before) => {
  const d = Number(now) - Number(before);
  if (!Number.isFinite(d) || d === 0) return 'igual que hace 7 días';
  return `${d > 0 ? '+' : ''}${fmtInt(d)} vs. hace 7 días`;
};

const TreeRow = ({ label, value, hint }) => (
  <li className="flex items-baseline justify-between gap-3 py-2 border-b border-gray-100 dark:border-gray-700/60 last:border-0">
    <span className="text-sm text-gray-800 dark:text-gray-200">{label}{hint && <span className="block text-xs text-ink-2 dark:text-gray-400">{hint}</span>}</span>
    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
  </li>
);

const cohortCell = (part, eligible) => (eligible > 0 ? `${fmtPct(pct(part, eligible))} (${fmtInt(part)}/${fmtInt(eligible)})` : '—');

const AdminSummary = ({ reloadKey }) => {
  const summary = useAdminMetric('summary', reloadKey);
  const cohorts = useAdminMetric('cohorts', reloadKey);
  const activation = useAdminMetric('activation', reloadKey);

  if (summary.loading && !summary.data) return <PanelSkeleton rows={3} />;
  if (summary.error) return <PanelError state={summary} />;
  const s = summary.data;
  const t = s.tree || {};
  const a = t.activation || {};

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-64 shrink-0 flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-topi-600 dark:text-topi-200">North Star</span>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usuarios al día semanales</h2>
            <span className="text-5xl font-bold tabular-nums text-gray-900 dark:text-gray-100 mt-1">{fmtInt(s.north_star)}</span>
            <span className="text-sm text-ink-2 dark:text-gray-400">{delta(s.north_star, s.north_star_before)}</span>
            <p className="text-xs text-ink-2 dark:text-gray-400 mt-2">
              En los 7 días al {fmtDay(s.as_of)}: recibieron al menos una transacción leída de su correo <b>y</b> abrieron la app.
              {' '}{fmtInt(s.auto_users_7d)} recibieron lecturas en ese lapso.
            </p>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink-2 dark:text-gray-400 mb-1">Tendencia de 12 semanas</p>
            <NorthStarTrend points={s.north_star_trend || []} />
          </div>
        </div>
      </Card>

      <Panel title="Usuarios activos" subtitle={`Días con la app abierta · calculado ${fmtDateTime(s.computed_at)}`}>
        <StatGrid className="mb-4">
          <Stat label="DAU" value={fmtInt(s.dau)} hint={`el ${fmtDay(s.as_of)}`} />
          <Stat label="WAU" value={fmtInt(s.wau)} hint="7 días" />
          <Stat label="MAU" value={fmtInt(s.mau)} hint="30 días" />
          <Stat label="Registros" value={fmtInt(s.signups_30d)} hint={`${fmtInt(s.signups_7d)} en 7 días · ${fmtInt(s.total_users)} en total`} />
        </StatGrid>
        <DailyLines rows={mergeActive(s.active_trend)} lines={[
          { key: 'dau', label: 'DAU', color: 'neutral' },
          { key: 'wau', label: 'WAU', color: 'ingreso' },
          { key: 'mau', label: 'MAU', color: 'balance' },
        ]} />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Árbol de métricas" subtitle="Lo que mueve la North Star (30 días)">
          <ul>
            <TreeRow label="Activación: correo conectado en 24 h" value={fmtPct(a.connection_24h_pct)} hint={`${fmtInt(a.signups)} registros en 90 días`} />
            <TreeRow label="Activación: 1.ª transacción automática en 48 h" value={fmtPct(a.first_auto_tx_48h_pct)} />
            <TreeRow label="Activación: presupuesto en 7 días" value={fmtPct(a.budget_7d_pct)} />
            <TreeRow label="Conexiones sanas" value={fmtPct(t.healthy_connections_pct)} />
            <TreeRow label="Automatización (automáticas / total)" value={fmtPct(t.automation_pct_30d)} hint="meta > 90 %" />
            <TreeRow label="Tasa de corrección" value={fmtPct(t.correction_pct_30d)} hint="automáticas con categoría o monto cambiado" />
            <TreeRow label="Llegan para verificar" value={fmtPct(t.should_verify_pct_30d)} />
            <TreeRow label="Por revisar: resueltos / pendientes" value={`${fmtInt(t.review_resolved_30d)} / ${fmtInt(t.review_pending)}`} />
            <TreeRow label="Retención S1 / S4 (al día)" value={`${fmtPct(t.retention_w1_pct)} / ${fmtPct(t.retention_w4_pct)}`} hint="cohortes de las últimas 26 semanas" />
          </ul>
        </Panel>

        <Panel title="Control" subtitle="Que no se dañe nada al crecer">
          <ul>
            <TreeRow label="Correos enviados hoy / cuota diaria" value={`${fmtInt(s.control?.mails_sent_today)} / ${fmtInt(s.control?.mail_daily_quota)}`} />
            <TreeRow label="Avisos de conexión desactivados" value={fmtInt(s.control?.connection_alerts_off)} />
            <TreeRow label="Resumen mensual activado" value={fmtInt(s.control?.monthly_summary_on)} />
            <TreeRow label="Correos rebotados / quejas" value={`${fmtInt(s.control?.bounced)} / ${fmtInt(s.control?.complained)}`} />
          </ul>
          {activation.data && (
            <div className="mt-4">
              <p className="text-xs font-medium text-ink-2 dark:text-gray-400 mb-1">Activación por periodo de registro</p>
              <SimpleTable rowKey={(r) => r.cohort} rows={activation.data} columns={[
                { key: 'cohort', label: 'Desde', render: (r) => fmtDay(r.cohort) },
                { key: 'signups', label: 'Registros', align: 'right', render: (r) => fmtInt(r.signups) },
                { key: 'c', label: 'Correo 24 h', align: 'right', render: (r) => fmtPct(r.connection_24h_pct) },
                { key: 'f', label: 'Auto 48 h', align: 'right', render: (r) => fmtPct(r.first_auto_tx_48h_pct) },
                { key: 'b', label: 'Presup. 7 d', align: 'right', render: (r) => fmtPct(r.budget_7d_pct) },
              ]} />
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Retención por cohortes semanales" subtitle="% de cada cohorte de registro al día en su semana 1, 4 y 12 (— = la semana no ha terminado)">
        {cohorts.error ? <PanelError state={cohorts} /> : (
          <SimpleTable rowKey={(r) => r.week} rows={(cohorts.data || []).filter((c) => c.size > 0)} empty="Sin registros en las últimas 26 semanas" columns={[
            { key: 'week', label: 'Semana de registro', render: (r) => fmtDay(r.week) },
            { key: 'size', label: 'Usuarios', align: 'right', render: (r) => fmtInt(r.size) },
            { key: 'w1', label: 'S1', align: 'right', render: (r) => cohortCell(r.w1, r.w1_eligible) },
            { key: 'w4', label: 'S4', align: 'right', render: (r) => cohortCell(r.w4, r.w4_eligible) },
            { key: 'w12', label: 'S12', align: 'right', render: (r) => cohortCell(r.w12, r.w12_eligible) },
          ]} />
        )}
      </Panel>
    </div>
  );
};

// DAU/WAU/MAU vienen como series separadas: una fila por día
const mergeActive = (trend = {}) => {
  const byDay = {};
  ['dau', 'wau', 'mau'].forEach((k) => (trend[k] || []).forEach((p) => {
    byDay[p.day] = { day: p.day, dau: 0, wau: 0, mau: 0, ...byDay[p.day], [k]: p.value };
  }));
  return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day));
};

export default AdminSummary;
