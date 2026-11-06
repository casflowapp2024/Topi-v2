import { currencyOptions } from '../helpers';
import Field, { Select } from './Field';

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
  <Field label={label} id={id} className={className}
    help={locked ? 'La cuenta ya tiene movimientos: cámbiala con «Cambiar moneda».' : undefined}>
    <Select name={name} value={value} onChange={onChange} disabled={locked}>
      {currencyOptions().map(c => (
        <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
      ))}
    </Select>
  </Field>
);

export default CurrencySelect;
