import {
  useAdminMetric, Panel, PanelSkeleton, PanelError, Stat, StatGrid, DailyBars, BarList, SimpleTable,
  fillDays, fmtInt, fmtPct, fmtDateTime,
} from './AdminUi';

const STATE_LABEL = { ok: 'Sana', error: 'Con error', inactive: 'Inactiva' };
const FRESHNESS_LABEL = { menos_24h: 'Leída hace < 24 h', '24h_72h': 'Entre 24 y 72 h', mas_72h: 'Hace más de 72 h', sin_lecturas: 'Sin lecturas aún' };
const KIND_LABEL = {
  verify: 'Verificar', installments: 'Cuotas', counterpart: 'Origen del pago', transfer: 'Transferencia',
  verify_descartado: 'Verificar (descartado)', counterpart_descartado: 'Origen del pago (descartado)', transfer_descartado: 'Transferencia (descartada)',
};

// Un latido de hace más de 10 minutos = el worker no está corriendo
const beatTone = (iso) => (Date.now() - new Date(iso).getTime() > 10 * 60 * 1000 ? 'crit' : undefined);

const AdminReading = ({ reloadKey }) => {
  const reading = useAdminMetric('reading', reloadKey);
  const quality = useAdminMetric('quality', reloadKey);

  if (reading.loading && !reading.data) return <PanelSkeleton rows={3} />;
  if (reading.error) return <PanelError state={reading} />;
  const r = reading.data;
  const q = quality.data;
  const total = (r.connections || []).reduce((sum, c) => sum + c.count, 0);
  const ok = (r.connections || []).filter((c) => c.state === 'ok').reduce((sum, c) => sum + c.count, 0);
  const latestBeat = r.workers?.[0];
  const dailyEmails = fillDays(r.daily, ['emails_transaction', 'emails_no_transaction', 'emails_error'], 60);
  const dailyTx = fillDays(r.daily, ['tx_auto', 'tx_manual'], 60);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Salud de lectura" subtitle="Conexiones de correo y worker">
        <StatGrid>
          <Stat label="Conexiones sanas" value={fmtPct((100 * ok) / Math.max(total, 1))} hint={`${fmtInt(ok)} de ${fmtInt(total)}`} />
          <Stat label="Jobs fallidos (7 d)" value={fmtInt(r.jobs_failed_7d)} tone={r.jobs_failed_7d > 0 ? 'warn' : undefined} />
          <Stat label="Jobs en cola" value={fmtInt(r.jobs_pending)} />
          <Stat label="Latido del worker" value={latestBeat ? fmtDateTime(latestBeat.last_seen) : 'Sin latido'}
            tone={latestBeat ? beatTone(latestBeat.last_seen) : 'crit'} hint={latestBeat?.version || undefined} />
        </StatGrid>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Por proveedor y estado">
          <BarList items={(r.connections || []).map((c) => ({ name: `${c.provider} · ${STATE_LABEL[c.state] || c.state}`, value: c.count }))} />
        </Panel>
        <Panel title="Errores por tipo" subtitle="Código de error de la conexión">
          <BarList items={(r.errors || []).map((e) => ({ name: e.name, value: e.count }))} empty="Ninguna conexión con error" />
        </Panel>
        <Panel title="Último correo leído" subtitle="Conexiones sanas">
          <BarList items={(r.freshness || []).map((f) => ({ name: FRESHNESS_LABEL[f.name] || f.name, value: f.count }))} empty="Sin conexiones sanas" />
        </Panel>
      </div>

      <Panel title="Correos procesados por día" subtitle="60 días">
        <DailyBars rows={dailyEmails} bars={[
          { key: 'emails_transaction', label: 'Con transacción', color: 'ingreso' },
          { key: 'emails_no_transaction', label: 'Sin transacción', color: 'neutral' },
          { key: 'emails_error', label: 'Error', color: 'crit' },
        ]} />
      </Panel>

      <Panel title="Transacciones automáticas vs. manuales" subtitle="Creadas por día, 60 días">
        <DailyBars rows={dailyTx} bars={[
          { key: 'tx_auto', label: 'Automáticas', color: 'balance' },
          { key: 'tx_manual', label: 'Manuales', color: 'ahorro' },
        ]} />
      </Panel>

      {quality.error && <PanelError state={quality} />}
      {q && (
        <>
          <Panel title="Calidad (30 días)" subtitle="Lo que el usuario corrige de lo leído">
            <StatGrid>
              <Stat label="Automatización" value={fmtPct(q.automation_pct)} hint={`${fmtInt(q.auto_tx)} automáticas · ${fmtInt(q.manual_tx)} manuales`} />
              <Stat label="Tasa de corrección" value={fmtPct(q.correction_pct)} hint={`${fmtInt(q.corrected_tx)} transacciones`} />
              <Stat label="Llegan para verificar" value={fmtPct(q.should_verify_pct)} hint={`${fmtInt(q.should_verify)} transacciones`} />
              <Stat label="Correcciones" value={fmtInt(q.corrections_category + q.corrections_amount)}
                hint={`${fmtInt(q.corrections_category)} categoría · ${fmtInt(q.corrections_amount)} monto`} />
            </StatGrid>
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Bancos con más correcciones" subtitle="Solo bancos usados por 5 o más usuarios">
              <SimpleTable rowKey={(b) => b.bank} rows={q.banks || []} empty="Ningún banco con 5 o más usuarios en 30 días" columns={[
                { key: 'bank', label: 'Banco' },
                { key: 'users', label: 'Usuarios', align: 'right', render: (b) => fmtInt(b.users) },
                { key: 'auto_tx', label: 'Automáticas', align: 'right', render: (b) => fmtInt(b.auto_tx) },
                { key: 'should_verify', label: 'Verificar', align: 'right', render: (b) => fmtInt(b.should_verify) },
                { key: 'corrected', label: 'Corregidas', align: 'right', render: (b) => `${fmtInt(b.corrected)} (${fmtPct(b.correction_pct)})` },
              ]} />
            </Panel>
            <Panel title="Ciclo de Por revisar" subtitle="30 días">
              <StatGrid className="!grid-cols-2 mb-4">
                <Stat label="Creados / resueltos" value={`${fmtInt(q.review?.created)} / ${fmtInt(q.review?.resolved)}`} />
                <Stat label="Pendientes hoy" value={fmtInt(q.review?.pending)} />
                <Stat label="Mediana hasta resolver" value={q.review?.median_hours == null ? '—' : `${fmtInt(q.review.median_hours)} h`} />
              </StatGrid>
              <BarList items={(q.review?.resolved_by_kind || []).map((k) => ({ name: KIND_LABEL[k.name] || k.name, value: k.count }))}
                empty="Aún no hay ítems resueltos (los eventos empiezan con esta versión)" />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReading;
