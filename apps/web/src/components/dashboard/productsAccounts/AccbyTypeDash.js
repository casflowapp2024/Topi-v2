import { useEffect, useMemo } from 'react';
import { connect } from 'react-redux';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import { get_net_worth } from '../../../redux/actions/fx';
import { PlusIcon, EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import Chip from '../../ui/Chip';
import AccountBalance from '../../ui/AccountBalance';
import EmptyState from '../../ui/EmptyState';
import { getBaseCurrency } from '../../helpers';
import { ACCOUNT_GROUPS, accountsOfGroup } from './accountGroups';

/**
 * Mis cuentas: un selector por grupo (Efectivo, Tarjetas, Inversiones, Cerradas) y la lista de ese
 * grupo con su saldo. Elegir una cuenta la abre en el panel de la derecha.
 */
const AccbyTypeDash = ({
  user_accounts, account_activated, net_worth, group, onGroupChange,
  set_dash_account_activated, get_net_worth, onOpenDetail, onOpenCreate,
}) => {
  useEffect(() => { get_net_worth(); }, [get_net_worth, user_accounts]);
  const items = user_accounts?.items;
  const nwById = useMemo(() => new Map((net_worth?.accounts || []).map(a => [a.account_id, a])), [net_worth]);
  const baseCurrency = net_worth?.base_currency || getBaseCurrency();

  const groups = ACCOUNT_GROUPS.map(g => ({ ...g, accounts: accountsOfGroup(items, g.id) }))
    .filter(g => g.accounts.length > 0 || g.id === group);
  const current = groups.find(g => g.id === group) || groups[0];
  const list = current?.accounts || [];

  return (
    <div className="p-4 sm:p-5 bg-white dark:bg-gray-800 rounded-xl shadow-md transition-colors duration-300">
      <div className="flex justify-between items-center gap-2 mb-3">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Mis cuentas</h2>
        <button type="button" onClick={onOpenCreate}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-topi-500 hover:bg-topi-600 text-white text-sm font-semibold shadow-sm transition-colors">
          <PlusIcon className="w-4 h-4" aria-hidden="true" /> Agregar
        </button>
      </div>

      {/* Selector de grupo */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-5 sm:px-5 pb-3" role="tablist" aria-label="Tipo de cuenta">
        {groups.map(g => (
          <Chip key={g.id} role="tab" aria-selected={g.id === current?.id} selected={g.id === current?.id}
            icon={g.Icon} onClick={() => onGroupChange(g.id)}>
            {g.label} <span className={g.id === current?.id ? 'text-white/80' : 'text-ink-2 dark:text-gray-400'}>{g.accounts.length}</span>
          </Chip>
        ))}
      </div>

      {!items ? (
        <p className="text-sm text-ink-2 dark:text-gray-400">Cargando…</p>
      ) : list.length === 0 ? (
        <EmptyState compact icon={current?.Icon} title={`No tienes ${current?.title?.toLowerCase() || 'cuentas'}`}
          description="Agrégala con el botón Agregar." />
      ) : (
        <ul className="flex flex-col gap-1 max-h-[300px] md:max-h-[340px] overflow-y-auto -mx-1 px-1" role="tabpanel">
          {current.id === 'closed' && (
            <li className="text-xs text-ink-2 dark:text-gray-400 px-2 pb-1">
              Conservan su historia y siguen en tus reportes, pero no aparecen en el inicio ni para movimientos nuevos.
            </li>
          )}
          {list.map(account => {
            const active = account.id === account_activated?.id;
            return (
              <li key={account.id}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => set_dash_account_activated(account)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set_dash_account_activated(account); } }}
                  aria-current={active || undefined}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${active
                    ? 'bg-topi-50 dark:bg-indigo-500/15 ring-1 ring-topi-500/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'}`}
                >
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold truncate ${active ? 'text-topi-600 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100'}`}>{account.name}</span>
                    <span className="block text-xs text-ink-2 dark:text-gray-400 truncate">
                      {account.bank?.name}{account.last_four_digits ? ` · ••${account.last_four_digits}` : ''}{current.id === 'closed' ? ` · ${account.type?.name || ''}` : ''}
                    </span>
                  </span>
                  <AccountBalance account={account} nw={nwById.get(account.id)} baseCurrency={baseCurrency} />
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenDetail(account.id); }}
                    aria-label={`Ver y editar ${account.name}`}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-100 transition-colors">
                    <EllipsisHorizontalIcon className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const mapStateToProps = state => ({
  user_accounts: state.CashFlow.user_accounts,
  account_activated: state.Reports.account_activated,
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { set_dash_account_activated, get_net_worth })(AccbyTypeDash);
