// Tooltip de las gráficas: título y filas etiqueta/valor. tone colorea el valor (texto accesible).
const TONE = {
  in: 'text-money-in dark:text-money-in-dark',
  out: 'text-money-out dark:text-money-out-dark',
  ok: 'text-money-in dark:text-money-in-dark',
  warn: 'text-status-warn-text dark:text-amber-300',
  crit: 'text-status-crit-text dark:text-red-400',
  muted: 'text-ink-2 dark:text-gray-400',
};

const ChartTooltip = ({ title, rows = [] }) => (
  <div className="min-w-[170px] flex flex-col gap-1 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2">
    {title && <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{title}</span>}
    {rows.filter(Boolean).map((r) => (
      <span key={r.label} className="flex items-center justify-between gap-4">
        <span className="inline-flex items-center gap-1.5">
          {r.color && <span className="w-2 h-2 rounded-sm" style={{ background: r.color }} aria-hidden="true" />}
          {r.label}
        </span>
        <b className={`tabular-nums ${r.tone ? TONE[r.tone] : ''}`}>{r.value}</b>
      </span>
    ))}
  </div>
);

export default ChartTooltip;
