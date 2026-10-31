import { connect } from 'react-redux';
import { ArrowDownRightIcon, ArrowUpRightIcon, ExclamationCircleIcon } from '@heroicons/react/20/solid';
import Card from '../../ui/Card';
import Skeleton from '../../ui/Skeleton';
import { monthlyMetricAt, useChartColors } from '../../charts/chartTheme';
import { formatMoney } from '../../helpers';

// Cambio frente al mes anterior: flecha, porcentaje y palabra, más el color según sea bueno o malo.
const Change = ({ percentage, upIsGood }) => {
  if (percentage === null || percentage === undefined || Number(percentage) === 0) return null;
  const up = Number(percentage) > 0;
  const Icon = up ? ArrowUpRightIcon : ArrowDownRightIcon;
  const good = up === upIsGood;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-money-in dark:text-money-in-dark' : 'text-money-out dark:text-money-out-dark'}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      {Math.abs(Math.round(Number(percentage)))}% {up ? 'más' : 'menos'}
    </span>
  );
};

const Figure = ({ label, color, value, percentage, upIsGood, loading }) => (
  <div className="flex flex-wrap items-baseline lg:items-start justify-between gap-x-2">
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-2 dark:text-gray-400">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
    <span className={`ml-auto flex flex-row-reverse items-baseline gap-2 lg:flex-col lg:items-end lg:gap-0 min-w-0 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
      <span className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
      <Change percentage={percentage} upIsGood={upIsGood} />
    </span>
  </div>
);

// Tramos de la barra en %: los ingresos son el 100 %; si se gasta más, el exceso va aparte.
export const flowBarSegments = (income, expense) => {
  const total = Math.max(income, expense);
  if (total <= 0) return { spent: 0, saved: 0, deficit: 0 };
  const spent = (Math.min(income, expense) / total) * 100;
  return expense > income
    ? { spent, saved: 0, deficit: 100 - spent }
    : { spent, saved: 100 - spent, deficit: 0 };
};

/**
 * Segunda tarjeta del inicio: ¿entra más de lo que sale? El ahorro neto es el del mes (la serie
 * mensual del análisis): savings_balance del reporte es el saldo acumulado de las cuentas.
 */
const HomeFlowCard = ({ income, expenses, history_dash, current_Month, current_Year, loading }) => {
  const c = useChartColors();
  const savings = monthlyMetricAt(history_dash?.monthly, 'savings', current_Year, current_Month);
  const inValue = Math.abs(Number(income?.value) || 0);
  const outValue = Math.abs(Number(expenses?.value) || 0);
  const bar = flowBarSegments(inValue, outValue);

  return (
    <Card className="h-full flex flex-col gap-2 lg:gap-3" aria-label="Flujo del mes">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Flujo del mes</h2>
        <span className="text-xs text-ink-2 dark:text-gray-400">vs. mes anterior</span>
      </div>
      {!income || !expenses ? (
        <div className="flex flex-col gap-3"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-full" /></div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 lg:flex-1 lg:justify-between lg:gap-3" aria-busy={loading}>
            <Figure label="Ingresos" color={c.ingreso} value={formatMoney(inValue)} percentage={income.vs_past_month} upIsGood loading={loading} />
            <Figure label="Gastos" color={c.gasto} value={formatMoney(outValue)} percentage={expenses.vs_past_month} upIsGood={false} loading={loading} />
            <Figure label="Ahorro" color={c.ahorro} value={formatMoney(savings?.value)} percentage={savings?.percentage} upIsGood loading={loading} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700" aria-hidden="true">
              <span style={{ width: `${bar.spent}%`, background: c.gasto }} />
              <span style={{ width: `${bar.saved}%`, background: c.ahorro }} />
              <span className="topi-stripes" style={{ width: `${bar.deficit}%`, backgroundColor: c.crit }} />
            </div>
            {bar.deficit > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-status-crit-text dark:text-red-400">
                <ExclamationCircleIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                Déficit de {formatMoney(outValue - inValue)}
              </span>
            ) : (
              <span className="text-xs text-ink-2 dark:text-gray-400">
                {inValue > 0 ? `Gastaste el ${Math.round(bar.spent)}% de lo que entró` : 'Sin ingresos este mes'}
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
};

const mapStateToProps = (state) => ({
  income: state.Reports.income,
  expenses: state.Reports.expenses,
  history_dash: state.Reports.history_dash,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps)(HomeFlowCard);
