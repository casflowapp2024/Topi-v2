import { currencyOptions } from '../helpers';

// Selector de moneda (COP, USD y EUR arriba). locked: la cuenta ya tiene movimientos.
const CurrencySelect = ({
  id = 'currency',
  name = 'currency',
  value,
  onChange,
  locked = false,
  label = 'Moneda',
  className = '',
}) => (
  <div className={className}>
    <label htmlFor={id} className="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">
      {label}
    </label>
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      disabled={locked}
      aria-label="Moneda de la cuenta"
      aria-describedby={locked ? `${id}-locked` : undefined}
      className="bg-gray-50 p-1 md:p-2.5 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full disabled:opacity-60 disabled:cursor-not-allowed dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    >
      {currencyOptions().map(c => (
        <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
      ))}
    </select>
    {locked && (
      <p id={`${id}-locked`} className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        La cuenta ya tiene movimientos: cámbiala con «Cambiar moneda».
      </p>
    )}
  </div>
);

export default CurrencySelect;
