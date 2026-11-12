import { ArrowUpRightIcon, ArrowDownLeftIcon } from '@heroicons/react/24/outline';

// Flecha de un movimiento neutral (transferencia o pago sin su otra pata): ↗ sale de la cuenta, ↙ entra. Gris de transferencia, nunca rojo/verde.
const TransferDirectionIcon = ({ tx, className = 'w-5 h-5' }) => {
  const out = Boolean(tx.expense);
  const Icon = out ? ArrowUpRightIcon : ArrowDownLeftIcon;
  const label = out ? 'Transferencia que sale' : 'Transferencia que entra';
  return (
    <span title={label} className="shrink-0 inline-flex text-data-transfer dark:text-slate-300">
      <Icon className={className} aria-hidden="true" /><span className="sr-only">{label}</span>
    </span>
  );
};

export default TransferDirectionIcon;
