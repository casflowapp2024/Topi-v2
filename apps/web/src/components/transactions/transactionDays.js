import moment from 'moment';
import 'moment/locale/es';
import { formatMoney } from '../helpers';

// La API manda la fecha ya en la hora del usuario: el día son los primeros 10 caracteres
const dayKey = (tx) => tx.date.split(' ')[0];

// Transacciones agrupadas por día, del más reciente al más viejo: [{ date, items }]
export const groupByDay = (items) => {
  const groups = new Map();
  (items || []).forEach(tx => {
    const key = dayKey(tx);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(tx);
  });
  return [...groups.keys()].sort().reverse().map(date => ({ date, items: groups.get(date) }));
};

// "Hoy, 30 oct" / "Ayer, 29 oct" / "lun 27 oct" (con el año si no es el actual)
export const dayLabel = (date, now = new Date()) => {
  const day = moment(date, 'YYYY-MM-DD').locale('es');
  const today = moment(now).startOf('day');
  const short = (format) => day.format(format).replace(/\./g, '');
  if (day.isSame(today, 'day')) return `Hoy, ${short('D MMM')}`;
  if (day.isSame(today.clone().subtract(1, 'day'), 'day')) return `Ayer, ${short('D MMM')}`;
  return short(day.isSame(today, 'year') ? 'ddd D MMM' : 'ddd D MMM YYYY');
};

// Transferencias y pagos de tarjeta sin su otra pata mueven plata entre cuentas propias: ni ingreso ni gasto
export const isNeutral = (tx) => Boolean(tx.transfer_group_id || tx.needs_counterpart);

// Rótulo de una compra a cuotas: "6 cuotas de $ 200.000" si se reparte en los reportes
export const installmentsLabel = (tx) => {
  if (!(tx.installments > 1)) return '';
  return tx.installment_amount ? `${tx.installments} cuotas de ${formatMoney(tx.installment_amount, tx.currency)}` : `${tx.installments} cuotas`;
};

// Neto del día en moneda base, sin lo neutral; null si solo hubo movimientos neutrales. Una compra
// a cuotas pesa su cuota, como en los reportes.
// Lo calcula el front porque la API no da totales por día; una transacción sin tasa no suma.
export const dayNet = (items) => {
  const flows = (items || []).filter(tx => !isNeutral(tx));
  if (flows.length === 0) return null;
  return flows.reduce((sum, tx) => sum + (tx.expense ? -1 : 1) * Number(tx.installment_amount_base ?? tx.amount_base ?? 0), 0);
};
