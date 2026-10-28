/**
 * Estado vacío: explica qué va a aparecer y ofrece la primera acción.
 * icon: componente de Heroicons. action: nodo (normalmente un <Button>).
 */
const EmptyState = ({ icon: Icon, title, description, action, compact = false, className = '' }) => (
  <div className={`flex flex-col items-center text-center gap-2 ${compact ? 'py-4' : 'py-8'} px-4 ${className}`}>
    {Icon && (
      <span className="w-11 h-11 rounded-2xl bg-topi-50 dark:bg-indigo-500/15 text-topi-500 dark:text-indigo-300 flex items-center justify-center">
        <Icon className="w-6 h-6" aria-hidden="true" />
      </span>
    )}
    {title && <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>}
    {description && <p className="text-sm text-ink-2 dark:text-gray-400 max-w-xs">{description}</p>}
    {action && <div className="pt-1">{action}</div>}
  </div>
);

export default EmptyState;
