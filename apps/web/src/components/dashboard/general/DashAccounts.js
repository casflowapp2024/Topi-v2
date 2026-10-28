import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
import { set_dash_account_activated } from '../../../redux/actions/reports';
//components
import { formatCurrency } from '../../helpers';
import {
  BanknotesIcon, BuildingLibraryIcon, ArrowTrendingUpIcon, CreditCardIcon, ChevronRightIcon, PlusIcon,
} from '@heroicons/react/20/solid';

// Tipos de cuenta (mismos ids que AccbyTypeDash)
const TYPE_STYLE = {
  1: { Icon: BanknotesIcon, tint: 'bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  2: { Icon: BuildingLibraryIcon, tint: 'bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  3: { Icon: ArrowTrendingUpIcon, tint: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  4: { Icon: CreditCardIcon, tint: 'bg-orange-50 text-money-out dark:bg-orange-500/15 dark:text-money-out-dark' },
};
const MAX_VISIBLE = 6;

const DashAccounts = ({ user_accounts, balance_by_account, set_dash_account_activated }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const { rows, total } = useMemo(() => {
    const items = user_accounts?.items || [];
    const balances = new Map((balance_by_account || []).map(b => [b.account_id, b.balance]));
    const rows = items.map(acc => ({ acc, balance: balances.has(acc.id) ? Number(balances.get(acc.id)) : null }));
    // Primero las que tienen saldo, de mayor a menor
    rows.sort((a, b) => (b.balance ?? -Infinity) - (a.balance ?? -Infinity));
    const total = rows.reduce((sum, r) => sum + (r.balance && r.balance > 0 ? r.balance : 0), 0);
    return { rows, total };
  }, [user_accounts, balance_by_account]);

  const openAccount = (acc) => {
    set_dash_account_activated(acc);
    navigate('/dashboard/accounts');
  };

  const visible = showAll ? rows : rows.slice(0, MAX_VISIBLE);
  const hidden = rows.length - visible.length;

  return (
    <section className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow p-4 transition-colors duration-300">
      <header className="flex items-end justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Mis cuentas</h2>
          {total > 0 && (
            <span className="text-xs text-ink-2 dark:text-gray-400">
              Disponible en ahorro: <b className="text-gray-900 dark:text-gray-100 tabular-nums">{formatCurrency(total)}</b>
            </span>
          )}
        </div>
        <Link to="accounts" className="text-xs font-medium text-topi-600 dark:text-indigo-300 hover:underline inline-flex items-center">
          Ver detalle <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="text-sm text-ink-2 dark:text-gray-400">Aún no tienes cuentas. Agrega una para ver tus saldos aquí.</p>
          <Link to="accounts" className="inline-flex items-center gap-1 rounded-xl bg-topi-500 hover:bg-topi-600 text-white text-sm font-medium px-3 py-2 transition-colors">
            <PlusIcon className="w-4 h-4" aria-hidden="true" /> Agregar cuenta
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3">
          {visible.map(({ acc, balance }) => {
            const style = TYPE_STYLE[parseInt(acc.type?.id)] || TYPE_STYLE[1];
            const { Icon } = style;
            const share = balance && balance > 0 && total > 0 ? Math.round((balance / total) * 100) : null;
            return (
              <li key={acc.id}>
                <button
                  type="button"
                  onClick={() => openAccount(acc)}
                  className="group w-full text-left flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 p-3 hover:border-topi-500/40 hover:bg-topi-50/60 dark:hover:bg-gray-700/60 active:scale-[0.99] transition-all"
                >
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${style.tint}`}>
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{acc.name}</span>
                    <span className="text-xs text-ink-2 dark:text-gray-400 truncate">
                      {acc.bank?.name || acc.type?.name}{acc.last_four_digits ? ` · ••${acc.last_four_digits}` : ''}
                    </span>
                    {share !== null && (
                      <span className="mt-1.5 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-700" title={`${share}% de tu ahorro`}>
                        <span className="block h-full rounded-full bg-topi-500" style={{ width: `${share}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col items-end shrink-0">
                    {balance !== null ? (
                      <span className={`text-sm font-bold tabular-nums ${balance < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>
                        {formatCurrency(balance)}
                      </span>
                    ) : (
                      <span className="text-xs text-ink-2 dark:text-gray-400">{acc.type?.name}</span>
                    )}
                    <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-topi-500 transition-colors" aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
          {hidden > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full h-full min-h-[62px] rounded-xl border border-dashed border-gray-300 dark:border-gray-600 text-sm font-medium text-topi-600 dark:text-indigo-300 hover:bg-topi-50/60 dark:hover:bg-gray-700/60 transition-colors"
              >
                Ver {hidden} más
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
};

const mapStateToProps = state => ({
  user_accounts: state.CashFlow.user_accounts,
  balance_by_account: state.Reports.balance_by_account,
});

export default connect(mapStateToProps, { set_dash_account_activated })(DashAccounts);
