import { useState } from 'react';
import { connect } from 'react-redux';
import ChartTabs, { Segmented } from '../../charts/ChartTabs';
import SpendVsBudgetChart from '../../charts/SpendVsBudgetChart';
import PaceChart from '../../charts/PaceChart';
import { SkeletonChart } from '../../ui/Skeleton';
import { capitalizeWords } from '../../helpers';

// Gráfica de Presupuestos: gasto total (por mes o ritmo del mes) o el de la categoría elegida.
// activeChartTab: 1 = total, 2 = categoría (lo cambia la lista al tocar una categoría).
function BudDashDailySpent({ history_dash, history_category, category_activated, activeChartTab, setActiveChartTab }) {
  const [view, setView] = useState('monthly');
  const tab = activeChartTab === 2 ? 'category' : 'total';
  const setTab = (id) => setActiveChartTab && setActiveChartTab(id === 'category' ? 2 : 1);
  const catName = category_activated?.name ? capitalizeWords(category_activated.name) : 'Categoría';
  const ready = tab === 'total' ? history_dash : history_category;

  return (
    <div className="h-[290px] flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow overflow-hidden transition-colors duration-300">
      <ChartTabs
        label="Gráfica de presupuestos"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'total', label: 'Gasto total' },
          { id: 'category', label: catName, hint: 'Toca una categoría de la lista para verla aquí' },
        ]}
      />
      <div className="flex-1 min-h-0 w-full" role="tabpanel">
        {!ready ? (
          <SkeletonChart />
        ) : tab === 'category' ? (
          <SpendVsBudgetChart source="category" />
        ) : view === 'pace' ? (
          <PaceChart />
        ) : (
          <SpendVsBudgetChart source="total" />
        )}
      </div>
      {tab === 'total' && (
        <div className="flex justify-center py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Segmented label="Vista del gasto total" value={view} onChange={setView}
            options={[{ id: 'monthly', label: 'Por mes' }, { id: 'pace', label: 'Ritmo del mes' }]} />
        </div>
      )}
    </div>
  );
}

const mapStateToProps = state => ({
  history_dash: state.Reports.history_dash,
  history_category: state.Reports.history_category,
  category_activated: state.Reports.category_activated,
});

export default connect(mapStateToProps)(BudDashDailySpent);
