import { useState, useEffect } from 'react';
//redux
import { connect } from 'react-redux';
import { set_another_month, set_another_year } from '../../redux/actions/reports';
import { get_expenses_report } from '../../redux/actions/reports';
import { formatCurrency, getPerc2, capitalizeWords, getPerc0, formatDate } from '../helpers';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';
import { ThreeDots } from 'react-loader-spinner';


const FlowDash = ({
  current_Month,
  current_Year,
  set_another_month,
  set_another_year,
}) => {


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
    <div className='h-[30px] '>

      {/* CAMBIAR FECHAS */}
      <div className='flex flex-row justify-between items-center text-sm font-medium '>
        <div className='px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl divide-x divide-gray-200 dark:divide-gray-700 flex flex-row gap-1 text-gray-700 dark:text-gray-300 transition-colors duration-300'>
          <div className='flex flex-row items-center gap-1'>
            <button onClick={() => handleMonthChange(-1)} className='hover:text-[#5266EB] transition-colors'>
              <ChevronLeftIcon className='w-4 h-4' />
            </button>
            <span>{
              monthNumberText[current_Month]
            }</span>
            <button onClick={() => handleMonthChange(1)} className='hover:text-[#5266EB]'>
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

    </div>
  );
};

const mapStateToProps = (state) => ({
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, {
  set_another_month, set_another_year
})(FlowDash);
