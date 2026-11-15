import { useEffect, useId, useState } from 'react';
import { CheckCircleIcon, NoSymbolIcon } from '@heroicons/react/20/solid';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { getReactivation, previewReactivation, sendReactivation } from '../../apiCalls/reactivation';
import { fmtDateTime } from './AdminUi';

export const REASON_TEXT = {
  suppressed: 'Su correo rebotó o marcó un correo como spam: no se le escribe.',
  unsubscribed: 'Pidió no recibir más correos personales del equipo.',
  recent: 'Ya se le escribió en los últimos 90 días.',
  connection_down: 'Tiene una conexión caída: el correo lo llevaría a una app que no le funciona. Se habilita cuando el aviso de conexión caída esté en producción (REACTIVATION_ALLOW_BROKEN=true).',
  daily_limit: 'Ya se llegó al límite de correos personales de hoy.',
};

const ERRORS = {
  400: 'Revisa el texto: escribe {nombre} en vez del nombre o el correo de la persona (no deben quedar guardados).',
  409: 'Ya no se le puede escribir (alguien le escribió hoy o cambió su estado). Cierra y vuelve a abrir.',
  default: 'No se pudo. Inténtalo otra vez.',
};

/**
 * "Escribirle" (plan/27 §G): un correo personal a una sola persona. Primero se edita, luego se ve el correo final y
 * solo entonces se envía. Nunca masivo.
 */
const ReactivationSheet = ({ user, onClose, api = { getReactivation, previewReactivation, sendReactivation } }) => {
  const open = Boolean(user);
  const [view, setView] = useState(null);
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | edit | preview | sending | sent | error
  const [error, setError] = useState(null);
  const subjectId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!user) return undefined;
    let alive = true;
    setStatus('loading');
    setPreview(null);
    setError(null);
    api.getReactivation(user.id).then((v) => {
      if (!alive) return;
      setView(v);
      setDraft(v.draft);
      setStatus('edit');
    }).catch(() => { if (alive) { setError(ERRORS.default); setStatus('error'); } });
    return () => { alive = false; };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = (err) => {
    setError(ERRORS[err?.response?.status] || ERRORS.default);
  };

  const showPreview = async () => {
    setError(null);
    try {
      setPreview(await api.previewReactivation(user.id, draft));
      setStatus('preview');
    } catch (err) { fail(err); }
  };

  const send = async () => {
    setStatus('sending');
    setError(null);
    try {
      await api.sendReactivation(user.id, draft);
      setStatus('sent');
    } catch (err) {
      fail(err);
      setStatus('preview');
    }
  };

  let footer = null;
  if (status === 'edit') footer = <Button className="w-full" onClick={showPreview} disabled={!view?.allowed}>Ver el correo final</Button>;
  if (status === 'preview' || status === 'sending') {
    footer = (
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => setStatus('edit')} disabled={status === 'sending'}>Editar</Button>
        <Button className="flex-1" onClick={send} loading={status === 'sending'}>Enviar a esta persona</Button>
      </div>
    );
  }
  if (status === 'sent') footer = <Button className="w-full" onClick={onClose}>Cerrar</Button>;

  return (
    <Sheet open={open} onClose={onClose} size="lg" title="Escribirle"
      description={user ? `${user.name || 'Sin nombre'} · uno a uno, nunca masivo` : ''} footer={footer}>
      {status === 'loading' && <p className="text-sm text-ink-2 dark:text-gray-400">Cargando…</p>}

      {view && !view.allowed && status !== 'loading' && (
        <div role="status" className="flex gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-gray-800 dark:text-gray-100 mb-4">
          <NoSymbolIcon className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span>{REASON_TEXT[view.reason] || 'No se le puede escribir ahora.'}</span>
        </div>
      )}

      {status === 'edit' && view && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-ink-2 dark:text-gray-400">
            Hoy: {view.sent_today} de {view.daily_limit} correos personales
            {view.last_sent_at ? ` · última vez a esta persona: ${fmtDateTime(view.last_sent_at)}` : ''}
            {view.founder ? ' · es fundador: el correo le agradece con una posdata' : ''}.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={subjectId} className="text-sm font-medium">Asunto</label>
            <input id={subjectId} value={draft.subject} disabled={!view.allowed}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2.5 text-sm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={bodyId} className="text-sm font-medium">Texto</label>
            <textarea id={bodyId} rows={14} value={draft.body} disabled={!view.allowed}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm leading-relaxed" />
            <p className="text-xs text-ink-2 dark:text-gray-400">
              Escribe <code>{'{nombre}'}</code> donde va el nombre: se pone al enviar y no queda guardado. Las respuestas llegan al buzón del equipo.
            </p>
          </div>
        </div>
      )}

      {(status === 'preview' || status === 'sending') && preview && (
        <div className="flex flex-col gap-3">
          <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-ink-2 dark:text-gray-400">Para</dt><dd className="break-all">{preview.to}</dd>
            <dt className="text-ink-2 dark:text-gray-400">Asunto</dt><dd>{preview.subject}</dd>
          </dl>
          <iframe title="Vista previa del correo" sandbox="" srcDoc={preview.html}
            className="w-full h-[420px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white" />
        </div>
      )}

      {status === 'sent' && (
        <div role="status" className="flex flex-col items-center text-center gap-3 py-6">
          <CheckCircleIcon className="w-12 h-12 text-green-600 dark:text-green-400" aria-hidden="true" />
          <p className="font-semibold">Listo: el correo quedó en cola.</p>
          <p className="text-sm text-ink-2 dark:text-gray-300">Lo que responda llega al buzón del equipo. Resúmelo a mano en Opiniones.</p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-status-crit dark:text-red-300 mt-3">{error}</p>}
    </Sheet>
  );
};

export default ReactivationSheet;
