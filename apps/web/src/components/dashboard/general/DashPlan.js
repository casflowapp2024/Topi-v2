import { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { get_expenses_report } from '../../../redux/actions/reports';
import { formatCurrency, capitalizeWords, getPerc0, formatDate } from '../../helpers';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';
import { ThreeDots } from 'react-loader-spinner';
import { Emoji } from "emoji-picker-react";
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
import BudgetProgress, { getMonthPace } from '../../ui/BudgetProgress';

const DashPlan = ({
  current_Month,
  current_Year,
  get_expenses_report, expenses_report, user_categories
}) => {
  const monthPace = getMonthPace(current_Year, current_Month);


  const [loadingReport, setLoadingReport] = useState(true)




  const get_expenses_report_confirm = async (dateFormated) => {
    setLoadingReport(true)
    const getReportResponse = await get_expenses_report(dateFormated)
    if (getReportResponse === true) {
      setLoadingReport(false)
    }
  }

  useEffect(() => {

    if (current_Year && current_Month) {
      let dateString = `${current_Year}-${current_Month.toString().padStart(2, '0')}-01`
      get_expenses_report_confirm(dateString);
    }
  }, [current_Month, current_Year]);



  return (
    <div className='h-auto md:h-[410px] bg-white border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300'>
      <div className="flex flex-col py-4 px-3 w-full">
        <div className='pb-3 flex flex-row justify-between items-center text-sm font-medium border-b border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300'>
          <h2>Presupuestos</h2>
        </div>
        <div className='max-h-[344px] md:h-[344px] overflow-y-auto hide-scrollbar'>

          {loadingReport ?
            <div className='mt-10 text-gray-500 flex justify-center items-center'>
              <ThreeDots
                height="40"
                width="40"
                color="#6b7280"
                ariaLabel="loading"
              />
            </div> :
            <>
              {expenses_report ? (
                <ul role="list" className="">
                  {expenses_report.map((category) => (
                    <li key={category.id} className="py-[5px] lg:px-1">
                      <div className="flex flex-row justify-start">
                        {category.emoji && category.emoji !== "" && (
                          <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                        )}
                        <h3 className="pl-2 text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{capitalizeWords(category.name)}</h3>
                      </div>
                      <div className="flex flex-row items-center justify-between py-1 text-gray-900 dark:text-gray-100">
                        <div className='font-medium flex flex-col xl:flex-row items-center justify-start'>
                          <FormatMoneyShowDecs
                            numb={category.value || category.expenses || 0}
                            showDecimals={true}
                            intClass="text-xs xl:text-sm"
                            decClass="text-[10px] xl:text-xs"
                          />
                          {/* <span className='text-[12px] xl:text-sm'>{formatCurrency(category.expenses)}</span> */}
                          <span className='pl-1 text-xs w-full text-left text-ink-2 dark:text-gray-400'>de {formatCurrency(category.budget)}</span>
                        </div>
                        <span className="text-[11px] xl:text-[14px] font-medium ">
                          {getPerc0(category.usage)}
                        </span>
                      </div>
                      <BudgetProgress usage={category.usage} pace={monthPace} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p key={0} className="mt-5 text-gray-600 dark:text-gray-400 text-center">No hay datos para este periodo.</p>
              )}

            </>
          }
        </div>
      </div>
    </div>
  );
};

const mapStateToProps = (state) => ({
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
  expenses_report: state.Reports.expenses_report,
  user_categories: state.CashFlow.user_categories
});

export default connect(mapStateToProps, {
  get_expenses_report,
})(DashPlan);
