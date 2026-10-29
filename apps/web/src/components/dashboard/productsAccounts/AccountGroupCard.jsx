import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { EllipsisHorizontalIcon } from '@heroicons/react/20/solid';
import { fetch_credit_cards } from '../../../redux/actions/creditCards';
import { get_net_worth } from '../../../redux/actions/fx';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import AccountBalance from '../../ui/AccountBalance';
import EmptyState from '../../ui/EmptyState';
import { formatMoney, getBaseCurrency } from '../../helpers';
import { ACCOUNT_GROUPS, ALL_GROUP, accountsOfGroup } from './accountGroups';

const Stat = ({ label, value, tone, hint }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">{label}</span>
    <span className={`text-base font-bold tabular-nums truncate ${tone === 'out' ? 'text-money-out dark:text-money-out-dark' : tone === 'in' ? 'text-money-in dark:text-money-in-dark' : tone === 'warn' ? 'text-status-warn-text dark:text-amber-300' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
    {hint && <span className="text-xs text-ink-2 dark:text-gray-400">{hint}</span>}
  </div>
);

const toneOf = (v) => (v < 0 ? 'out' : undefined);

/**
 * El total del grupo y, dentro de la misma tarjeta, las cuentas que lo forman: así el número grande
 * se lee como la suma de esas cuentas. Todo en moneda base con la tasa de hoy.
 * group 'all' = patrimonio: efectivo + inversiones − deudas, con un acceso a cada grupo.
 */
const AccountGroupCard = ({
  group, onGroupChange, onOpenDetail, user_accounts, net_worth, account_activated,
  get_net_worth, set_dash_account_activated,
}) => {
  useEffect(() => { get_net_worth(); }, [get_net_worth, user_accounts]);
  const base = net_worth?.base_currency || getBaseCurrency();
  const nwById = useMemo(() => new Map((net_worth?.accounts || []).map(a => [a.account_id, a])), [net_worth]);
  const [cards, setCards] = useState(null);
  useEffect(() => { if (group === 'credit') fetch_credit_cards().then(list => setCards(list || [])); }, [group, user_accounts]);

  const items = user_accounts?.items || [];
  const sumBase = (accs, pred = () => true) => accs.map(a => nwById.get(a.id)).filter(Boolean).filter(pred)
    .reduce((s, a) => s + Number(a.base_value || 0), 0);

  // ---- Patrimonio
  if (group === 'all') {
    const tiles = ACCOUNT_GROUPS.filter(g => g.id !== 'closed').map(g => {
      const accs = accountsOfGroup(items, g.id);
      const total = sumBase(accs);
      return { ...g, accs, total };
    }).filter(g => g.accs.length > 0);
    const assets = tiles.filter(t => t.id !== 'credit').reduce((s, t) => s + Math.max(0, t.total), 0);
    const debt = Math.abs(tiles.find(t => t.id === 'credit')?.total < 0 ? tiles.find(t => t.id === 'credit').total : 0);
    return (
      <section className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md" aria-label="Patrimonio">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">Patrimonio · hoy</span>
        <p className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{net_worth ? formatMoney(net_worth.total, base) : '—'}</span>
          <span className="text-sm text-ink-2 dark:text-gray-400">lo que tienes menos lo que debes</span>
        </p>
        {/* barra: cuánto es efectivo, cuánto inversiones y cuánto se va en deudas */}
        {assets > 0 && (
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
            {tiles.filter(t => t.id !== 'credit').map(t => (
              <span key={t.id} className={t.id === 'investment' ? 'bg-[#0E9AA7]' : 'bg-topi-500'} style={{ width: `${(Math.max(0, t.total) / (assets + debt)) * 100}%` }} />
            ))}
            {debt > 0 && <span className="bg-data-gasto" style={{ width: `${(debt / (assets + debt)) * 100}%` }} />}
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tiles.map(t => (
            <button key={t.id} type="button" onClick={() => onGroupChange(t.id)}
              className="text-left rounded-xl border border-gray-100 dark:border-gray-700 p-3 hover:border-topi-500/40 hover:bg-topi-50/60 dark:hover:bg-gray-700/60 transition-colors">
              <span className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${t.tint}`}><t.Icon className="w-4 h-4" aria-hidden="true" /></span>
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t.label}</span>
                <span className="ml-auto text-xs text-ink-2 dark:text-gray-400">{t.accs.length} {t.accs.length === 1 ? 'cuenta' : 'cuentas'}</span>
              </span>
              <span className={`mt-2 block text-lg font-bold tabular-nums ${t.id === 'credit' && t.total < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>
                {t.id === 'credit' ? formatMoney(Math.abs(t.total), base) : formatMoney(t.total, base)}
              </span>
              <span className="text-xs text-ink-2 dark:text-gray-400">{t.id === 'credit' ? (t.total < 0 ? 'de deuda' : 'sin deuda') : t.id === 'investment' ? 'valor hoy' : 'disponible'}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  // ---- Un grupo
  const meta = ACCOUNT_GROUPS.find(g => g.id === group) || ACCOUNT_GROUPS[0];
  const accs = accountsOfGroup(items, group);
  const rows = accs.map(a => nwById.get(a.id)).filter(Boolean);
  let headline = null;
  let stats = [];
  if (group === 'deposit') {
    const total = sumBase(accs);
    headline = { label: 'Efectivo en cuentas · hoy', value: formatMoney(total, base), tone: toneOf(total) };
  } else if (group === 'credit') {
    const debt = Math.abs(sumBase(accs, a => Number(a.balance) < 0));
    const over = sumBase(accs, a => Number(a.balance) > 0);
    const open = (cards || []).filter(c => accs.some(a => a.id === c.account_id));
    const available = open.filter(c => c.available != null && c.currency === base).reduce((s, c) => s + Number(c.available), 0);
    const next = open.filter(c => Number(c.pending_statement) > 0 && c.due_date).sort((a, b) => moment(a.due_date) - moment(b.due_date))[0];
    headline = { label: 'Tarjetas de crédito · deuda hoy', value: formatMoney(debt, base), tone: debt > 0 ? 'out' : undefined };
    stats = [
      available > 0 && { label: 'Cupo disponible', value: formatMoney(available, base) },
      next && { label: 'Próximo pago', value: formatMoney(next.pending_statement, next.currency), tone: 'warn', hint: `${next.name} · antes del ${moment(next.due_date).format('D MMM')}` },
      over > 0 && { label: 'Pagado de más', value: formatMoney(over, base), tone: 'warn', hint: 'Cargos sin registrar' },
    ];
  } else if (group === 'investment') {
    const total = sumBase(accs);
    const sameCurrency = rows.every(a => a.currency === base);
    const gain = rows.reduce((s, a) => s + Number(a.market_gain || 0), 0);
    headline = { label: 'Inversiones · valor hoy', value: formatMoney(total, base) };
    stats = [
      sameCurrency && rows.some(a => a.market_gain != null) && { label: 'Ganancia', value: `${gain > 0 ? '+' : ''}${formatMoney(gain, base)}`, tone: gain < 0 ? 'out' : 'in', hint: 'Valor menos lo aportado' },
    ];
  } else {
    headline = { label: 'Cuentas cerradas', value: String(accs.length) };
  }
  const depositTotal = group === 'deposit' ? sumBase(accs, a => Number(a.base_value) > 0) : 0;

  return (
    <section className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md" aria-label={meta.title}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">{headline.label}</span>
          <p className={`text-3xl font-extrabold tabular-nums ${headline.tone === 'out' ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>{headline.value}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {stats.filter(Boolean).map(s => <Stat key={s.label} {...s} />)}
        </div>
      </div>
      {group === 'closed' && (
        <p className="mt-2 text-xs text-ink-2 dark:text-gray-400">Conservan su historia y siguen en tus reportes, pero no aparecen en el inicio ni para movimientos nuevos.</p>
      )}

      {accs.length === 0 ? (
        <EmptyState compact icon={meta.Icon} title={`No tienes ${meta.title.toLowerCase()}`} description="Agrégala con «Agregar cuenta»." />
      ) : (
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2" role="listbox" aria-label={`Cuentas: ${meta.title}`}>
          {accs.map(acc => {
            const nw = nwById.get(acc.id);
            const active = acc.id === account_activated?.id;
            const share = group === 'deposit' && nw && Number(nw.base_value) > 0 && depositTotal > 0 ? Math.round(Number(nw.base_value) / depositTotal * 100) : null;
            const card = group === 'credit' ? (cards || []).find(c => c.account_id === acc.id) : null;
            const used = card?.credit_limit ? Math.min(100, Math.round(Number(card.debt || 0) / Number(card.credit_limit) * 100)) : null;
            return (
              <li key={acc.id} role="option" aria-selected={active}>
                <div role="button" tabIndex={0}
                  onClick={() => set_dash_account_activated(acc)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set_dash_account_activated(acc); } }}
                  className={`group h-full flex flex-col gap-1.5 rounded-xl border p-3 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${active
                    ? 'border-topi-500 bg-topi-50 dark:bg-indigo-500/15'
                    : 'border-gray-100 dark:border-gray-700 hover:border-topi-500/40 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                  <div className="flex items-start gap-2">
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-semibold truncate ${active ? 'text-topi-600 dark:text-indigo-200' : 'text-gray-900 dark:text-gray-100'}`}>{acc.name}</span>
                      <span className="block text-xs text-ink-2 dark:text-gray-400 truncate">{acc.bank?.name}{acc.last_four_digits ? ` · ••${acc.last_four_digits}` : ''}</span>
                    </span>
                    <AccountBalance account={acc} nw={nw} baseCurrency={base} />
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenDetail(acc.id); }} aria-label={`Editar ${acc.name}`}
                      className="p-1 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-100">
                      <EllipsisHorizontalIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </div>
                  {share !== null && (
                    <span className="flex items-center gap-2 text-[11px] text-ink-2 dark:text-gray-400">
                      <span className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-700"><span className="block h-full rounded-full bg-topi-500" style={{ width: `${share}%` }} /></span>
                      {share}% de tu efectivo
                    </span>
                  )}
                  {used !== null && (
                    <span className="flex items-center gap-2 text-[11px] text-ink-2 dark:text-gray-400">
                      <span className="flex-1 h-1 rounded-full bg-gray-100 dark:bg-gray-700"><span className={`block h-full rounded-full ${used >= 90 ? 'bg-status-crit' : 'bg-topi-500'}`} style={{ width: `${used}%` }} /></span>
                      {used}% del cupo
                    </span>
                  )}
                  {group === 'investment' && nw?.market_gain != null && Number(nw.market_gain) !== 0 && (
                    <span className={`text-[11px] font-semibold ${Number(nw.market_gain) < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`}>
                      {Number(nw.market_gain) > 0 ? '+' : ''}{formatMoney(nw.market_gain, nw.currency)} de ganancia
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const mapStateToProps = state => ({
  user_accounts: state.CashFlow.user_accounts,
  net_worth: state.Fx.net_worth,
  account_activated: state.Reports.account_activated,
});

export default connect(mapStateToProps, { get_net_worth, set_dash_account_activated })(AccountGroupCard);
