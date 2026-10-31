import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import Card from '../../ui/Card';
import ChartLegend from '../../ui/ChartLegend';
import Money from '../../ui/Money';
import Skeleton from '../../ui/Skeleton';
import { useChartColors } from '../../charts/chartTheme';
import { formatMoneyCompact, getBaseCurrency } from '../../helpers';

// Tramos del patrimonio: los totales por clase de la API suman exactamente net_worth.total. Las
// tarjetas valen su deuda estimada por cortes, la misma de Cuentas.
export const netWorthSegments = (netWorth) => [
  { id: 'cash', label: 'Efectivo', value: Number(netWorth?.cash_total || 0) },
  { id: 'investment', label: 'Inversiones', value: Number(netWorth?.investments_total || 0) },
  { id: 'credit', label: Number(netWorth?.credit_total || 0) > 0 ? 'A favor en tarjetas' : 'Deudas de tarjeta', value: Number(netWorth?.credit_total || 0) },
].filter(s => s.value !== 0);

/**
 * Tercera tarjeta del inicio: ¿cuánto tengo en total? Siempre es de hoy, sin importar el mes elegido.
 * history: reservado para la evolución mensual (Fase 3.B); hoy la API no la da y no se inventa.
 */
const HomeNetWorthCard = ({ net_worth, set_dash_account_activated, history = null }) => {
  const navigate = useNavigate();
  const c = useChartColors();
  const color = { cash: c.balance, investment: c.inversion, credit: c.crit };
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
      className="group w-full h-full flex flex-col gap-3 text-left hover:border-topi-500/40 active:scale-[0.99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
      <span className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Patrimonio
        <ChevronRightIcon className="w-4 h-4 text-gray-300 group-hover:text-topi-500 transition-colors" aria-hidden="true" />
      </span>
      {!net_worth ? (
        <span className="flex flex-col gap-2 w-full"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-2.5 w-full rounded-full" /></span>
      ) : (
        <>
          <span className="flex flex-col">
            <span className="text-sm text-ink-2 dark:text-gray-400">Lo que tienes menos lo que debes, hoy</span>
            <span className="flex items-baseline gap-1">
              <Money amount={net_worth.total} currency={base} baseCurrency={base} align="left" className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100" />
              {net_worth.missing_rates && <span className="text-sm text-ink-2 dark:text-gray-400" title="Alguna cuenta aún no tiene tasa de cambio">*</span>}
            </span>
          </span>
          <span className="mt-auto flex flex-col gap-2 w-full">
            {scale > 0 && (
              <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
                {segments.map(s => (
                  <span key={s.id} className={s.value < 0 ? 'topi-stripes' : ''}
                    style={{ width: `${(Math.abs(s.value) / scale) * 100}%`, backgroundColor: s.value < 0 ? c.crit : color[s.id] }} />
                ))}
              </span>
            )}
            <ChartLegend className="!px-0 !justify-start"
              items={segments.map(s => ({ type: 'bar', color: s.value < 0 ? c.crit : color[s.id], label: s.label, value: formatMoneyCompact(s.value, base) }))} />
            {segments.some(s => s.id === 'credit' && s.value < 0) && (
              <span className="text-xs text-ink-2 dark:text-gray-400">La deuda es aproximada: tu banco tiene la cifra exacta.</span>
            )}
          </span>
        </>
      )}
    </Card>
  );
};

const mapStateToProps = (state) => ({
  net_worth: state.Fx.net_worth,
});

export default connect(mapStateToProps, { set_dash_account_activated })(HomeNetWorthCard);
