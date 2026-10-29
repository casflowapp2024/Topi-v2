import { connect } from 'react-redux';
import { set_active_report_tab } from '../../../redux/actions/ui';
import { set_dash_category_activated } from '../../../redux/actions/reports';
import BudgetProgress, { getMonthPace } from '../../ui/BudgetProgress';
import PeriodSelector from '../../navigation/PeriodSelector';
import Skeleton from '../../ui/Skeleton';
import { formatMoney } from '../../helpers';

const TABS = [
  { id: 'Expenses', label: 'Gastos' },
  { id: 'Income', label: 'Ingresos' },
];

/**
 * Cabecera de Presupuestos: el interruptor Gastos | Ingresos manda en toda la vista (lista,
 * gráfica y movimientos), y debajo va el total del mes contra lo planeado, con el ritmo.
 */
const BudgetOverview = ({
  active_report_tab, expenses_report_full, income_report_full, current_Month, current_Year,
  set_active_report_tab, set_dash_category_activated,
}) => {
  const isIncome = active_report_tab !== 'Expenses';
  const full = isIncome ? income_report_full : expenses_report_full;
  const value = Math.abs(Number(full?.value || 0));
  const budget = Math.abs(Number(full?.budget || 0));
  const usage = budget > 0 ? (value / budget) * 100 : 0;
  const pace = getMonthPace(current_Year, current_Month);
  const daysLeft = pace !== null ? new Date(current_Year, current_Month, 0).getDate() - new Date().getDate() : null;
  const incomeBudget = Math.abs(Number(income_report_full?.budget || 0));
  const expenseBudget = Math.abs(Number(expenses_report_full?.budget || 0));

  const changeTab = (id) => {
    if (id === active_report_tab) return;
    set_active_report_tab(id);
    set_dash_category_activated(null); // la categoría elegida era del otro lado
  };

  let detail = null;
  if (budget > 0 && !isIncome) {
    detail = value > budget
      ? <span className="text-status-crit-text dark:text-red-400 font-semibold">Te pasaste por {formatMoney(value - budget)}</span>
      : <span>Quedan <b className="text-gray-900 dark:text-gray-100">{formatMoney(budget - value)}</b>{daysLeft !== null ? ` para ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : ''}</span>;
  } else if (budget > 0) {
    detail = value >= budget
      ? <span className="text-money-in dark:text-money-in-dark font-semibold">Meta cumplida</span>
      : <span>Faltan <b className="text-gray-900 dark:text-gray-100">{formatMoney(budget - value)}</b> por recibir</span>;
  }

  return (
    <section className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md transition-colors duration-300" aria-label="Resumen de presupuestos">
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Ver presupuestos de" className="flex-1 lg:flex-none grid grid-cols-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-700/60">
          {TABS.map(t => {
            const on = t.id === active_report_tab || (t.id === 'Income' && isIncome);
            return (
              <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => changeTab(t.id)}
                className={`h-9 px-4 rounded-lg text-sm font-semibold transition-colors ${on
                  ? `bg-white dark:bg-gray-800 shadow-sm ${t.id === 'Expenses' ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}>
                {t.label}
              </button>
            );
          })}
        </div>
        <PeriodSelector className="hidden lg:flex" />
      </div>

      <div className="mt-4">
        {!full ? (
          <div className="flex flex-col gap-2"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-2.5 w-full rounded-full" /></div>
        ) : (
          <>
            <p className="text-sm text-ink-2 dark:text-gray-400">{isIncome ? 'Recibido este mes' : 'Gastado este mes'}</p>
            <p className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(value)}</span>
              {budget > 0 && <span className="text-sm text-ink-2 dark:text-gray-400">de {formatMoney(budget)}</span>}
            </p>
            {budget > 0 && (
              <BudgetProgress usage={usage} isIncome={isIncome} pace={isIncome ? null : pace} showLabel={false} height="h-2.5" className="mt-2" />
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-ink-2 dark:text-gray-400">
              {detail || <span>Sin presupuesto definido</span>}
              {budget > 0 && <span className="tabular-nums">{Math.round(usage)}%</span>}
            </div>
          </>
        )}
      </div>

      {(incomeBudget > 0 || expenseBudget > 0) && (
        <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-ink-2 dark:text-gray-400">
          Planeado: ingresos <b className="text-gray-800 dark:text-gray-200">{formatMoney(incomeBudget)}</b>
          {' · '}gastos <b className="text-gray-800 dark:text-gray-200">{formatMoney(expenseBudget)}</b>
          {' · '}ahorro esperado <b className={incomeBudget - expenseBudget < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-800 dark:text-gray-200'}>{formatMoney(incomeBudget - expenseBudget)}</b>
        </p>
      )}
    </section>
  );
};

const mapStateToProps = state => ({
  active_report_tab: state.UI.active_report_tab,
  expenses_report_full: state.Reports.expenses_report_full,
  income_report_full: state.Reports.income_report_full,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, { set_active_report_tab, set_dash_category_activated })(BudgetOverview);
