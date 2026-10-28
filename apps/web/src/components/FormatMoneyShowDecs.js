// Monto con los decimales más pequeños que la parte entera (tarjetas de cuenta).
// Usa el mismo formato que formatMoney (Intl, es-CO) y los decimales de la moneda.
import { formatMoney, getBaseCurrency, getCurrency, moneyAriaLabel } from "./helpers";

const FormatMoneyShowDecs = ({
  numb = 0,
  showDecimals = true,
  intClass = "",   // e.g. "text-3xl sm:text-4xl md:text-5xl lg:text-6xl"
  decClass = "",   // e.g. "text-base sm:text-lg md:text-xl lg:text-2xl"
  sizeInt = 24,    // used only if intClass not provided
  sizeDec = 16,    // used only if decClass not provided
  currency = getBaseCurrency(),
  base,              // equivalente en moneda base (amount_base): se muestra en gris si la moneda no es la base
  showBase = true,
  align = 'end',     // alineación del equivalente: 'start' | 'end'
}) => {
  const baseCurrency = getBaseCurrency();
  const foreign = showBase && currency !== baseCurrency;
  const n = Number(numb) || 0;
  const digits = getCurrency(currency).minor_units;
  let parts;
  try {
    parts = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      minimumFractionDigits: showDecimals ? digits : 0,
      maximumFractionDigits: showDecimals ? digits : 0,
    }).formatToParts(n);
  } catch {
    parts = [{ type: 'integer', value: n.toFixed(0) }];
  }
  const fraction = parts.filter(p => p.type === 'fraction').map(p => p.value).join('');
  const head = parts.filter(p => p.type !== 'fraction' && p.type !== 'decimal').map(p => p.value).join('');
  const decimal = parts.find(p => p.type === 'decimal')?.value ?? ',';

  const ariaLabel = moneyAriaLabel(n, currency) +
    (foreign && base != null ? `, equivale a ${moneyAriaLabel(base, baseCurrency)}` : '');
  const amount = (
    <span className="inline-flex items-baseline" aria-label={foreign ? undefined : ariaLabel}>
      <span
        aria-hidden="true"
        className={intClass}
        style={!intClass ? { fontSize: `${sizeInt}px`, lineHeight: 1 } : undefined}
      >
        {head}
        {fraction && decimal}
      </span>
      {fraction && (
        <span
          aria-hidden="true"
          className={decClass}
          style={!decClass ? { fontSize: `${sizeDec}px`, lineHeight: 1 } : undefined}
        >
          {fraction}
        </span>
      )}
    </span>
  );
  if (!foreign) return amount;
  return (
    <span className={`inline-flex flex-col ${align === 'start' ? 'items-start' : 'items-end'}`} aria-label={ariaLabel}>
      {amount}
      <span aria-hidden="true" className="text-[10px] lg:text-xs font-normal text-gray-500 dark:text-gray-400 leading-tight">
        {base != null ? `≈ ${formatMoney(base, baseCurrency)}` : 'sin tasa aún'}
      </span>
    </span>
  );
};

export default FormatMoneyShowDecs;
