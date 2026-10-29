import { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, PencilSquareIcon, CheckIcon } from '@heroicons/react/20/solid';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import AccountBalance from '../../ui/AccountBalance';
import Button from '../../ui/Button';
import { getBaseCurrency } from '../../helpers';
import { ACCOUNT_GROUPS, accountsOfGroup } from './accountGroups';

/**
 * Encabezado del detalle con la cuenta que estás viendo y cómo pasar a las otras del grupo:
 *  - flechas ‹ › (y las teclas ← → con el foco en esa fila)
 *  - deslizar a los lados en el celular
 *  - tocar el nombre abre la lista del grupo con sus saldos (rápido si hay muchas cuentas)
 *  - puntos que dicen cuántas hay y en cuál estás
 */
const AccountSwitcher = ({ group, account_activated, user_accounts, net_worth, set_dash_account_activated, onEdit, children }) => {
  const accounts = useMemo(() => accountsOfGroup(user_accounts?.items, group), [user_accounts, group]);
  const idx = Math.max(0, accounts.findIndex(a => a.id === account_activated?.id));
  const nwById = useMemo(() => new Map((net_worth?.accounts || []).map(a => [a.account_id, a])), [net_worth]);
  const base = net_worth?.base_currency || getBaseCurrency();
  const meta = ACCOUNT_GROUPS.find(g => g.id === group);
  const many = accounts.length > 1;

  // Animación corta al cambiar de cuenta, en la dirección del movimiento
  const [dir, setDir] = useState(0);
  const go = (step) => {
    if (!many) return;
    setDir(step);
    set_dash_account_activated(accounts[(idx + step + accounts.length) % accounts.length]);
  };
  useEffect(() => { if (dir) { const t = setTimeout(() => setDir(0), 220); return () => clearTimeout(t); } }, [dir, account_activated?.id]);

  // Deslizar en el celular
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  if (!account_activated) return null;
  const arrow = 'w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-topi-500 disabled:opacity-30 disabled:pointer-events-none transition-colors';

  return (
    <section
      className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md flex flex-col gap-3 overflow-hidden"
      aria-label="Cuenta que estás viendo"
    >
      {/* ← → solo en esta fila (no en el calendario ni en los controles del periodo) */}
      <div className="flex items-center gap-2" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        onKeyDown={(e) => { if (e.target.closest?.('[role="menu"]')) return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}>
        <button type="button" className={arrow} onClick={() => go(-1)} disabled={!many} aria-label="Cuenta anterior">
          <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className={`flex-1 min-w-0 flex items-center gap-3 transition-all duration-200 motion-reduce:transition-none ${dir > 0 ? 'translate-x-2 opacity-70' : dir < 0 ? '-translate-x-2 opacity-70' : ''}`}>
          {meta && <span className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center shrink-0 ${meta.tint}`}><meta.Icon className="w-5 h-5" aria-hidden="true" /></span>}
          <Menu as="div" className="relative min-w-0 flex-1">
            <MenuButton className="group max-w-full flex items-center gap-1 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500" aria-label={`${account_activated.name}. Elegir otra cuenta`}>
              <span className="min-w-0">
                <span className="flex items-center gap-1">
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">{account_activated.name}</span>
                  {many && <ChevronUpDownIcon className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-topi-500" aria-hidden="true" />}
                </span>
                <span className="block text-xs text-ink-2 dark:text-gray-400 truncate">
                  {account_activated.bank?.name}{account_activated.last_four_digits ? ` · ••${account_activated.last_four_digits}` : ''} · {account_activated.currency || 'COP'}
                  {many ? ` · ${idx + 1} de ${accounts.length}` : ''}
                </span>
              </span>
            </MenuButton>
            {many && (
              <MenuItems anchor={{ to: 'bottom start', gap: 6 }}
                className="z-50 w-[min(22rem,calc(100vw-2rem))] max-h-80 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 shadow-xl focus:outline-none">
                {accounts.map(a => (
                  <MenuItem key={a.id}>
                    <button type="button" onClick={() => set_dash_account_activated(a)}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left data-[focus]:bg-gray-100 dark:data-[focus]:bg-gray-700">
                      <span className="w-4 shrink-0">{a.id === account_activated.id && <CheckIcon className="w-4 h-4 text-topi-500" aria-hidden="true" />}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{a.name}</span>
                        <span className="block text-xs text-ink-2 dark:text-gray-400 truncate">{a.bank?.name}{a.last_four_digits ? ` · ••${a.last_four_digits}` : ''}</span>
                      </span>
                      <AccountBalance account={a} nw={nwById.get(a.id)} baseCurrency={base} />
                    </button>
                  </MenuItem>
                ))}
              </MenuItems>
            )}
          </Menu>
          <span className="hidden sm:block shrink-0"><AccountBalance account={account_activated} nw={nwById.get(account_activated.id)} baseCurrency={base} size="lg" /></span>
        </div>

        <button type="button" className={arrow} onClick={() => go(1)} disabled={!many} aria-label="Cuenta siguiente">
          <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* En móvil el saldo va en su propia fila; los puntos dicen cuántas cuentas hay */}
      <div className="flex items-center justify-between gap-2">
        <span className="sm:hidden"><AccountBalance account={account_activated} nw={nwById.get(account_activated.id)} baseCurrency={base} size="lg" /></span>
        {many && accounts.length <= 12 && (
          <span className="flex items-center gap-1.5 sm:mx-auto" aria-hidden="true">
            {accounts.map((a, i) => (
              <span key={a.id} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-topi-500' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`} />
            ))}
          </span>
        )}
        <Button size="sm" variant="secondary" icon={PencilSquareIcon} onClick={() => onEdit(account_activated.id)}>
          <span className="hidden sm:inline">Editar</span>
        </Button>
      </div>

      {children}
    </section>
  );
};

const mapStateToProps = state => ({
  account_activated: state.Reports.account_activated,
  user_accounts: state.CashFlow.user_accounts,
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { set_dash_account_activated })(AccountSwitcher);
