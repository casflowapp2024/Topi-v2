// Superficie base de Topi. Usar en vez de repetir bg/borde/radio/sombra en cada componente.
const PADDING = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' };

const Card = ({ as: Tag = 'section', padding = 'md', className = '', children, ...props }) => (
  <Tag
    className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm transition-colors duration-300 ${PADDING[padding]} ${className}`}
    {...props}
  >
    {children}
  </Tag>
);

// Encabezado de tarjeta: título (+ subtítulo opcional) a la izquierda y una acción a la derecha.
export const CardHeader = ({ title, subtitle, action, className = '' }) => (
  <header className={`flex items-center justify-between gap-3 pb-3 mb-3 border-b border-gray-200 dark:border-gray-700 ${className}`}>
    <div className="flex flex-col min-w-0">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h2>
      {subtitle && <span className="text-xs text-ink-2 dark:text-gray-400">{subtitle}</span>}
    </div>
    {action}
  </header>
);

export default Card;
