import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { set_dash_account_activated } from '../../../redux/actions/reports';
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

/**
 * Tercera tarjeta del inicio: ¿cuánto tengo en total? Siempre es de hoy, sin importar el mes elegido.
 * history: reservado para la evolución mensual (Fase 3.B); hoy la API no la da y no se inventa.
 */
const HomeNetWorthCard = ({ net_worth, set_dash_account_activated, history = null }) => {
  const navigate = useNavigate();
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
          </span>
          <ChevronRightIcon className="hidden lg:block w-4 h-4 shrink-0 text-gray-300 group-hover:text-topi-500 transition-colors" aria-hidden="true" />
        </>
      )}
    </Card>
  );
};

const mapStateToProps = (state) => ({
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { set_dash_account_activated })(HomeNetWorthCard);
