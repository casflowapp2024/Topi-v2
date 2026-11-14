import { useEffect, useId, useState } from 'react';
import { HeartIcon, LockClosedIcon } from '@heroicons/react/20/solid';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { formatMoney } from '../helpers';
import { startSupport } from '../../apiCalls/billing';

// Mismos valores que domain.SupportPresets / MinSupportAmount / MaxSupportAmount (la API los vuelve a validar)
export const DEFAULT_SUPPORT_CONFIG = { presets: ['10000', '20000', '50000'], min: '5000', max: '2000000', currency: 'COP' };
const OTHER = 'otro';

/** Solo dígitos: "20.000" y "$ 20000" valen 20000. Devuelve '' si no hay número. */
export const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');

/** Mensaje de error del monto libre, o null si es válido */
export const validateSupportAmount = (value, { min, max, currency } = DEFAULT_SUPPORT_CONFIG) => {
  if (!value) return 'Escribe cuánto quieres aportar.';
  const n = Number(value);
  if (n < Number(min)) return `El mínimo es ${formatMoney(min, currency)}.`;
  if (n > Number(max)) return `El máximo es ${formatMoney(max, currency)}.`;
  return null;
};

const choiceClass = (selected) => `h-12 rounded-2xl border text-sm font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${selected
  ? 'border-topi-500 bg-topi-50 text-topi-600 dark:bg-topi-500/15 dark:text-topi-100'
  : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'}`;

/**
 * Hoja "Apoyar a Topi": montos sugeridos o libre → checkout de Mercado Pago. No vende nada: es un aporte.
 * redirect: cómo se abre el checkout (window.location.assign; en las pruebas se reemplaza).
 */
const SupportSheet = ({ open, onClose, config = DEFAULT_SUPPORT_CONFIG, redirect = (url) => window.location.assign(url) }) => {
  const { presets, currency } = { ...DEFAULT_SUPPORT_CONFIG, ...config };
  const [choice, setChoice] = useState(presets[1] ?? presets[0]);
  const [custom, setCustom] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (open) {
      setFailed(false);
      setSending(false);
    }
  }, [open]);

  const amount = choice === OTHER ? custom : choice;
  const customError = choice === OTHER ? validateSupportAmount(custom, { ...DEFAULT_SUPPORT_CONFIG, ...config }) : null;

  const submit = async (event) => {
    event?.preventDefault();
    setTouched(true);
    if (customError) return;
    setSending(true);
    setFailed(false);
    try {
      const session = await startSupport(amount);
      if (!session?.checkout_url) throw new Error('sin checkout');
      redirect(session.checkout_url);
    } catch {
      setFailed(true);
      setSending(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Apoyar a Topi"
      description="Un aporte único y voluntario"
      footer={(
        <div className="flex flex-col gap-2">
          {failed && (
            <p role="alert" className="text-sm text-status-crit-text dark:text-red-400">
              No pudimos abrir el pago. Inténtalo de nuevo en un momento.
            </p>
          )}
          <Button type="submit" form="support-form" size="lg" className="w-full" loading={sending} icon={HeartIcon}>
            {amount && !customError ? `Aportar ${formatMoney(amount, currency)}` : 'Aportar'}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-ink-2 dark:text-gray-400">
            <LockClosedIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Pagas en Mercado Pago. Topi nunca ve los datos de tu tarjeta.
          </p>
        </div>
      )}>
      <form id="support-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
          <p>Topi es gratis y lo va a seguir siendo. Si te sirve, puedes ayudarnos a pagar el servidor, la
            inteligencia artificial y el correo que lo hacen funcionar.</p>
          <p>Es un pago único, no una suscripción: no se vuelve a cobrar y no cambia nada de lo que ya usas.</p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">¿Cuánto quieres aportar?</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Monto del aporte">
            {presets.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={choice === value}
                className={choiceClass(choice === value)} onClick={() => { setChoice(value); setTouched(false); }}>
                {formatMoney(value, currency)}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={choice === OTHER} className={choiceClass(choice === OTHER)}
              onClick={() => setChoice(OTHER)}>
              Otro monto
            </button>
          </div>
        </fieldset>

        {choice === OTHER && (
          <div className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium text-gray-900 dark:text-gray-100">Monto en pesos</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">$</span>
              <input id={inputId} inputMode="numeric" autoComplete="off" autoFocus
                value={custom ? Number(custom).toLocaleString('es-CO') : ''}
                onChange={(e) => setCustom(digitsOnly(e.target.value).slice(0, 9))}
                onBlur={() => setTouched(true)}
                aria-invalid={Boolean(touched && customError) || undefined}
                aria-describedby={errorId}
                className="w-full h-12 pl-7 pr-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-topi-500" />
            </div>
            <p id={errorId} className={`text-xs ${touched && customError ? 'text-status-crit-text dark:text-red-400' : 'text-ink-2 dark:text-gray-400'}`}>
              {touched && customError
                ? customError
                : `Entre ${formatMoney(config.min ?? DEFAULT_SUPPORT_CONFIG.min, currency)} y ${formatMoney(config.max ?? DEFAULT_SUPPORT_CONFIG.max, currency)}.`}
            </p>
          </div>
        )}
      </form>
    </Sheet>
  );
};

export default SupportSheet;
