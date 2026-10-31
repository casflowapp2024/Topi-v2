import { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import 'moment/locale/es';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, ChevronUpDownIcon, PencilSquareIcon, CheckIcon } from '@heroicons/react/20/solid';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import AccountBalance from '../../ui/AccountBalance';
import Button from '../../ui/Button';
import { getBaseCurrency, accountClass, formatMoney } from '../../helpers';
import { ACCOUNT_GROUPS, accountsOfGroup } from './accountGroups';

/**
 * La cuenta que estás viendo: a la izquierda quién es y el periodo; a la derecha lo que pasó en ese
 * periodo (según su tipo). Para pasar a las otras cuentas del grupo:
 *  - rieles ‹ › a los lados, de toda la altura (y las teclas ← →)
 *  - deslizar a los lados en el celular
 *  - tocar el nombre abre la lista del grupo con sus saldos (rápido si hay muchas cuentas)
 *  - puntos que dicen cuántas hay y en cuál estás
 */
// Periodo elegido, para rotular las cifras: "16 oct. – 15 nov." (con el año si no es el actual)
const periodLabel = (from, to) => {
  if (!from || !to) return '';
  const pattern = moment(from).isSame(moment(), 'year') && moment(to).isSame(moment(), 'year') ? 'D MMM' : 'D MMM YYYY';
  const format = (d) => moment(d).locale('es').format(pattern);
  return `${format(from)} – ${format(to)}`;
};

// Cifras del periodo según el tipo de cuenta (data = /analysis/accounts-report de la cuenta)
const periodKpis = (cls, data) => {
  const inc = Math.abs(Number(data?.income?.value ?? 0));
  const exp = Math.abs(Number(data?.expenses?.value ?? 0));
  const bal = Number(data?.balance?.value ?? 0);
  if (cls === 'credit') {
    return {
      rows: [
        { label: 'Compras y cargos', value: formatMoney(exp), tone: 'out' },
        { label: 'Pagos', value: formatMoney(inc), tone: 'in' },
      ],
    };
  }
  if (cls === 'investment') {
    return {
      rows: [
        { label: 'Aportes', value: formatMoney(inc), tone: 'in' },
        { label: 'Retiros', value: formatMoney(exp), tone: 'out' },
        { label: 'Valor al final', value: formatMoney(bal) },
      ],
    };
  }
  const net = inc - exp;
  return {
    rows: [
      { label: 'Entró', value: formatMoney(inc), tone: 'in' },
      { label: 'Salió', value: formatMoney(exp), tone: 'out' },
      { label: 'Saldo al final', value: formatMoney(bal), tone: bal < 0 ? 'out' : undefined },
    ],
    note: `${net >= 0 ? 'Entró' : 'Salió'} ${formatMoney(Math.abs(net))} más de lo que ${net >= 0 ? 'salió' : 'entró'}.`,
  };
};

const AccountSwitcher = ({ group, account_activated, account_activated_stats, iniDate_account_dash, endDate_account_dash, user_accounts, net_worth, set_dash_account_activated, onEdit, children }) => {
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
  const onTouchStart = (e) => {
    // No en los controles del periodo (interruptores, calendario) ni en la lista abierta
    if (e.target.closest?.('[data-no-swipe], [role="radiogroup"], [role="menu"], input')) { touch.current = null; return; }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  };

  if (!account_activated) return null;
  const cls = accountClass(account_activated);
  const kpis = periodKpis(cls, account_activated_stats);
  const period = periodLabel(iniDate_account_dash, endDate_account_dash);
  const rail = 'shrink-0 w-9 sm:w-10 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-topi-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-25 disabled:pointer-events-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-topi-500';

  return (
    <section
      className="relative flex items-stretch bg-white dark:bg-gray-800 rounded-2xl shadow-md overflow-hidden"
      aria-label="Cuenta que estás viendo"
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
    >
      {/* Rieles laterales: toda la altura de la tarjeta para pasar a la cuenta anterior / siguiente */}
      <button type="button" className={`${rail} border-r border-gray-100 dark:border-gray-700`} onClick={() => go(-1)} disabled={!many} aria-label="Cuenta anterior">
        <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
      </button>

      <div className={`flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-2 transition-all duration-200 motion-reduce:transition-none ${dir > 0 ? 'translate-x-1 opacity-70' : dir < 0 ? '-translate-x-1 opacity-70' : ''}`}>
        {/* Izquierda: qué cuenta es y de qué periodo */}
        <div className="p-4 flex flex-col gap-3 min-w-0"
          onKeyDown={(e) => { if (e.target.closest?.('[role="menu"]')) return; if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}>
          <div className="flex items-center justify-between gap-2">
            {many && accounts.length <= 12 ? (
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {accounts.map((a, i) => (
                  <span key={a.id} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-topi-500' : 'w-1.5 bg-gray-300 dark:bg-gray-600'}`} />
                ))}
              </span>
            ) : <span />}
            <Button size="sm" variant="secondary" icon={PencilSquareIcon} onClick={() => onEdit(account_activated.id)}>
              <span className="hidden sm:inline">Editar</span>
            </Button>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            {meta && <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${meta.tint}`}><meta.Icon className="w-5 h-5" aria-hidden="true" /></span>}
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
          </div>

          {/* En tarjetas el saldo lleva su palabra encima: "Hoy" se alinea con la cifra, no con el bloque */}
          <div className={`flex gap-2 text-xs text-ink-2 dark:text-gray-400 ${cls === 'credit' ? 'items-end' : 'items-center'}`}>
            <span className={cls === 'credit' ? 'pb-0.5' : undefined}>Hoy:</span><AccountBalance account={account_activated} nw={nwById.get(account_activated.id)} baseCurrency={base} />
          </div>

          <div data-no-swipe>{children}</div>
        </div>

        {/* Derecha: lo que pasó en el periodo elegido */}
        <div className="p-4 pt-0 lg:pt-4 lg:border-l border-gray-100 dark:border-gray-700 flex flex-col justify-center min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400 mb-1">
            En el periodo{period && <span className="font-medium normal-case tracking-normal"> · {period}</span>}
          </p>
          <dl className="divide-y divide-gray-100 dark:divide-gray-700">
            {kpis.rows.map(k => (
              <div key={k.label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-sm text-ink-2 dark:text-gray-400">{k.label}</dt>
                <dd className={`text-lg font-bold tabular-nums truncate ${k.tone === 'in' ? 'text-money-in dark:text-money-in-dark' : k.tone === 'out' ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>
                  {account_activated_stats ? k.value : '—'}
                </dd>
              </div>
            ))}
          </dl>
          {account_activated_stats && kpis.note && <p className="mt-1 text-xs text-ink-2 dark:text-gray-400">{kpis.note}</p>}
        </div>
      </div>

      <button type="button" className={`${rail} border-l border-gray-100 dark:border-gray-700`} onClick={() => go(1)} disabled={!many} aria-label="Cuenta siguiente">
        <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
      </button>
    </section>
  );
};

const mapStateToProps = state => ({
  account_activated: state.Reports.account_activated,
  account_activated_stats: state.Reports.account_activated_stats,
  iniDate_account_dash: state.Reports.iniDate_account_dash,
  endDate_account_dash: state.Reports.endDate_account_dash,
  user_accounts: state.CashFlow.user_accounts,
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { set_dash_account_activated })(AccountSwitcher);
