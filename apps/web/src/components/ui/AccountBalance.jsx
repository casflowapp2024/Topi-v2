import Money from './Money';
import { accountClass } from '../helpers';

/**
 * Saldo de una cuenta con su significado: en tarjetas, "Deuda" (saldo negativo) o "Pagado de más"
 * (casi siempre intereses o cuota de manejo sin registrar); en las demás, el saldo con su color. nw = fila de /analysis/net-worth.
 */
const AccountBalance = ({ account, nw, baseCurrency, size = 'sm' }) => {
  if (!nw) return null;
  const balance = Number(nw.balance);
  const text = size === 'lg' ? 'text-base' : 'text-sm';
  if (accountClass(account) === 'credit') {
    return (
      <span className="flex flex-col items-end">
        <span className="text-[11px] font-medium text-ink-2 dark:text-gray-400">
          {balance < 0 ? 'Deuda' : balance > 0 ? 'Pagado de más' : 'Sin deuda'}
        </span>
        <Money amount={Math.abs(balance)} currency={nw.currency}
          base={nw.base_value != null ? Math.abs(Number(nw.base_value)) : null} baseCurrency={baseCurrency}
          className={`${text} font-bold tabular-nums ${balance < 0 ? 'text-money-out dark:text-money-out-dark' : balance > 0 ? 'text-status-warn-text dark:text-amber-300' : 'text-gray-900 dark:text-gray-100'}`} />
      </span>
    );
  }
  return (
    <Money amount={nw.balance} currency={nw.currency} base={nw.base_value} baseCurrency={baseCurrency}
      className={`${text} font-bold tabular-nums ${balance < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`} />
  );
};

export default AccountBalance;
