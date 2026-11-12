import { useCallback, useEffect, useState } from 'react';
import { CheckBadgeIcon } from '@heroicons/react/20/solid';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { SkeletonRows } from '../ui/Skeleton';
import {
  getFounders, previewConfirmActive, confirmActiveFounders, confirmFounder, unconfirmFounder, isForbidden,
} from '../../apiCalls/admin';
import { Panel, PanelError, Stat, StatGrid, fmtInt, fmtDay, fmtDate, fmtDateTime } from './AdminUi';

const ACTIVE_BY = { app: 'abrió la app', reading: 'lectura sana' };

/** Fila de un elegible: datos de contacto, actividad y la acción de confirmar o quitar. Nunca borra a nadie. */
export const FounderItem = ({ row, busy, onConfirm, onUnconfirm }) => (
  <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate capitalize">{row.name || row.email}</p>
      <p className="text-xs text-ink-2 dark:text-gray-400 truncate">{row.email}</p>
      <p className="text-xs text-gray-700 dark:text-gray-300">
        Registro {fmtDate(row.signup_at)} · último día activo {fmtDay(row.last_active_day)}
        {row.active_by?.length > 0 && <> · {row.active_by.map((a) => ACTIVE_BY[a] || a).join(' y ')}</>}
      </p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      {row.confirmed_at ? (
        <>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-money-in dark:text-money-in-dark">
            <CheckBadgeIcon className="w-4 h-4" aria-hidden="true" /> Confirmado {fmtDate(row.confirmed_at)}
          </span>
          <Button variant="ghost" size="sm" loading={busy} onClick={() => onUnconfirm(row)}
            aria-label={`Quitar confirmación de ${row.name || row.email}`}>Quitar</Button>
        </>
      ) : (
        <Button variant="secondary" size="sm" loading={busy} onClick={() => onConfirm(row)}
          aria-label={`Confirmar a ${row.name || row.email} como fundador`}>Confirmar</Button>
      )}
    </div>
  </li>
);

const FounderGroup = ({ title, subtitle, rows, busyId, onConfirm, onUnconfirm }) => (
  <Panel title={`${title} (${fmtInt(rows.length)})`} subtitle={subtitle}>
    {rows.length === 0
      ? <p className="text-sm text-ink-2 dark:text-gray-400 py-2">Nadie en este grupo.</p>
      : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700/60 -my-3">
          {rows.map((row) => (
            <FounderItem key={row.id} row={row} busy={busyId === row.id} onConfirm={onConfirm} onUnconfirm={onUnconfirm} />
          ))}
        </ul>
      )}
  </Panel>
);

const AdminFounders = ({ reloadKey }) => {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getFounders();
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error, forbidden: isForbidden(error) });
    }
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  const act = async (row, fn) => {
    setBusyId(row.id);
    setActionError(null);
    try {
      await fn(row.id);
      await load();
    } catch {
      setActionError('No se pudo guardar el cambio. Intenta de nuevo.');
    } finally {
      setBusyId(null);
    }
  };

  const openPreview = async () => {
    setActionError(null);
    try {
      setPreview(await previewConfirmActive());
    } catch {
      setActionError('No se pudo calcular el resumen.');
    }
  };

  const applyBulk = async () => {
    setApplying(true);
    try {
      setLastResult(await confirmActiveFounders());
      setPreview(null);
      await load();
    } catch {
      setActionError('No se pudo confirmar. Nada cambió.');
    } finally {
      setApplying(false);
    }
  };

  if (state.loading && !state.data) return <Panel title="Fundadores"><SkeletonRows rows={4} /></Panel>;
  if (state.error) return <PanelError state={state} />;
  const d = state.data;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Fundadores" subtitle="Registrados antes de FOUNDER_CUTOFF. Confirmado = Plus de por vida al lanzar Plus."
        action={<Button size="sm" icon={CheckBadgeIcon} onClick={openPreview}>Confirmar fundadores activos</Button>}>
        <StatGrid>
          <Stat label="Elegibles" value={fmtInt(d.eligible)} />
          <Stat label="Activos en 90 días" value={fmtInt(d.active.length)} hint="abrieron la app o tienen lectura sana" />
          <Stat label="Sin actividad" value={fmtInt(d.inactive.length)} hint="siguen elegibles: si vuelven, se confirman" />
          <Stat label="Confirmados" value={fmtInt(d.confirmed)} />
        </StatGrid>
        <p className="text-xs text-ink-2 dark:text-gray-400 mt-4">
          No se borra ningún usuario ni dato por no ser fundador. Confirmar y quitar quedan auditados con quién y cuándo.
        </p>
        {lastResult && (
          <p className="text-sm text-money-in dark:text-money-in-dark mt-2" role="status">
            {fmtInt(lastResult.confirmed)} fundadores confirmados.
          </p>
        )}
        {actionError && <p className="text-sm text-status-crit-text dark:text-red-400 mt-2" role="alert">{actionError}</p>}
      </Panel>

      <FounderGroup title="Activos en 90 días" subtitle="Candidatos a confirmar" rows={d.active} busyId={busyId}
        onConfirm={(row) => act(row, confirmFounder)} onUnconfirm={(row) => act(row, unconfirmFounder)} />
      <FounderGroup title="Sin actividad" subtitle="Elegibles sin uso real en 90 días (no se borran)" rows={d.inactive} busyId={busyId}
        onConfirm={(row) => act(row, confirmFounder)} onUnconfirm={(row) => act(row, unconfirmFounder)} />

      <Modal open={Boolean(preview)} onClose={() => !applying && setPreview(null)} title="Confirmar fundadores activos"
        description="Resumen antes de aplicar"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={applying}>Cancelar</Button>
            <Button onClick={applyBulk} loading={applying} disabled={!preview?.to_confirm}>
              Confirmar {fmtInt(preview?.to_confirm)}
            </Button>
          </>
        )}>
        {preview && (
          <ul className="flex flex-col gap-2 text-sm text-gray-800 dark:text-gray-200">
            <li><b className="tabular-nums">{fmtInt(preview.to_confirm)}</b> elegibles activos en 90 días se confirmarán ahora.</li>
            <li><b className="tabular-nums">{fmtInt(preview.already_confirmed)}</b> ya estaban confirmados.</li>
            <li><b className="tabular-nums">{fmtInt(preview.inactive)}</b> sin actividad quedan elegibles, sin confirmar (nadie se borra).</li>
            <li className="text-xs text-ink-2 dark:text-gray-400">Queda auditado: tu usuario y la hora ({fmtDateTime(new Date().toISOString())}).</li>
          </ul>
        )}
      </Modal>
    </div>
  );
};

export default AdminFounders;
