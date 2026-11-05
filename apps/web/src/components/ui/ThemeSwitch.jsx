import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/20/solid';

export const THEME_OPTIONS = [
  { value: 'light', label: 'Claro', icon: SunIcon },
  { value: 'dark', label: 'Oscuro', icon: MoonIcon },
  { value: 'system', label: 'Sistema', icon: ComputerDesktopIcon },
];

export const segmentClass = (selected) => `flex-1 min-w-0 h-8 px-2 rounded-lg inline-flex items-center justify-center gap-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${selected
  ? 'bg-white text-topi-600 shadow-sm dark:bg-gray-700 dark:text-topi-200'
  : 'text-ink-2 hover:text-ink dark:text-gray-400 dark:hover:text-gray-100'}`;

/** Control segmentado Claro · Oscuro · Sistema (fuera de menús: en Configuración). */
const ThemeSwitch = ({ value, onChange, className = '' }) => (
  <div role="radiogroup" aria-label="Tema" className={`flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900 ${className}`}>
    {THEME_OPTIONS.map(({ value: v, label, icon: Icon }) => (
      <button key={v} type="button" role="radio" aria-checked={value === v}
        onClick={() => value !== v && onChange(v)} className={segmentClass(value === v)}>
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
    ))}
  </div>
);

export default ThemeSwitch;
