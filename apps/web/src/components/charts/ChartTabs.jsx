// Pestañas accesibles para tarjetas de gráficas (role="tablist", flechas del teclado).
const ChartTabs = ({ tabs, value, onChange, label, className = '' }) => {
  const onKeyDown = (e) => {
    const i = tabs.findIndex(t => t.id === value);
    if (e.key === 'ArrowRight') onChange(tabs[(i + 1) % tabs.length].id);
    if (e.key === 'ArrowLeft') onChange(tabs[(i - 1 + tabs.length) % tabs.length].id);
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown}
      className={`px-2 w-full flex flex-row text-sm font-semibold border-b border-gray-200 dark:border-gray-700 ${className}`}>
      {tabs.map(t => {
        const active = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)} title={t.hint}
            className={`flex-1 pt-3 pb-2 -mb-px border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 rounded-t-md ${active
              ? 'border-topi-500 text-topi-600 dark:text-indigo-300'
              : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
};

// Interruptor compacto (p. ej. Mensual | Diario)
export const Segmented = ({ options, value, onChange, label }) => (
  <div role="radiogroup" aria-label={label} className="inline-flex p-0.5 rounded-xl bg-gray-100 dark:bg-gray-700/60">
    {options.map(o => (
      <button key={o.id} type="button" role="radio" aria-checked={o.id === value} onClick={() => onChange(o.id)}
        className={`px-3 h-7 rounded-lg text-xs font-semibold transition-colors ${o.id === value
          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
        {o.label}
      </button>
    ))}
  </div>
);

export default ChartTabs;
