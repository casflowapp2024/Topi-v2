import { useState } from 'react';
import { connect } from 'react-redux';
import { XMarkIcon } from '@heroicons/react/20/solid';
import { Segmented } from '../../charts/ChartTabs';
import BudgetBreakdownChart from '../../charts/BudgetBreakdownChart';
import ProjectionChart from '../../charts/ProjectionChart';
import { SkeletonChart } from '../../ui/Skeleton';
import { capitalizeWords } from '../../helpers';

// Gráfica de Presupuestos: una sola gráfica con el total del mes de fondo; al tocar una categoría
// en la lista, su parte se llena dentro de cada barra. "Proyección" muestra cómo cerraría el mes.
// activeChartTab: 2 = categoría resaltada (lo pone la lista), 1 = solo el total.
function BudDashDailySpent({ history_dash, category_activated, active_report_tab, activeChartTab, setActiveChartTab }) {
  const [view, setView] = useState('monthly');
  const isIncome = active_report_tab !== 'Expenses';
  const highlight = activeChartTab === 2 && !!category_activated;
  const showProjection = view === 'projection' && !isIncome;

  return (
    <div className="h-[300px] flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow overflow-hidden transition-colors duration-300">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {showProjection ? 'Proyección del mes' : isIncome ? 'Ingresos por mes' : 'Gasto por mes'}
        </h2>
        {!showProjection && (highlight ? (
          <button type="button" onClick={() => setActiveChartTab && setActiveChartTab(1)}
            className="inline-flex items-center gap-1 max-w-[60%] h-7 pl-2.5 pr-1.5 rounded-full text-xs font-semibold bg-topi-50 text-topi-600 dark:bg-indigo-500/15 dark:text-indigo-300 hover:bg-topi-500/15 transition-colors"
            aria-label={`Quitar ${category_activated.name} y ver solo el total`}>
            <span className="truncate">{capitalizeWords(category_activated.name)}</span>
            <XMarkIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        ) : (
          <span className="text-xs text-ink-2 dark:text-gray-400">Toca una categoría para verla en el total</span>
        ))}
      </div>
      <div className="flex-1 min-h-0 w-full">
        {!history_dash ? <SkeletonChart /> : showProjection ? <ProjectionChart /> : <BudgetBreakdownChart highlight={highlight} />}
      </div>
      {!isIncome && (
        <div className="flex justify-center py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Segmented label="Vista de la gráfica" value={view} onChange={setView}
            options={[{ id: 'monthly', label: 'Por mes' }, { id: 'projection', label: 'Proyección' }]} />
        </div>
      )}
    </div>
  );
}

const mapStateToProps = state => ({
  history_dash: state.Reports.history_dash,
  category_activated: state.Reports.category_activated,
  active_report_tab: state.UI.active_report_tab,
});

export default connect(mapStateToProps)(BudDashDailySpent);
