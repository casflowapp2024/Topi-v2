import { formatMoney } from '../../helpers';

const Kpi = ({ label, value, tone }) => (
  <div className="rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3 min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">{label}</p>
    <p className={`mt-0.5 text-lg font-bold tabular-nums truncate ${tone === 'in' ? 'text-money-in dark:text-money-in-dark' : tone === 'out' ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
  </div>
);

/**
 * Cifras del periodo elegido para una cuenta de efectivo: lo que entró, lo que salió y el saldo al
 * final del periodo. (Tarjetas e inversiones tienen su propio panel.)
 */
const AccSummaryCard = ({ acc, data }) => {
  const balance = Number(data?.balance?.value ?? 0);
  const income = Math.abs(Number(data?.income?.value ?? 0));
  const expenses = Math.abs(Number(data?.expenses?.value ?? 0));
  const net = income - expenses;

  return (
    <section aria-label="Resumen del periodo" className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md transition-colors duration-300">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">En el periodo</h3>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Entró" value={formatMoney(income)} tone="in" />
        <Kpi label="Salió" value={formatMoney(expenses)} tone="out" />
        <Kpi label="Saldo al final" value={formatMoney(balance)} tone={balance < 0 ? 'out' : undefined} />
      </div>
      {data && (
        <p className="mt-2 text-xs text-ink-2 dark:text-gray-400">
          {net >= 0 ? 'Entró ' : 'Salió '}<b className={net >= 0 ? 'text-money-in dark:text-money-in-dark' : 'text-money-out dark:text-money-out-dark'}>{formatMoney(Math.abs(net))}</b> más de lo que {net >= 0 ? 'salió' : 'entró'}.
        </p>
      )}
    </section>
  );
};

export default AccSummaryCard;
