
import { Link } from 'react-router-dom';
//redux
import { connect } from 'react-redux'
//componentes
import { formatCurrency, formatDate, getPerc0 } from '../../helpers';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
import { monthNumberText } from '../../info_arrays';
import { useState, useEffect } from 'react';
const BudDashTotalSpent = ({
  current_Month,
  current_Year,
  active_report_tab,
  expenses_report_full,
  income_report_full,


}) => {

  const [spent, setSpent] = useState(null)
  const [spentPer, setSpentPer] = useState(0)
  const [left, setLeft] = useState(0)
  const [colorGradient, setColorGradient] = useState('#5266EB')


  useEffect(() => {
    const reportFull = active_report_tab === 'Expenses' ? expenses_report_full : income_report_full;
    if (reportFull) {
      setSpent(Math.abs(reportFull.value || 0));
      // budget can be negative in API for expenses, we want absolute for UI comparison?
      // User JSON showed: "budget": -11050000, "left": 11050000
      // So if budget is -11M and left is 11M, spent is 0.
      // Math.abs(budget) - left = spent.
      // Actually reportFull.value already has the spent amount.
    } else {
      setSpent(0);
    }
  }, [active_report_tab, expenses_report_full, income_report_full]);

  useEffect(() => {
    const reportFull = active_report_tab === 'Expenses' ? expenses_report_full : income_report_full;
    if (reportFull) {
      const budgetVal = Math.abs(reportFull.budget || 0);
      const spentVal = Math.abs(reportFull.value || 0);
      const leftVal = reportFull.left || 0; // Use 'left' from API as requested

      const percentage = budgetVal !== 0 ? Math.round((100 * spentVal) / budgetVal) : 0;
      setSpentPer(percentage);
      setLeft(leftVal);

      if (active_report_tab === 'Expenses' && percentage >= 100) {
        setColorGradient('#ef4444');
      } else {
        setColorGradient('#5266EB');
      }
    } else {
      setSpentPer(0);
      setLeft(0);
    }
  }, [spent, active_report_tab, expenses_report_full, income_report_full]);

  //const percentageValue = Math.round(spentPer); // Asegura un entero para mostrar

  // Función para obtener el porcentaje en formato CSS (ej. "40%")
  const getPercentageCss = (value) => `${value}%`;



  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md flex flex-col gap-1 transition-colors duration-300">
      <div className='flex flex-row justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-1 mb-1 transition-colors duration-300'>
        <span className='text-sm font-semibold text-gray-700 dark:text-gray-200'>Presupuesto Mensual</span>
      </div>
      <div className="flex flex-row justify-between">
        <div className="flex flex-col justify-around items-left">
          <div className='font-bold text-sm flex flex-row justify-between items-center gap-4 '>
            <p className=" text-gray-800 dark:text-gray-200">{active_report_tab === 'Expenses' ? 'Gastado' : 'Recibido'}</p>
            <p className="  text-gray-500 dark:text-gray-400">${Math.abs(spent).toLocaleString()}</p>
          </div>
          <div className='font-bold text-sm flex flex-row justify-between items-center gap-4 '>
            {active_report_tab === 'Expenses' ? (
              spentPer && spentPer > 100 ? <p className=" text-gray-800 dark:text-gray-200">Déficit</p> : <p className=" text-gray-800 dark:text-gray-200">Faltan</p>
            ) : (
              spentPer && spentPer > 100 ? <p className=" text-gray-800 dark:text-gray-200">Excedente</p> : <p className=" text-gray-800 dark:text-gray-200">Faltan</p>
            )}
            <p className=" text-gray-500 dark:text-gray-400">${left.toLocaleString()}</p>
          </div>
        </div>

        {/* GRAFICO */}
        <div className='flex w-full pl-12 justify-center items-center'>
          <div
            className="percentage-circle-container flex"
            style={{

              '--percentage': getPercentageCss(spentPer),
              '--progressColor': colorGradient

            }}
          >
            <span className="percentage-circle-value">
              {spentPer}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

const mapStateToProps = state => ({

  expenses_report_full: state.Reports.expenses_report_full,
  income_report_full: state.Reports.income_report_full,
  active_report_tab: state.UI.active_report_tab,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
})

export default connect(mapStateToProps, {


})(BudDashTotalSpent)
