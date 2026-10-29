import { BanknotesIcon, CreditCardIcon, PresentationChartLineIcon, ArchiveBoxIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { accountClass, isOpenAccount } from '../../helpers';

// Grupos de la vista Cuentas. Las cerradas van aparte, sin importar su clase.
// 'all' es la vista de patrimonio (no es un grupo de cuentas)
export const ALL_GROUP = { id: 'all', label: 'Todo', title: 'Patrimonio', Icon: ScaleIcon, tint: 'bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300' };

export const ACCOUNT_GROUPS = [
  { id: 'deposit', label: 'Efectivo', title: 'Cuentas de efectivo', Icon: BanknotesIcon, tint: 'bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  { id: 'credit', label: 'Tarjetas', title: 'Tarjetas de crédito', Icon: CreditCardIcon, tint: 'bg-orange-50 text-money-out dark:bg-orange-500/15 dark:text-money-out-dark' },
  { id: 'investment', label: 'Inversiones', title: 'Inversiones', Icon: PresentationChartLineIcon, tint: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300' },
  { id: 'closed', label: 'Cerradas', title: 'Cuentas cerradas', Icon: ArchiveBoxIcon, tint: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
];

export const groupOfAccount = (account) => (isOpenAccount(account) ? accountClass(account) : 'closed');
export const accountsOfGroup = (items, group) => (items || []).filter(a => groupOfAccount(a) === group);
