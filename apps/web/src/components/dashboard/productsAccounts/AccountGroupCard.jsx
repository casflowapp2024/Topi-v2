import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { PlusIcon } from '@heroicons/react/20/solid';
import Chip from '../../ui/Chip';
import { fetch_credit_cards } from '../../../redux/actions/creditCards';
import { get_net_worth } from '../../../redux/actions/fx';
import { formatMoney, getBaseCurrency } from '../../helpers';
import { ACCOUNT_GROUPS, ALL_GROUP, accountsOfGroup } from './accountGroups';

// Selector de tipo + Agregar (en móvil la fila se desliza)
const TypeChips = ({ items, group, onChange, onCreate }) => {
  const groups = ACCOUNT_GROUPS.filter(g => g.id !== 'closed').map(g => ({ ...g, count: accountsOfGroup(items, g.id).length }))
    .filter(g => g.count > 0 || g.id === group);
  const closed = accountsOfGroup(items, 'closed').length;
  return (
    // Móvil: una fila debajo del total. PC: a la derecha del total, "Agregar cuenta" arriba y los tipos debajo
    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 lg:mt-0 lg:pt-0 lg:border-0 lg:flex-col-reverse lg:items-end lg:min-w-0 lg:max-w-[62%]">
      <div className="flex-1 min-w-0 lg:flex-none lg:max-w-full flex items-center gap-2 overflow-x-auto hide-scrollbar" role="tablist" aria-label="Tipo de cuenta">
        {[{ ...ALL_GROUP, count: items.filter(a => !a.closed_at).length }, ...groups].map(g => (
          <Chip key={g.id} role="tab" aria-selected={g.id === group} selected={g.id === group} icon={g.Icon} onClick={() => onChange(g.id)}>
            {g.label} <span className={g.id === group ? 'text-white/80' : 'text-ink-2 dark:text-gray-400'}>{g.count}</span>
          </Chip>
        ))}
        {closed > 0 && (
          <button type="button" role="tab" aria-selected={group === 'closed'} onClick={() => onChange('closed')}
            className={`shrink-0 h-8 px-2 text-sm font-medium rounded-full transition-colors ${group === 'closed' ? 'text-topi-600 dark:text-indigo-300 underline underline-offset-4' : 'text-ink-2 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
            Cerradas ({closed})
          </button>
        )}
      </div>
      <button type="button" onClick={onCreate} aria-label="Agregar cuenta"
        className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-topi-500 hover:bg-topi-600 text-white text-sm font-semibold shadow-sm transition-colors">
        <PlusIcon className="w-4 h-4" aria-hidden="true" /><span className="hidden sm:inline">Agregar cuenta</span>
      </button>
    </div>
  );
};

const Stat = ({ label, value, tone, hint }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">{label}</span>
    <span className={`text-base font-bold tabular-nums truncate ${tone === 'out' ? 'text-money-out dark:text-money-out-dark' : tone === 'in' ? 'text-money-in dark:text-money-in-dark' : tone === 'warn' ? 'text-status-warn-text dark:text-amber-300' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
    {hint && <span className="text-xs text-ink-2 dark:text-gray-400">{hint}</span>}
  </div>
);

const toneOf = (v) => (v < 0 ? 'out' : undefined);

/**
 * Cabecera de Cuentas: primero el total del grupo elegido (en moneda base, tasa de hoy) con sus
 * cifras clave, y debajo el selector de tipo y "Agregar cuenta". Las cuentas del grupo se recorren
 * en el detalle (AccountSwitcher), así esta tarjeta no crece con el número de cuentas.
 * group 'all' = patrimonio: efectivo + inversiones − deudas, con un acceso a cada grupo.
 */
const AccountGroupCard = ({ group, onGroupChange, onCreate, user_accounts, net_worth, get_net_worth }) => {
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
        <div className="lg:flex lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">Patrimonio · hoy</span>
            <p className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{net_worth ? formatMoney(net_worth.total, base) : '—'}</span>
              <span className="text-sm text-ink-2 dark:text-gray-400">lo que tienes menos lo que debes</span>
            </p>
          </div>
          <TypeChips items={items} group={group} onChange={onGroupChange} onCreate={onCreate} />
        </div>
        {/* barra: cuánto es efectivo, cuánto inversiones y cuánto se va en deudas */}
        {assets > 0 && (
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
            {tiles.filter(t => t.id !== 'credit').map(t => (
              <span key={t.id} className={t.id === 'investment' ? 'bg-[#0E9AA7]' : 'bg-topi-500'} style={{ width: `${(Math.max(0, t.total) / (assets + debt)) * 100}%` }} />
            ))}
            {debt > 0 && <span className="bg-data-gasto" style={{ width: `${(debt / (assets + debt)) * 100}%` }} />}
          </div>
        )}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
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
    const next = open.filter(c => Number(c.pending_statement) > 0 && c.due_date).sort((a, b) => moment(a.due_date) - moment(b.due_date))[0];
    headline = { label: 'Tarjetas de crédito · deuda estimada', value: formatMoney(debt, base), tone: debt > 0 ? 'out' : undefined };
    stats = [
      next && { label: 'Próximo pago', value: `≈ ${formatMoney(next.pending_statement, next.currency)}`, tone: 'warn', hint: `${next.name} · antes del ${moment(next.due_date).format('D MMM')}` },
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

  return (
    <section className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md" aria-label={meta.title}>
      <div className="lg:flex lg:items-start lg:justify-between lg:gap-6">
      <div className="flex flex-col gap-3 min-w-0">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">{headline.label}{group !== 'closed' ? ` · ${accs.length} ${accs.length === 1 ? 'cuenta' : 'cuentas'}` : ''}</span>
          <p className={`text-3xl font-extrabold tabular-nums ${headline.tone === 'out' ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}>{headline.value}</p>
        </div>
        {stats.some(Boolean) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {stats.filter(Boolean).map(s => <Stat key={s.label} {...s} />)}
          </div>
        )}
        {group === 'closed' && (
          <p className="text-xs text-ink-2 dark:text-gray-400">Conservan su historia y siguen en tus reportes, pero no aparecen en el inicio ni para movimientos nuevos.</p>
        )}
      </div>
      <TypeChips items={items} group={group} onChange={onGroupChange} onCreate={onCreate} />
      </div>
    </section>
  );
};

const mapStateToProps = state => ({
  user_accounts: state.CashFlow.user_accounts,
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { get_net_worth })(AccountGroupCard);
