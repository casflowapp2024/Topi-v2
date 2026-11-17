// Tarjeta con la marca de Topi para la ventana emergente del OAuth de Gmail/Outlook (plan 29, hallazgo 15).
// Componente puro: sin redux ni helpers, porque la ventana se abre sola y debe cargar rápido.

const Spinner = () => (
  <svg className="w-8 h-8 animate-spin text-topi-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
    <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const Check = () => (
  <span className="w-12 h-12 rounded-full bg-status-ok-soft flex items-center justify-center" aria-hidden="true">
    <svg className="w-7 h-7 text-status-ok" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

const Warn = () => (
  <span className="w-12 h-12 rounded-full bg-status-crit-soft flex items-center justify-center" aria-hidden="true">
    <svg className="w-7 h-7 text-status-crit" viewBox="0 0 24 24" fill="none">
      <path d="M12 8v5m0 3.5v.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </span>
);

/**
 * state: 'loading' | 'done' | 'error' | 'orphan' (sin ventana que la abrió: hay que volver a Topi a mano)
 */
const OAuthPopupCard = ({ state, title, detail }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-surface-sunken px-4 font-Inter">
    <div role="status" aria-live="polite"
      className="w-full max-w-sm bg-white dark:bg-surface-raised rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-8 flex flex-col items-center gap-4 text-center">
      <div className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
        <img src="/T1.svg" alt="" width="28" height="28" className="w-7 h-7" />
        Topi
      </div>
      {state === 'loading' && <Spinner />}
      {state === 'done' && <Check />}
      {(state === 'error' || state === 'orphan') && <Warn />}
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
        {detail && <p className="text-sm text-ink-2 dark:text-gray-300">{detail}</p>}
      </div>
      {state === 'error' && (
        <button type="button" onClick={() => window.close()}
          className="bg-topi-500 hover:bg-topi-600 text-white text-sm font-medium px-4 py-2 rounded-xl">
          Cerrar esta ventana
        </button>
      )}
      {state === 'orphan' && (
        <a href="/dashboard/connect-email" className="bg-topi-500 hover:bg-topi-600 text-white text-sm font-medium px-4 py-2 rounded-xl">
          Volver a Topi
        </a>
      )}
      <p className="text-xs text-ink-2 dark:text-gray-400">Topi solo lee los correos que te envían tus bancos.</p>
    </div>
  </div>
);

export default OAuthPopupCard;
