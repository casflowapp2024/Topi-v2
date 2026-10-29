import { connect } from 'react-redux';
import { PlusIcon } from '@heroicons/react/20/solid';
import Chip from '../../ui/Chip';
import { ACCOUNT_GROUPS, ALL_GROUP, accountsOfGroup } from './accountGroups';

// Barra de tipos de cuenta: Todo (patrimonio) · Efectivo · Tarjetas · Inversiones, "Cerradas" como
// enlace discreto y "Agregar cuenta". Se desliza en móvil sin mover la página.
const AccountsTypeBar = ({ user_accounts, group, onChange, onCreate }) => {
  const items = user_accounts?.items || [];
  const groups = ACCOUNT_GROUPS.filter(g => g.id !== 'closed').map(g => ({ ...g, count: accountsOfGroup(items, g.id).length }))
    .filter(g => g.count > 0 || g.id === group);
  const closed = accountsOfGroup(items, 'closed').length;

  return (
    <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-md flex items-center gap-2 transition-colors duration-300">
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto hide-scrollbar" role="tablist" aria-label="Tipo de cuenta">
        {[{ ...ALL_GROUP, count: items.filter(a => !a.closed_at).length }, ...groups].map(g => (
          <Chip key={g.id} role="tab" aria-selected={g.id === group} selected={g.id === group} icon={g.Icon} onClick={() => onChange(g.id)}>
            {g.label} <span className={g.id === group ? 'text-white/80' : 'text-ink-2 dark:text-gray-400'}>{g.count}</span>
          </Chip>
        ))}
        {closed > 0 && (
          <button type="button" role="tab" aria-selected={group === 'closed'} onClick={() => onChange('closed')}
            className={`shrink-0 h-8 px-2 text-sm font-medium rounded-full transition-colors ${group === 'closed'
              ? 'text-topi-600 dark:text-indigo-300 underline underline-offset-4'
              : 'text-ink-2 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
            Cerradas ({closed})
          </button>
        )}
      </div>
      <button type="button" onClick={onCreate}
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-topi-500 hover:bg-topi-600 text-white text-sm font-semibold shadow-sm transition-colors">
        <PlusIcon className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Agregar cuenta</span>
      </button>
    </div>
  );
};

export default connect(state => ({ user_accounts: state.CashFlow.user_accounts }))(AccountsTypeBar);
