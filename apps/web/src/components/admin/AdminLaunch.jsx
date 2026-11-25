import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircleIcon, XCircleIcon, HandRaisedIcon } from '@heroicons/react/20/solid';
import { isForbidden } from '../../apiCalls/admin';
import Button from '../ui/Button';
import { Panel, PanelSkeleton, PanelError, Stat, StatGrid, fmtInt, fmtPct, fmtDay } from './AdminUi';

const base = () => process.env.REACT_APP_API_URL;
const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, Accept: 'application/json' } });
export const getLaunch = async () => (await axios.get(`${base()}/admin/launch`, config()))?.data?.data;
export const setLaunchStage = async (stage, startedAt, note) =>
  (await axios.put(`${base()}/admin/launch/stages/${encodeURIComponent(stage)}`, { started_at: startedAt, note }, config()))?.data?.data;

const STAGES = [
  { id: 'I.1', title: 'I.1 · Cercanos', who: '20–30 personas cercanas con seguimiento 1 a 1 (y reactivación de antiguos)', length: '2–3 semanas' },
  { id: 'I.2', title: 'I.2 · Comunidades', who: 'Comunidades de finanzas personales en Colombia', length: '4 semanas' },
  { id: 'I.3', title: 'I.3 · Abierto', who: 'Registro abierto, landing con SEO (requiere la verificación de Google)', length: 'continuo' },
];

const Status = ({ ok }) => {
  if (ok === null || ok === undefined) {
    return <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 text-xs font-medium text-ink-2 dark:text-gray-400"><HandRaisedIcon className="w-4 h-4" aria-hidden="true" />A mano</span>;
  }
  return ok
    ? <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-400"><CheckCircleIcon className="w-4 h-4" aria-hidden="true" />Cumple</span>
    : <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 text-xs font-semibold text-status-crit-text dark:text-red-400"><XCircleIcon className="w-4 h-4" aria-hidden="true" />Aún no</span>;
};

// Aviso de cupos de Google (plan/28 §7): cada 10 cuentas, CASA desde 30 y tope en block_at (también llega por correo)
export const GmailQuotaNotice = ({ gmail }) => {
  if (!gmail || gmail.verified || !(gmail.threshold >= 10)) return null;
  const text = gmail.blocked
    ? `Se llegó a ${fmtInt(gmail.block_at)} cuentas de Google: la app ya no ofrece conexiones de Gmail nuevas (reconectar sí funciona).`
    : `Ya van ${fmtInt(gmail.threshold)} cuentas de Google de ${fmtInt(gmail.cap)}.${gmail.weekly ? ' Es momento de tramitar la verificación de Google y la evaluación CASA; cada semana llega un resumen por correo.' : ' Cada 10 llega un aviso por correo.'}`;
  return (
    <p role="status" className={`mt-3 rounded-xl border p-3 text-sm ${gmail.blocked ? 'border-red-200 bg-status-crit-soft text-status-crit-text dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-amber-200 bg-status-warn-soft text-status-warn-text dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'}`}>
      {text}
    </p>
  );
};

/**
 * Lanzamiento por etapas (plan/27 §I): criterios de cada etapa contra los números reales, cuándo empezó cada una
 * (lo fija el admin, auditado) y los cupos de Gmail de la app sin verificar.
 */
