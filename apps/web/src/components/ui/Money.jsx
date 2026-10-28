import { formatMoney, getBaseCurrency, moneyAriaLabel } from '../helpers';

// Monto en su moneda como valor principal y, si la moneda no es la base del usuario, su
// equivalente en moneda base debajo en gris (o "sin tasa" si todavía no hay tasa para esa fecha).
//   <Money amount={tx.amount} currency={tx.currency} base={tx.amount_base} />
const Money = ({
  amount,
  currency,
  base,                       // equivalente en moneda base (string/number) o null si falta la tasa
  baseCurrency = getBaseCurrency(),
  className = '',
  baseClassName = '',
  sign = '',                  // '-' o '+' delante del valor principal
  align = 'right',
  showBase = true,
}) => {
  const code = currency || baseCurrency;
  const foreign = code !== baseCurrency;
  const main = `${sign}${formatMoney(amount, code)}`;
  const label = `${sign === '-' ? 'menos ' : ''}${moneyAriaLabel(amount, code)}` +
    (foreign && showBase && base != null ? `, equivale a ${moneyAriaLabel(base, baseCurrency)}` : '');

  return (
    <span className={`inline-flex flex-col ${align === 'right' ? 'items-end' : 'items-start'}`} aria-label={label}>
      <span className={className} aria-hidden="true">{main}</span>
      {foreign && showBase && (
        <span className={`text-xs font-normal text-gray-500 dark:text-gray-400 ${baseClassName}`} aria-hidden="true">
          {base != null ? `≈ ${sign}${formatMoney(base, baseCurrency)}` : 'sin tasa aún'}
        </span>
      )}
    </span>
  );
};

export default Money;
