import { useState } from 'react';
import { connect } from 'react-redux';
import ChartTabs from '../../charts/ChartTabs';
import BalanceChart from '../../charts/BalanceChart';
import FlowChart from '../../charts/FlowChart';
import SpendVsBudgetChart from '../../charts/SpendVsBudgetChart';
import NetWorthChart from '../../charts/NetWorthChart';
import { SkeletonChart } from '../../ui/Skeleton';

// Gráfica del inicio. Los datos (history_dash) los pide Dashboard.jsx al cambiar de mes.
// La proyección del mes vive en la tarjeta Ritmo del mes. Patrimonio no depende del mes elegido: va hasta hoy.
const TABS = [
  { id: 'balance', label: 'Balance', hint: 'Saldo en tus cuentas de efectivo' },
  { id: 'flow', label: 'Flujo', hint: 'Ingresos, gastos y ahorro neto por mes' },
  { id: 'spend', label: 'Gastos', hint: 'Gastos contra el presupuesto, con proyección del mes' },
  { id: 'networth', label: 'Patrimonio', hint: 'Tu patrimonio al cierre de cada mes, hasta hoy' },
];

function MultiChartDash({ history_dash }) {
  const [tab, setTab] = useState('balance');

  return (
    <div className="h-[330px] sm:h-[320px] lg:h-[300px] flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow overflow-hidden transition-colors duration-300">
      <ChartTabs tabs={TABS} value={tab} onChange={setTab} label="Gráficas del mes" />

      <div className="flex-1 min-h-0 w-full" role="tabpanel">
        {tab === 'networth' ? (
          <NetWorthChart />
        ) : !history_dash ? (
          <SkeletonChart />
        ) : tab === 'balance' ? (
          <BalanceChart />
        ) : tab === 'flow' ? (
          <FlowChart />
        ) : (
          <SpendVsBudgetChart source="total" />
        )}
      </div>

    </div>
  );
}

const mapStateToProps = state => ({
  history_dash: state.Reports.history_dash,
});

export default connect(mapStateToProps)(MultiChartDash);
