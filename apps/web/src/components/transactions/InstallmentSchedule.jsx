import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
import 'moment/locale/es';
import { fetch_installments } from '../../redux/actions/creditCards';
import { formatMoney } from '../helpers';

const monthLabel = (date) => moment(date).locale('es').format('MMMM YYYY');

// Calendario de una compra a cuotas: en qué mes pesa cada una. Sale de la API: si cambian las cuotas, cambia solo.
const InstallmentSchedule = ({ transactionId, installments }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;
    setRows([]);
    if (transactionId && installments > 1) {
      fetch_installments({ transactionId }).then(list => { if (active) setRows(list || []); });
    }
    return () => { active = false; };
  }, [transactionId, installments]);

  if (rows.length === 0) return null;
  return (
    <div className="mt-2 w-full">
      <p className="text-sm font-medium text-gray-900 dark:text-white">Calendario de cuotas</p>
      <ol className="mt-1 max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map(row => (
          <li key={row.number} className="py-1 flex items-center justify-between gap-3 text-sm text-gray-600 dark:text-gray-300">
            <span className="first-letter:uppercase">{row.number}. {monthLabel(row.budget_date)}</span>
            <span className="tabular-nums">{formatMoney(row.amount, row.currency)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default InstallmentSchedule;