export const AdminLaunchView = ({ data, onSetStage, saving }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [form, setForm] = useState({ stage: data.current === 'I.1' ? 'I.2' : data.current === 'I.2' ? 'I.3' : 'I.1', started_at: today, note: '' });
  const started = Object.fromEntries((data.stages || []).map((s) => [s.stage, s]));
  const gmail = data.gmail || {};
  const gmailLeft = (gmail.cap || 100) - (gmail.used || 0);

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Lanzamiento por etapas" subtitle={data.current ? `Etapa actual: ${data.current} · activación medida desde ${fmtDay(data.activation_from)}` : `Ninguna etapa empezó · activación de los últimos 30 días (desde ${fmtDay(data.activation_from)})`}>
        <StatGrid>
          <Stat label="Usuarios al día semanales" value={fmtInt(data.uas_now)} hint="North Star" />
          <Stat label="Correo conectado en 24 h" value={fmtPct(data.activation?.connection_24h_pct)} hint={`${fmtInt(data.activation?.signups)} registros`} />
          <Stat label="1.ª automática en 48 h" value={fmtPct(data.activation?.first_auto_tx_48h_pct)} />
          <Stat label="Cuentas de Google usadas" value={`${fmtInt(gmail.used)} / ${fmtInt(gmail.cap)}`}
            hint={gmail.verified ? 'app verificada: sin tope' : `${fmtInt(gmail.connected)} conectadas hoy · quedan ~${fmtInt(gmailLeft)} · tope ${fmtInt(gmail.block_at)}`}
            tone={gmail.verified ? undefined : gmail.blocked || gmailLeft <= 20 ? 'crit' : (gmail.used || 0) >= 30 ? 'warn' : undefined} />
        </StatGrid>
        <GmailQuotaNotice gmail={gmail} />
        <p className="mt-3 text-xs text-ink-2 dark:text-gray-400">{gmail.note}</p>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {STAGES.map((stage) => (
          <Panel key={stage.id} title={stage.title}
            subtitle={started[stage.id] ? `Empezó el ${fmtDay(started[stage.id].started_at)} · ${stage.length}` : `Sin empezar · ${stage.length}`}>
            <p className="text-xs text-ink-2 dark:text-gray-400 mb-3">{stage.who}</p>
            <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700/60">
              {(data.criteria || []).filter((c) => c.stage === stage.id).map((c) => (
                <li key={c.label} className="py-2 flex flex-col gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm text-gray-900 dark:text-gray-100">{c.label}</span>
                    <Status ok={c.ok} />
                  </div>
                  <span className="text-xs text-ink-2 dark:text-gray-400">Meta {c.target} · hoy {c.value}</span>
                </li>
              ))}
            </ul>
            {started[stage.id]?.note && <p className="mt-3 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">Decisión: {started[stage.id].note}</p>}
          </Panel>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="UAS por semana" subtitle="Cada punto: los 7 días que terminan ese día">
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {(data.uas_weeks || []).map((w) => (
              <li key={w.day} className="rounded-xl bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
                <span className="block text-xs text-ink-2 dark:text-gray-400">{fmtDay(w.day)}</span>
                <span className={`block text-lg font-bold tabular-nums ${w.value >= 50 ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'}`}>{fmtInt(w.value)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Stat label="Retención S4" value={fmtPct(data.retention_w4_pct)} hint="cohortes desde el inicio de la etapa" />
            <Stat label="Opiniones sin leer" value={fmtInt(data.feedback_unread)} />
            <Stat label="Conexiones caídas abiertas" value={fmtInt(data.reconnect?.open)} tone={data.reconnect?.open > 0 ? 'warn' : undefined} />
            <Stat label="Reconectadas en 7 d" value={fmtPct(data.reconnect?.reconnected_7d_pct)} />
          </div>
        </Panel>

        <Panel title="Marcar el inicio de una etapa" subtitle="Queda en admin_audit. Anota la decisión también en plan/27.">
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); onSetStage(form); }}>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Etapa
                <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm">
                  {STAGES.map((s) => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Empezó el
                <input type="date" max={today} value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })}
                  className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Decisión (por qué se pasa de etapa)
              <textarea rows={3} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm" />
            </label>
            <div><Button type="submit" size="sm" loading={saving}>Guardar</Button></div>
          </form>
        </Panel>
      </div>
    </div>
  );
};

const AdminLaunch = ({ reloadKey }) => {
  const [state, setState] = useState({ data: null, loading: true, error: null, forbidden: false });
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await getLaunch(), loading: false, error: null, forbidden: false });
    } catch (err) {
      setState({ data: null, loading: false, error: err, forbidden: isForbidden(err) });
    }
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  const onSetStage = async ({ stage, started_at, note }) => {
    setSaving(true);
    try {
      await setLaunchStage(stage, started_at, note);
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (state.loading && !state.data) return <PanelSkeleton rows={4} />;
  if (state.error) return <PanelError state={state} />;
  return <AdminLaunchView data={state.data} onSetStage={onSetStage} saving={saving} />;
};

export default AdminLaunch;
