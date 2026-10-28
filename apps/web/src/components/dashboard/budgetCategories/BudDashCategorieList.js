
import { Link } from 'react-router-dom';
//redux
import { connect } from 'react-redux'
import { useState, useEffect, useMemo } from 'react';
import { get_expenses_report } from '../../../redux/actions/reports';
import { formatCurrency, capitalizeWords, getPerc0, formatDate } from '../../helpers';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';
import { SkeletonRows } from '../../ui/Skeleton';
import { Emoji } from "emoji-picker-react";
import { set_another_month, set_another_year, set_dash_category_activated } from '../../../redux/actions/reports';
import { set_active_report_tab } from '../../../redux/actions/ui';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
//componentes
import { PencilSquareIcon, ChevronDownIcon, ArrowsPointingOutIcon } from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/20/solid';

import FullBudgetsModal from './FullBudgetsModal';
import BudgetProgress, { getMonthPace } from '../../ui/BudgetProgress';

const BudDashCategorieList = ({
  //actions
  set_another_month,
  set_another_year,
  get_expenses_report, expenses_report, income_report, set_dash_category_activated,
  active_report_tab, set_active_report_tab,
  //states
  current_Month,
  current_Year,
  category_activated,
  // Props passed from parent
  handleOpenEditCat,
  setOpenCreateBox,
  onCategoryClick

}) => {
  const monthPace = getMonthPace(current_Year, current_Month);



  const [loadingReport, setLoadingReport] = useState(true)
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);



  const handleMonthChange = (increment) => {
    let newMonth = current_Month + increment;
    if (newMonth < 1) {
      newMonth = 12;

      set_another_year(current_Year - 1);
    } else if (newMonth > 12) {
      newMonth = 1;
      set_another_year(current_Year + 1);
    }
    set_another_month(newMonth);
  };

  const handleYearChange = (increment) => {
    set_another_year(current_Year + increment);
  };

  const get_expenses_report_confirm = async (dateFormated) => {
    setLoadingReport(true)
    console.log("get_expenses_report_confirm", dateFormated);
    const getReportResponse = await get_expenses_report(dateFormated)
    if (getReportResponse === true) {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    let dateString = `${current_Year}-${current_Month.toString().padStart(2, '0')}-01`
    get_expenses_report_confirm(dateString);

  }, []);

  useEffect(() => {

    if (current_Year && current_Month) {
      let dateString = `${current_Year}-${current_Month.toString().padStart(2, '0')}-01`
      get_expenses_report_confirm(dateString);
    }
  }, [current_Month, current_Year]);

  const monthNumberText = {
    1: 'Ene',
    2: 'Feb',
    3: 'Mar',
    4: 'Abr',
    5: 'May',
    6: 'Jun',
    7: 'Jul',
    8: 'Ago',
    9: 'Sep',
    10: 'Oct',
    11: 'Nov',
    12: 'Dic'
  };

  const bgSelectedCat = "bg-emerald-200 dark:bg-emerald-900/40";

  //Ordenar por

  const baseClasses = "px-3 py-1 text-sm font-medium rounded-md transition-colors";
  const activeClasses = "text-xs bg-indigo-100 text-[#5266EB] dark:bg-indigo-900/50 dark:text-[#7f8df2]";
  const inactiveClasses = "text-xs text-gray-500 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-600";

  const [activeSortKey, setActiveSortKey] = useState('Spent');
  const [sortedCategories, setSortedCategories] = useState([]);


  useEffect(() => {
    if (activeSortKey && expenses_report) {
      let mergedCategories = expenses_report.map(reportItem => {
        return {
          category_id: reportItem.category_id,
          name: reportItem.name,
          emoji: reportItem.emoji,
          budget: reportItem.budget || 0,
          expenses: reportItem.value || 0,
          usage: reportItem.usage || 0,
        };
      });

      if (activeSortKey === 'Spent') {
        mergedCategories.sort((a, b) => {
          const aVal = Math.abs(a.expenses);
          const bVal = Math.abs(b.expenses);

          if (aVal !== 0 && bVal === 0) return -1;
          if (aVal === 0 && bVal !== 0) return 1;

          if (aVal !== 0 && bVal !== 0) {
            return bVal - aVal;
          } else {
            return Math.abs(b.budget || 0) - Math.abs(a.budget || 0);
          }
        });
      } else if (activeSortKey === 'Percentage') {
        mergedCategories.sort((a, b) => {
          if (a.usage !== 0 && b.usage === 0) return -1;
          if (a.usage === 0 && b.usage !== 0) return 1;

          if (a.usage !== 0 && b.usage !== 0) {
            return b.usage - a.usage;
          } else {
            return Math.abs(b.budget || 0) - Math.abs(a.budget || 0);
          }
        });
      }

      setSortedCategories(mergedCategories);
    }
  }, [activeSortKey, expenses_report]);

  // Income Categories Logic
  const sortedIncomeCategories = useMemo(() => {
    if (!income_report) return [];
    return income_report
      .map(reportItem => ({
        category_id: reportItem.category_id,
        name: reportItem.name,
        emoji: reportItem.emoji,
        budget: reportItem.budget || 0,
        value: reportItem.value || 0,
        usage: reportItem.usage || 0,
      }))
      .sort((a, b) => (b.budget || 0) - (a.budget || 0));
  }, [income_report]);

  // Determine what to show based on activeTab
  let displayCategories = [];
  if (active_report_tab === 'Expenses') {
    displayCategories = sortedCategories;
  } else {
    displayCategories = sortedIncomeCategories;
  }
  const hasCategories = Array.isArray(displayCategories) && displayCategories.length > 0;



  return (
    <div className='h-auto bg-white rounded-2xl shadow-md dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300'>
      <div className="flex flex-col pt-4 w-full">
        <div className='pb-3 flex flex-row justify-between items-center text-sm font-medium '>
          <div className='w-full flex flex-row justify-between items-center px-4'>
            {/* <h2 className='pl-2'>Presupuestos</h2> */}

            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mr-2 transition-colors duration-300">
              <button
                onClick={() => set_active_report_tab('Expenses')}
                className={`${baseClasses} ${active_report_tab === 'Expenses' ? activeClasses : inactiveClasses}`}
              >
                Gastos
              </button>
              <button
                onClick={() => set_active_report_tab('Income')}
                className={`${baseClasses} ${active_report_tab === 'Income' ? activeClasses : inactiveClasses}`}
              >
                Ingresos
              </button>
            </div>

            <button
              onClick={() => setOpenCreateBox(true)}
              className="w-1/2 flex items-center justify-between px-1.5 p-1 bg-[#5266EB] hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group"
            >
              <span className="text-[12px] font-semibold">Agregar Presupuesto</span>
              <div className="p-1 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                <PlusIcon className="w-4 h-4 text-white" />
              </div>
            </button>

            {/* <button
              onClick={() => setOpenCreateBox(true)}
              className="p-1 rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors"
              title="Crear Categoría"
            >
              <PlusIcon className="w-5 h-5" />
            </button> */}


          </div>

        </div>



        {/* <div className='flex md:hidden px-1 py-1  border border-gray-200 rounded-md divide-x divide-gray-200 flex-row'>
            <div className='flex flex-row items-center'>
              <button onClick={() => handleMonthChange(-1)} className='hover:text-[#5266EB]'>
                <ChevronLeftIcon className='w-4 h-4'/>
              </button>
              <span>{monthNumberText[current_Month]}</span>
              <button onClick={() => handleMonthChange(1)} className='hover:text-[#5266EB]'>
                <ChevronRightIcon className='w-4 h-4'/>
              </button>
            </div>
            <div className='flex flex-row items-center'>
              <button onClick={() => handleYearChange(-1)} className='hover:text-[#5266EB]'>
                <ChevronLeftIcon className='w-4 h-4'/>
              </button>
              <span>{current_Year}</span>
              <button onClick={() => handleYearChange(1)} className='hover:text-[#5266EB]'>
                <ChevronRightIcon className='w-4 h-4'/>
              </button>
            </div>
          </div> */}

      </div>
      <div aria-busy={loadingReport} className={`transition-opacity duration-200 ${loadingReport && hasCategories ? 'opacity-50' : ''}`}>

        {/* Solo se muestra el spinner la primera vez; al cambiar de mes se conserva la lista (sin saltos) */}
        {loadingReport && !hasCategories ?
          <SkeletonRows rows={5} withBar className="px-2" /> :
          <>

            {displayCategories && displayCategories.length > 0 ? (
              <ul role="list" className="max-h-[285px] md:max-h-[366px] md:min-h-[366px] overflow-y-scroll hide-scrollbar">
                {displayCategories.map((category) => (
                  <li
                    onClick={() => {
                      set_dash_category_activated(category);
                      if (onCategoryClick) onCategoryClick();
                    }}
                    key={category.category_id} className={`${category.category_id === (category_activated && category_activated.category_id) ? bgSelectedCat : ''} py-[16px] px-2 cursor-pointer hover:bg-emerald-100 dark:hover:bg-gray-700 transition-colors`}>
                    <div className='flex flex-row justify-between items-center mb-1'>
                      <div className="flex flex-row justify-start items-center">
                        {category.emoji && category.emoji !== "" && (
                          <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                        )}
                        <div className="flex flex-row items-center">
                          <h3 className="pl-2 text font-semibold text-gray-700 dark:text-gray-200 mb-1">{capitalizeWords(category.name)}</h3>

                        </div>
                      </div>

                      <div className="flex items-center gap-2">

                        <div className='font-medium flex flex-col items-end justify-start min-w-[60px] text-right'>
                          {active_report_tab === 'Expenses' ? (

                            <>
                              <div className='flex flex-row items-center justify-end'>

                                <FormatMoneyShowDecs
                                  numb={category.expenses === 0 ? 0.000001 : Math.abs(category.expenses)}
                                  showDecimals={true}
                                  intClass="text-sm xl:text-sm"
                                  decClass="text-[10px] xl:text-xs"
                                />
                                <span className='pl-1 h-full h-[20px] text-gray-400 flex flex-row items-end'>
                                  <span className='pb-0.5 text-xs whitespace-nowrap'> | {category.usage}%</span>
                                </span>
                              </div>


                              <div>

                                <span className='pl-1 text-xs w-full text-right text-ink-2 dark:text-gray-400'>de {formatCurrency(Math.abs(category.budget))} </span>
                                <span className='pl-1 text-[8px] xl:text-[10px] w-full text-right text-green-400'></span>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className='flex flex-row items-center justify-end'>

                                <FormatMoneyShowDecs
                                  numb={category.value === 0 ? 0.000001 : Math.abs(category.value)}
                                  showDecimals={true}
                                  intClass="text-sm xl:text-sm"
                                  decClass="text-[10px] xl:text-xs"
                                />
                                <span className='pl-1 h-full h-[20px] text-gray-400 flex flex-row items-end'>
                                  <span className='pb-0.5 text-xs whitespace-nowrap'> | {category.usage}% </span>
                                </span>
                              </div>


                              <div>

                                <span className='pl-1 text-xs w-full text-right text-ink-2 dark:text-gray-400'>de {formatCurrency(category.budget)} </span>
                                <span className='pl-1 text-[8px] xl:text-[10px] w-full text-right text-green-400'></span>
                              </div>
                            </>
                          )}

                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditCat(category.category_id);
                          }}
                          className={`p-1 rounded-md transition-colors ${category.category_id === (category_activated && category_activated.category_id) ? 'hover:bg-emerald-300 text-gray-700' : 'hover:bg-gray-200 text-gray-500'}`}>
                          <ChevronDownIcon className="size-4" />
                        </button>
                      </div>

                    </div>

                    <BudgetProgress
                      usage={category.usage}
                      isIncome={active_report_tab !== 'Expenses'}
                      pace={monthPace}
                      height="h-1.5"
                      className="mt-1"
                    />

                  </li>
                ))}
              </ul>
            ) : (
              <p key={0} className="mt-5 text-gray-600 dark:text-gray-400 text-center">Aún no hay transacciones en este periodo.</p>
            )}
          </>
        }
      </div>
      {active_report_tab !== null && (
        <div className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl border-t border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tracking-wider">Ordenar por</span>
            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5 transition-colors duration-300">
              <button
                onClick={() => setActiveSortKey('Spent')}
                className={`text-xs px-3 py-1 rounded-md transition-all ${activeSortKey === 'Spent' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-white shadow-sm font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Monto
              </button>
              <button
                onClick={() => setActiveSortKey('Percentage')}
                className={`text-xs px-3 py-1 rounded-md transition-all ${activeSortKey === 'Percentage' ? 'bg-white dark:bg-gray-600 text-indigo-700 dark:text-white shadow-sm font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                % Uso
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => setIsFullModalOpen(true)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              title="Panorama completo"
            >
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Full Budgets Modal */}
      <FullBudgetsModal
        isOpen={isFullModalOpen}
        onClose={() => setIsFullModalOpen(false)}
        categories={expenses_report || []}
      />
    </div>
  );
};


const mapStateToProps = state => ({
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
  expenses_report: state.Reports.expenses_report,
  income_report: state.Reports.income_report,
  category_activated: state.Reports.category_activated,
  active_report_tab: state.UI.active_report_tab,
})

export default connect(mapStateToProps, {

  set_another_month,
  set_another_year,
  get_expenses_report,
  set_dash_category_activated,
  set_active_report_tab


})(BudDashCategorieList)
