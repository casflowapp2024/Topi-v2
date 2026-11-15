import { useEffect, useId, useState } from 'react';
import { CheckCircleIcon, LockClosedIcon } from '@heroicons/react/20/solid';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { FEEDBACK_MAX, sendFeedback } from '../../apiCalls/feedback';

const ERRORS = {
  429: 'Ya nos enviaste 3 opiniones hoy. ¡Gracias! Escríbenos de nuevo mañana.',
  default: 'No pudimos enviarla. Inténtalo otra vez en un momento.',
};

/**
 * "¿Qué le falta a Topi?" (plan/27 §E): texto corto (máx. 500), opcionalmente "¿podemos escribirte?".
 * Advierte no poner datos bancarios: el texto lo lee el equipo en el panel.
 */
const FeedbackSheet = ({ open, onClose, send = sendFeedback }) => {
  const [text, setText] = useState('');
  const [contactOk, setContactOk] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState(null);
  const textId = useId();
  const hintId = useId();

  useEffect(() => {
    if (open) {
      setStatus('idle');
      setError(null);
    }
  }, [open]);

  const trimmed = text.trim();
  const remaining = FEEDBACK_MAX - text.length;

  const submit = async (event) => {
    event?.preventDefault();
    if (!trimmed || remaining < 0) return;
    setStatus('sending');
    setError(null);
    try {
      await send(trimmed, contactOk);
      setStatus('sent');
      setText('');
      setContactOk(false);
    } catch (err) {
      setError(ERRORS[err?.response?.status] || ERRORS.default);
      setStatus('error');
    }
  };

  const footer = status === 'sent'
    ? <Button className="w-full" onClick={onClose}>Cerrar</Button>
    : (
      <Button className="w-full" type="submit" form="feedback-form" loading={status === 'sending'} disabled={!trimmed || remaining < 0}>
        Enviar
      </Button>
    );

  return (
    <Sheet open={open} onClose={onClose} title="¿Qué le falta a Topi?"
      description="Lo lee el equipo. Cuéntanos qué te gustaría o qué no funciona." footer={footer}>
      {status === 'sent' ? (
        <div role="status" className="flex flex-col items-center text-center gap-3 py-6">
          <CheckCircleIcon className="w-12 h-12 text-green-600 dark:text-green-400" aria-hidden="true" />
          <p className="font-semibold">¡Gracias! Ya nos llegó.</p>
          <p className="text-sm text-ink-2 dark:text-gray-300">Leemos todas las opiniones. Si nos dejaste escribirte, te responderemos por correo.</p>
        </div>
      ) : (
        <form id="feedback-form" onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={textId} className="text-sm font-medium">Tu opinión</label>
            <textarea id={textId} rows={6} value={text} maxLength={FEEDBACK_MAX + 50}
              onChange={(e) => setText(e.target.value)} aria-describedby={hintId}
              placeholder="Por ejemplo: me gustaría que Topi leyera mi banco…"
              className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-topi-500" />
            <div id={hintId} className="flex justify-between gap-3 text-xs text-ink-2 dark:text-gray-400">
              <span className="flex items-start gap-1">
                <LockClosedIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                No escribas datos bancarios: números de cuenta, tarjetas, claves ni montos.
              </span>
              <span className={`tabular-nums shrink-0 ${remaining < 0 ? 'text-status-crit dark:text-red-300 font-semibold' : ''}`} aria-live="polite">
                {remaining}
              </span>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-topi-500 focus:ring-topi-500" />
            ¿Podemos escribirte para preguntarte más?
          </label>
          {error && <p role="alert" className="text-sm text-status-crit dark:text-red-300">{error}</p>}
        </form>
      )}
    </Sheet>
  );
};

export default FeedbackSheet;
