import { useEffect, useMemo, useState } from 'react';
import moment from 'moment-timezone';
import { Link, useNavigate } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import { get_net_worth } from '../../../redux/actions/fx';
import { fetch_credit_cards } from '../../../redux/actions/creditCards';
//components
import { formatMoney, getBaseCurrency, accountClass, isOpenAccount } from '../../helpers';
import Money from '../../ui/Money';
import Card, { CardHeader } from '../../ui/Card';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import {
  BanknotesIcon, BuildingLibraryIcon, ArrowTrendingUpIcon, CreditCardIcon, ChevronRightIcon, PlusIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';

// Aviso de pago: tarjetas cuyo último corte aún no tiene un pago y con fecha límite en los próximos 7 días (o vencida)
const DUE_SOON_DAYS = 7;
const dueSoon = (cards) => (cards || []).filter(c => Number(c.pending_statement) > 0 && c.due_date
  && moment(c.due_date).diff(moment().startOf('day'), 'days') <= DUE_SOON_DAYS);

// Tipos de cuenta (ids del catálogo account_types)
const TYPE_STYLE = {
  1: { Icon: BanknotesIcon, tint: 'bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  2: { Icon: BuildingLibraryIcon, tint: 'bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300' },
  3: { Icon: ArrowTrendingUpIcon, tint: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  4: { Icon: CreditCardIcon, tint: 'bg-orange-50 text-money-out dark:bg-orange-500/15 dark:text-money-out-dark' },
};
const MAX_VISIBLE = 6;

// Patrimonio de hoy (GET /analysis/net-worth): saldo nativo de cada cuenta, su valor en la moneda
// base con la tasa de hoy, y el total separado en efectivo (cuentas) e inversiones.
const DashAccounts = ({ user_accounts, net_worth, get_net_worth, set_dash_account_activated }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { get_net_worth(); }, [get_net_worth, user_accounts]);
  const [cards, setCards] = useState([]);
  useEffect(() => { fetch_credit_cards().then(list => setCards(list || [])); }, [user_accounts]);
  const dueCards = dueSoon(cards);

  const baseCurrency = net_worth?.base_currency || getBaseCurrency();
  const { rows, savings } = useMemo(() => {
    const items = new Map((user_accounts?.items || []).map(acc => [acc.id, acc]));
    const rows = (net_worth?.accounts || []).map(nw => ({
      acc: items.get(nw.account_id) || { id: nw.account_id, name: nw.name, type: { id: nw.type_id } },
      nw,
      value: nw.base_value != null ? Number(nw.base_value) : null,
    })).filter(r => isOpenAccount(r.acc)); // las cerradas no se muestran en el inicio (siguen en Cuentas)
    // Primero las de mayor valor en moneda base
    rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    // % de tu ahorro: solo cuentas de efectivo (lo pagado de más en una tarjeta no es ahorro)
    const savings = rows.reduce((sum, r) => sum + (accountClass(r.acc) === 'deposit' && r.value > 0 ? r.value : 0), 0);
    return { rows, savings };
  }, [user_accounts, net_worth]);
  const investmentsTotal = Number(net_worth?.investments_total || 0);
  // Tarjetas con saldo positivo: cargos (intereses, cuota de manejo) pagados pero sin registrar
  const overpaid = rows.filter(r => accountClass(r.acc) === 'credit' && Number(r.nw.balance) > 0);

  const openAccount = (acc) => {
    set_dash_account_activated(acc);
    navigate('/dashboard/accounts');
  };

  const visible = showAll ? rows : rows.slice(0, MAX_VISIBLE);
  const hidden = rows.length - visible.length;

  return (
    <Card className="w-full">
      <CardHeader
        className="mb-0"
        title="Mis cuentas"
        subtitle={net_worth && rows.length > 0 && (
          <span className="flex flex-col">
            <span>Patrimonio hoy: <b className="text-gray-900 dark:text-gray-100 tabular-nums">{formatMoney(net_worth.total, baseCurrency)}</b>
              {net_worth.missing_rates && <span title="Alguna cuenta aún no tiene tasa de cambio"> *</span>}</span>
            {net_worth.cash_total != null && (
              <span>Efectivo en cuentas: <span className="tabular-nums">{formatMoney(net_worth.cash_total, baseCurrency)}</span></span>
            )}
            {investmentsTotal !== 0 && (
              <span>Inversiones: <span className="tabular-nums">{formatMoney(net_worth.investments_total, baseCurrency)}</span></span>
            )}
          </span>
        )}
        action={
          <Link to="accounts" className="text-xs font-medium text-topi-600 dark:text-indigo-300 hover:underline inline-flex items-center">
            Ver detalle <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
          </Link>
        }
      />

      {overpaid.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Tarjetas con cargos sin registrar">
          {overpaid.map(({ acc, nw }) => (
            <li key={acc.id}>
              <button type="button" onClick={() => openAccount(acc)}
                className="w-full flex gap-2 rounded-xl px-3 py-2 text-sm text-left bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors">
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {acc.name}: pagaste <b>{formatMoney(nw.balance, nw.currency)}</b> más de lo registrado. Suelen ser intereses o cuota de manejo.{' '}
                  <span className="font-semibold underline underline-offset-2">Ajustar</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {dueCards.length > 0 && (
        <ul className="mt-3 space-y-1" aria-label="Pagos de tarjeta próximos">
          {dueCards.map(c => {
            const overdue = moment(c.due_date).isBefore(moment().startOf('day'));
            return (
              <li key={c.account_id} className={`flex gap-2 rounded-xl px-3 py-2 text-sm ${overdue ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {c.name}: {overdue ? 'quedó pendiente' : 'este corte suma'} <b>≈ {formatMoney(c.pending_statement, c.currency)}</b>
                  {overdue ? ` (la fecha límite fue el ${moment(c.due_date).format('DD-MM')})` : ` antes del ${moment(c.due_date).format('DD-MM')}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={BanknotesIcon}
          title="Aún no tienes cuentas"
          description="Agrega una cuenta para ver aquí tus saldos."
          action={<Button size="sm" icon={PlusIcon} onClick={() => navigate('/dashboard/accounts')}>Agregar cuenta</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-3">
          {visible.map(({ acc, nw, value }) => {
            const style = TYPE_STYLE[parseInt(acc.type?.id)] || TYPE_STYLE[1];
            const { Icon } = style;
            const cls = accountClass(acc);
            const share = cls === 'deposit' && value > 0 && savings > 0 ? Math.round((value / savings) * 100) : null;
            const balance = Number(nw.balance);
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
                      {nw.bank || acc.bank?.name || acc.type?.name}{nw.last_four_digits ? ` · ••${nw.last_four_digits}` : ''}
                    </span>
                    {share !== null && (
                      <span className="mt-1.5 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-700" title={`${share}% de tu ahorro`}>
                        <span className="block h-full rounded-full bg-topi-500" style={{ width: `${share}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="flex flex-col items-end shrink-0">
                    {cls === 'credit' ? (
                      /* Tarjeta: deuda (saldo negativo) o pagado de más (cargos sin registrar), siempre con su palabra */
                      <span className="flex flex-col items-end">
                        <span className="text-[11px] font-medium text-ink-2 dark:text-gray-400">
                          {balance < 0 ? 'Deuda' : balance > 0 ? 'Pagado de más' : 'Sin deuda'}
                        </span>
                        <Money
                          amount={Math.abs(balance)}
                          currency={nw.currency}
                          base={nw.base_value != null ? Math.abs(Number(nw.base_value)) : null}
                          baseCurrency={baseCurrency}
                          className={`text-sm font-bold tabular-nums ${balance < 0 ? 'text-money-out dark:text-money-out-dark' : balance > 0 ? 'text-status-warn-text dark:text-amber-300' : 'text-gray-900 dark:text-gray-100'}`}
                        />
                      </span>
                    ) : (
                      <Money
                        amount={nw.balance}
                        currency={nw.currency}
                        base={nw.base_value}
                        baseCurrency={baseCurrency}
                        className={`text-sm font-bold tabular-nums ${balance < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}
                      />
                    )}
                    {nw.market_gain != null && Number(nw.market_gain) !== 0 && (
                      <span className={`text-xs tabular-nums ${Number(nw.market_gain) < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`}
                        title="Ganancia de la inversión: valor menos lo aportado">
                        {Number(nw.market_gain) > 0 ? '+' : ''}{formatMoney(nw.market_gain, nw.currency)}
                      </span>
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
    </Card>
  );
};

const mapStateToProps = state => ({
  user_accounts: state.CashFlow.user_accounts,
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { set_dash_account_activated, get_net_worth })(DashAccounts);
