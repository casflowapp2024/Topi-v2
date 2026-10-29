// Chip seleccionable (filtros, categorías). selected cambia el estilo y aria-pressed.
const Chip = ({ selected = false, onClick, icon: Icon, children, count, tone = 'default', className = '', ...props }) => {
  const toneOff = tone === 'accent'
    ? 'border-topi-500/60 text-topi-600 dark:text-indigo-300 hover:bg-topi-50 dark:hover:bg-indigo-500/10'
    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={props.role === 'tab' ? undefined : selected}
      className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${selected
        ? 'bg-topi-500 border-topi-500 text-white shadow-sm'
        : `bg-white dark:bg-gray-800 ${toneOff}`} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
      {children}
      {count != null && (
        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold flex items-center justify-center ${selected ? 'bg-white/25 text-white' : 'bg-topi-500 text-white'}`}>
          {count}
        </span>
      )}
    </button>
  );
};

export default Chip;
