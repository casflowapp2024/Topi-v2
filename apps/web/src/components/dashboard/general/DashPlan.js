import { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { get_expenses_report } from '../../../redux/actions/reports';
import { formatCurrency, getPerc2, capitalizeWords, getPerc0, formatDate } from '../../helpers';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';
import { ThreeDots } from 'react-loader-spinner';
import { Emoji } from "emoji-picker-react";
import { set_another_month, set_another_year } from '../../../redux/actions/reports';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';

const DashPlan = ({
  current_Month,
  current_Year,
  set_another_month,
  set_another_year,
  get_expenses_report, expenses_report, user_categories
}) => {

  const [loadingReport, setLoadingReport] = useState(true)


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


  return (
    <div className='h-auto md:h-[410px] bg-white border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700 transition-colors duration-300'>
      <div className="flex flex-col py-4 px-3 w-full">
        <div className='pb-3 flex flex-row justify-between items-center text-sm font-medium border-b border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-300'>
          <h2>Presupuestos</h2>

          <div className='flex md:hidden px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl divide-x divide-gray-200 dark:divide-gray-700 flex-row text-gray-700 dark:text-gray-300 transition-colors duration-300'>
            <div className='flex flex-row items-center gap-1'>
              <button onClick={() => handleMonthChange(-1)} className='hover:text-[#5266EB] transition-colors'>
                <ChevronLeftIcon className='w-4 h-4' />
              </button>
              <span>{monthNumberText[current_Month]}</span>
              <button onClick={() => handleMonthChange(1)} className='hover:text-[#5266EB] transition-colors'>
                <ChevronRightIcon className='w-4 h-4' />
              </button>
            </div>
            <div className='pl-2 ml-1 flex flex-row items-center gap-1'>
              <button onClick={() => handleYearChange(-1)} className='hover:text-[#5266EB] transition-colors'>
                <ChevronLeftIcon className='w-4 h-4' />
              </button>
              <span>{current_Year}</span>
              <button onClick={() => handleYearChange(1)} className='hover:text-[#5266EB] transition-colors'>
                <ChevronRightIcon className='w-4 h-4' />
              </button>
            </div>
          </div>
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
                          <span className='pl-1 text-[8px] xl:text-[10px] w-full text-left text-gray-400 dark:text-gray-500'>/{formatCurrency(category.budget)}</span>
                        </div>
                        <span className="text-[11px] xl:text-[14px] font-medium ">
                          {getPerc0(category.usage)}
                        </span>
                      </div>
                      <div className="flex w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden transition-colors duration-300">
                        {parseInt(category.usage) >= 100 ?
                          <div className="bg-[#3445b4] dark:bg-[#5266EB] h-full transition-colors duration-300" style={{ width: '100%' }}></div>
                          :
                          <>
                            {parseInt(category.usage) >= 80 ?
                              <div className="bg-[#5266EB] h-full" style={{ width: getPerc2(category.usage) }}></div> :
                              <div
                                className="bg-[#808bd3] h-full"
                                style={{ width: getPerc2(category.usage) }}
                              ></div>
                            }
                          </>
                        }
                      </div>
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
  set_another_month,
  set_another_year
})(DashPlan);
