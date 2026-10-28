import { CheckCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid';

// Fracción del mes transcurrida (0..1) si el periodo es el mes actual; null si es otro mes.
export const getMonthPace = (year, month) => {
  const now = new Date();
  if (now.getFullYear() !== Number(year) || now.getMonth() + 1 !== Number(month)) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  return now.getDate() / daysInMonth;
};

// ok | warn | crit. Para ingresos, llegar al 100% es bueno: nunca es "crit".
export const getBudgetStatus = (usage, { isIncome = false, pace = null } = {}) => {
  const u = (parseFloat(usage) || 0) / 100;
  if (isIncome) return u >= 1 ? 'ok' : 'progress';
  if (u > 1) return 'crit';
  if (u >= 0.85 || (pace !== null && u > pace + 0.1)) return 'warn';
  return 'ok';
};

const BAR = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  crit: 'bg-status-crit',
  progress: 'bg-topi-500',
};

const TEXT = {
  ok: 'text-money-in dark:text-money-in-dark',
  warn: 'text-status-warn-text dark:text-amber-300',
  crit: 'text-status-crit-text dark:text-red-400',
  progress: 'text-ink-2 dark:text-gray-400',
};

const ICON = {
  ok: CheckCircleIcon,
  warn: ExclamationTriangleIcon,
  crit: ExclamationCircleIcon,
  progress: null,
};

const LABEL = {
  expense: { ok: 'Vas bien', warn: 'Atento', crit: 'Te pasaste' },
  income: { ok: 'Meta cumplida', progress: 'En progreso' },
};

/**
 * Barra de presupuesto con estado. El color nunca va solo: lleva ícono y texto.
 * usage: porcentaje usado (ej. 118). pace: fracción del mes (0..1) o null.
 */
const BudgetProgress = ({ usage, isIncome = false, pace = null, showLabel = true, height = 'h-2', className = '' }) => {
  const pct = parseFloat(usage) || 0;
  const status = getBudgetStatus(pct, { isIncome, pace });
  const Icon = ICON[status];
  const label = (isIncome ? LABEL.income : LABEL.expense)[status];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div
        className={`relative w-full ${height} rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-300`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(pct)}% usado. ${label}`}
      >
        <div
          className={`${BAR[status]} h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
        {pace !== null && !isIncome && (
          <span
            className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-ink/60 dark:bg-white/60"
            style={{ left: `calc(${pace * 100}% - 1px)` }}
            title="Dónde deberías ir hoy"
          />
        )}
      </div>
      {showLabel && (status !== 'ok' || isIncome) && status !== 'progress' && (
        <span className={`flex items-center gap-1 text-xs font-semibold ${TEXT[status]}`}>
          {Icon && <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
          {label} · {Math.round(pct)}%
        </span>
      )}
    </div>
  );
};

export default BudgetProgress;
