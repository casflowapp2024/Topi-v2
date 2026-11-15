import { useCallback, useEffect, useState } from 'react';
import { getAdminFeedback, markFeedbackRead } from '../../apiCalls/feedback';
import { isForbidden } from '../../apiCalls/admin';
import Button from '../ui/Button';
import { Panel, PanelSkeleton, PanelError, fmtInt, fmtDateTime } from './AdminUi';

/**
 * Opiniones de "¿Qué le falta a Topi?" (plan/27 §E). Usuario = id corto, nunca nombre ni correo. Cada carga y cada
 * "marcar como leída" quedan en admin_audit.
 */
export const AdminFeedbackView = ({ data, unreadOnly, onToggle, onRead, marking }) => (
  <Panel title="Opiniones" subtitle={`${fmtInt(data.unread)} sin leer · usuario = primeros 8 caracteres del id`}
    action={(
      <label className="flex items-center gap-2 text-xs text-ink-2 dark:text-gray-300">
        <input type="checkbox" checked={unreadOnly} onChange={onToggle} className="rounded border-gray-300 text-topi-500" />
        Solo sin leer
      </label>
    )}>
    {(data.items || []).length === 0 ? (
      <p className="text-sm text-ink-2 dark:text-gray-400 py-6 text-center">{unreadOnly ? 'Nada sin leer.' : 'Todavía no hay opiniones.'}</p>
    ) : (
      <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
        {data.items.map((f) => (
          <li key={f.id} className={`py-3 flex flex-col gap-1.5 ${f.read_at ? 'opacity-70' : ''}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2 dark:text-gray-400">
              <span>{fmtDateTime(f.created_at)}</span>
              <code>{f.user}</code>
              {f.contact_ok && <span className="rounded-full bg-topi-50 dark:bg-gray-700 text-topi-600 dark:text-topi-200 px-2 py-0.5">Se le puede escribir</span>}
              {!f.read_at && <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">Nueva</span>}
            </div>
            <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{f.text}</p>
            {!f.read_at && (
              <div>
                <Button size="sm" variant="ghost" loading={marking === f.id} onClick={() => onRead(f.id)}>Marcar como leída</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    )}
  </Panel>
);

const AdminFeedback = ({ reloadKey }) => {
  const [unreadOnly, setUnreadOnly] = useState(true);
  const [marking, setMarking] = useState(null);
  const [state, setState] = useState({ data: null, loading: true, error: null, forbidden: false });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await getAdminFeedback(unreadOnly), loading: false, error: null, forbidden: false });
    } catch (err) {
      setState({ data: null, loading: false, error: err, forbidden: isForbidden(err) });
    }
  }, [unreadOnly]);
  useEffect(() => { load(); }, [load, reloadKey]);

  const onRead = async (id) => {
    setMarking(id);
    try {
      await markFeedbackRead(id);
      await load();
    } finally {
      setMarking(null);
    }
  };

  if (state.loading && !state.data) return <PanelSkeleton rows={3} />;
  if (state.error) return <PanelError state={state} />;
  return <AdminFeedbackView data={state.data} unreadOnly={unreadOnly} onToggle={() => setUnreadOnly((v) => !v)}
    onRead={onRead} marking={marking} />;
};

export default AdminFeedback;
