import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import { get_net_worth } from '../../../redux/actions/fx';
//components
import { formatMoney, getBaseCurrency } from '../../helpers';
import Money from '../../ui/Money';
import Card, { CardHeader } from '../../ui/Card';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
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

// Patrimonio de hoy (GET /analysis/net-worth): saldo nativo de cada cuenta, su valor en la moneda
// base con la tasa de hoy y la ganancia o pérdida cambiaria no realizada.
const DashAccounts = ({ user_accounts, net_worth, get_net_worth, set_dash_account_activated }) => {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { get_net_worth(); }, [get_net_worth, user_accounts]);

  const baseCurrency = net_worth?.base_currency || getBaseCurrency();
  const { rows, savings } = useMemo(() => {
    const items = new Map((user_accounts?.items || []).map(acc => [acc.id, acc]));
    const rows = (net_worth?.accounts || []).map(nw => ({
      acc: items.get(nw.account_id) || { id: nw.account_id, name: nw.name, type: { id: nw.type_id } },
      nw,
      value: nw.base_value != null ? Number(nw.base_value) : null,
    })).filter(r => !(r.acc.closed_at && Number(r.nw.balance) === 0)); // cerradas y en cero: ya no pesan
    // Primero las de mayor valor en moneda base
    rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
    const savings = rows.reduce((sum, r) => sum + (r.value && r.value > 0 ? r.value : 0), 0);
    return { rows, savings };
  }, [user_accounts, net_worth]);
  // ganancia no realizada: de las inversiones (valoraciones) y cambiaria (tasas)
  const marketGain = Number(net_worth?.market_gain || 0);
  const fxGain = Number(net_worth?.fx_gain ?? net_worth?.unrealized_gain ?? 0);

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
            {marketGain !== 0 && (
              <span className={marketGain < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}>
                {marketGain < 0 ? 'Pérdida' : 'Ganancia'} de tus inversiones: {formatMoney(Math.abs(marketGain), baseCurrency)}
              </span>
            )}
            {fxGain !== 0 && (
              <span className={fxGain < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}>
                {fxGain < 0 ? 'Pérdida' : 'Ganancia'} cambiaria no realizada: {formatMoney(Math.abs(fxGain), baseCurrency)}
              </span>
            )}
          </span>
        )}
        action={
          <Link to="accounts" className="text-xs font-medium text-topi-600 dark:text-indigo-300 hover:underline inline-flex items-center">
            Ver detalle <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
          </Link>
        }
      />

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
            const share = value && value > 0 && savings > 0 ? Math.round((value / savings) * 100) : null;
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
                    <Money
                      amount={nw.balance}
                      currency={nw.currency}
                      base={nw.base_value}
                      baseCurrency={baseCurrency}
                      className={`text-sm font-bold tabular-nums ${balance < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-gray-100'}`}
                    />
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
