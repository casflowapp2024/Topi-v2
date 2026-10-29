import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { fetch_credit_cards } from '../../../redux/actions/creditCards';
import Card from '../../ui/Card';
import { formatMoney, getBaseCurrency } from '../../helpers';
import { ACCOUNT_GROUPS, accountsOfGroup } from './accountGroups';

const Stat = ({ label, value, tone, hint }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-xs font-medium text-ink-2 dark:text-gray-400">{label}</span>
    <span className={`text-lg font-bold tabular-nums truncate ${tone === 'out' ? 'text-money-out dark:text-money-out-dark' : tone === 'in' ? 'text-money-in dark:text-money-in-dark' : 'text-gray-900 dark:text-gray-100'}`}>{value}</span>
    {hint && <span className="text-xs text-ink-2 dark:text-gray-400">{hint}</span>}
  </div>
);

/**
 * Resumen del grupo elegido en Cuentas (todo en moneda base, con la tasa de hoy):
 * efectivo = total y cuenta principal; tarjetas = deuda, saldo a favor, cupo disponible y
 * próximo pago; inversiones = valor y ganancia; cerradas = cuántas y qué significa.
 */
const AccountGroupSummary = ({ group, user_accounts, net_worth }) => {
  const base = net_worth?.base_currency || getBaseCurrency();
  const meta = ACCOUNT_GROUPS.find(g => g.id === group) || ACCOUNT_GROUPS[0];
  const [cards, setCards] = useState(null);
  useEffect(() => {
    if (group === 'credit') fetch_credit_cards().then(list => setCards(list || []));
  }, [group, user_accounts]);

  const rows = useMemo(() => {
    const ids = new Set(accountsOfGroup(user_accounts?.items, group).map(a => a.id));
    return (net_worth?.accounts || []).filter(a => ids.has(a.account_id));
  }, [user_accounts, net_worth, group]);
  const sumBase = (pred = () => true) => rows.filter(pred).reduce((s, a) => s + Number(a.base_value || 0), 0);

  let stats = [];
  if (group === 'deposit') {
    const top = [...rows].sort((a, b) => Number(b.base_value || 0) - Number(a.base_value || 0))[0];
    stats = [
      { label: 'Total en efectivo', value: formatMoney(sumBase(), base), tone: sumBase() < 0 ? 'out' : undefined },
      top && { label: 'Mayor saldo', value: formatMoney(top.base_value, base), hint: top.name },
    ];
  } else if (group === 'credit') {
    const debt = Math.abs(sumBase(a => Number(a.balance) < 0));
    const favor = sumBase(a => Number(a.balance) > 0);
    const open = (cards || []).filter(c => rows.some(r => r.account_id === c.account_id));
    const available = open.filter(c => c.available != null && c.currency === base).reduce((s, c) => s + Number(c.available), 0);
    const next = open.filter(c => Number(c.pending_statement) > 0 && c.due_date)
      .sort((a, b) => moment(a.due_date) - moment(b.due_date))[0];
    stats = [
      { label: 'Deuda total', value: formatMoney(debt, base), tone: debt > 0 ? 'out' : undefined },
      favor > 0 ? { label: 'Saldo a favor', value: formatMoney(favor, base), tone: 'in', hint: 'Pagaste de más en alguna tarjeta' }
        : available > 0 ? { label: 'Cupo disponible', value: formatMoney(available, base) } : null,
      next && { label: 'Próximo pago', value: formatMoney(next.pending_statement, next.currency), hint: `${next.name} · antes del ${moment(next.due_date).format('DD MMM')}` },
    ];
  } else if (group === 'investment') {
    const sameCurrency = rows.every(a => a.currency === base);
    const gain = rows.reduce((s, a) => s + Number(a.market_gain || 0), 0);
    stats = [
      { label: 'Valor de tus inversiones', value: formatMoney(sumBase(), base) },
      sameCurrency && rows.some(a => a.market_gain != null) && { label: 'Ganancia', value: `${gain > 0 ? '+' : ''}${formatMoney(gain, base)}`, tone: gain < 0 ? 'out' : 'in', hint: 'Valor menos lo aportado' },
    ];
  } else {
    stats = [{ label: 'Cuentas cerradas', value: String(rows.length || accountsOfGroup(user_accounts?.items, 'closed').length) }];
  }

  return (
    <Card padding="md" className="rounded-xl shadow-md border-0">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${meta.tint}`}>
          <meta.Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <h2 className="text-md font-bold text-gray-800 dark:text-gray-100">{meta.title}</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.filter(Boolean).map(s => <Stat key={s.label} {...s} />)}
      </div>
    </Card>
  );
};

const mapStateToProps = state => ({
  user_accounts: state.CashFlow.user_accounts,
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps)(AccountGroupSummary);
