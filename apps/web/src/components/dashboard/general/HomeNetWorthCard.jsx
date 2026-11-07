import { useEffect } from 'react';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import 'moment/locale/es';
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, MinusIcon } from '@heroicons/react/20/solid';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import { get_net_worth_history } from '../../../redux/actions/fx';
import Card from '../../ui/Card';
import ChartLegend from '../../ui/ChartLegend';
import Money from '../../ui/Money';
import Skeleton from '../../ui/Skeleton';
import { useChartColors } from '../../charts/chartTheme';
import { formatMoneyCompact, getBaseCurrency, isCreditAccount } from '../../helpers';

// Tramos del patrimonio: los totales por clase de la API suman exactamente net_worth.total. Las
// tarjetas valen su deuda estimada por cortes, la misma de Cuentas; lo pagado de más en otra tarjeta
// va aparte para que no le reste a esa deuda.
export const netWorthSegments = (netWorth) => {
  const credit = Number(netWorth?.credit_total || 0);
  const debt = (netWorth?.accounts || [])
    .filter(a => isCreditAccount(a) && Number(a.base_value) < 0)
    .reduce((sum, a) => sum + Number(a.base_value), 0);
  return [
    { id: 'cash', label: 'Efectivo', value: Number(netWorth?.cash_total || 0) },
    { id: 'investment', label: 'Inversiones', value: Number(netWorth?.investments_total || 0) },
    { id: 'favor', label: 'A favor en tarjetas', value: credit - debt },
    { id: 'credit', label: 'Deudas de tarjeta', value: debt },
  ].filter(s => s.value !== 0);
};

// Cambio contra el cierre del mes anterior: el penúltimo punto de la historia (el último es hoy).
// null sin historia o sin ese mes; con tasas faltantes en cualquiera de los dos la resta no es confiable.
export const netWorthChange = (history, netWorth) => {
  const points = history?.points || [];
  if (!netWorth || points.length < 2) return null;
  const prev = points[points.length - 2];
  if (prev.missing_rates || netWorth.missing_rates) return null;
  return { delta: Number(netWorth.total) - Number(prev.total), since: prev.date };
};

// Lo aportado a las inversiones contra lo que valen hoy. null sin inversiones o sin costo conocido.
export const investmentsSummary = (history) => {
  const today = history?.points?.[history.points.length - 1];
  if (!today || today.investments_cost == null || Number(today.investments_total) === 0) return null;
  const cost = Number(today.investments_cost);
  return { cost, gain: Number(today.investments_total) - cost };
};

const shortDate = (date) => moment(date, 'YYYY-MM-DD').locale('es').format('D MMM').replace(/\./g, '');

/**
 * Tercera tarjeta del inicio: ¿cuánto tengo en total? Siempre es de hoy, sin importar el mes elegido.
 * Debajo del total, cuánto cambió desde el cierre del mes anterior (misma cuenta a esa fecha:
 * tarjetas por su deuda estimada entonces, inversiones por su valoración de entonces).
 */
const HomeNetWorthCard = ({ net_worth, net_worth_history, set_dash_account_activated, get_net_worth_history }) => {
  const navigate = useNavigate();
  // Se pide otra vez cuando cambia el patrimonio de hoy (una valoración, un cambio de moneda...)
  const total = net_worth?.total;
  useEffect(() => { if (total != null) get_net_worth_history(); }, [total, get_net_worth_history]);
  const change = netWorthChange(net_worth_history, net_worth);
  const investments = investmentsSummary(net_worth_history);
  const c = useChartColors();
  const color = { cash: c.balance, investment: c.inversion, favor: c.ok, credit: c.crit };
  const base = net_worth?.base_currency || getBaseCurrency();
  const segments = netWorthSegments(net_worth);
  const scale = segments.reduce((sum, s) => sum + Math.abs(s.value), 0);

  // Sin cuenta elegida, Cuentas abre el grupo "Todo"
  const openAccounts = () => {
    set_dash_account_activated(null);
    navigate('/dashboard/accounts');
  };

  return (
    <Card as="button" type="button" onClick={openAccounts} aria-label="Patrimonio: ver cuentas"
      className="group w-full flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 text-left hover:border-topi-500/40 active:scale-[0.99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
      {!net_worth ? (
        <span className="flex flex-col gap-2 w-full"><Skeleton className="h-7 w-1/2" /><Skeleton className="h-2.5 w-full rounded-full" /></span>
      ) : (
        <>
          <span className="flex flex-col shrink-0">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Patrimonio · hoy</span>
            <span className="flex items-baseline gap-1">
              <Money amount={net_worth.total} currency={base} baseCurrency={base} align="left" className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100" />
              {net_worth.missing_rates && <span className="text-sm text-ink-2 dark:text-gray-400" title="Alguna cuenta aún no tiene tasa de cambio">*</span>}
            </span>
            {change && <NetWorthChange {...change} base={base} />}
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-2 w-full">
            {scale > 0 && (
              <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                {segments.map(s => (
                  <span key={s.id} className={s.value < 0 ? 'topi-stripes' : ''}
                    style={{ width: `${(Math.abs(s.value) / scale) * 100}%`, backgroundColor: color[s.id] }} />
                ))}
              </span>
            )}
            <ChartLegend className="!px-0" align="start"
              items={segments.map(s => ({
                type: 'bar', color: color[s.id], value: formatMoneyCompact(s.value, base),
                label: s.id === 'credit' ? `${s.label} (aprox.)` : s.label,
              }))} />
            {investments && (
              <span className="text-xs text-ink-2 dark:text-gray-400">
                Inversiones: aportaste {formatMoneyCompact(investments.cost, base)} ·{' '}
                <span className={investments.gain < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}>
                  {investments.gain < 0 ? 'pérdida' : 'ganancia'} {formatMoneyCompact(Math.abs(investments.gain), base)}
                </span>
              </span>
            )}
          </span>
          <ChevronRightIcon className="hidden lg:block w-4 h-4 shrink-0 text-gray-300 group-hover:text-topi-500 transition-colors" aria-hidden="true" />
        </>
      )}
    </Card>
  );
};

// Flecha + palabra + monto: el color nunca va solo
const NetWorthChange = ({ delta, since, base }) => {
  const day = shortDate(since);
  if (delta === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-2 dark:text-gray-400">
        <MinusIcon className="w-3.5 h-3.5" aria-hidden="true" />Igual que el {day}
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className="flex items-center gap-1 text-xs">
      <Icon className={`w-3.5 h-3.5 ${up ? 'text-money-in dark:text-money-in-dark' : 'text-money-out dark:text-money-out-dark'}`} aria-hidden="true" />
      <span className={`font-semibold tabular-nums ${up ? 'text-money-in dark:text-money-in-dark' : 'text-money-out dark:text-money-out-dark'}`}>
        {up ? 'Subió' : 'Bajó'} {formatMoneyCompact(Math.abs(delta), base)}
      </span>
      <span className="text-ink-2 dark:text-gray-400">desde el {day}</span>
    </span>
  );
};

const mapStateToProps = (state) => ({
  net_worth: state.Fx.net_worth,
  net_worth_history: state.Fx.net_worth_history,
});

export default connect(mapStateToProps, { set_dash_account_activated, get_net_worth_history })(HomeNetWorthCard);
