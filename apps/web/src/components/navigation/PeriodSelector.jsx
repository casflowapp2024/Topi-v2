import { connect } from 'react-redux';
import { Popover, PopoverButton, PopoverPanel, CloseButton } from '@headlessui/react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon } from '@heroicons/react/20/solid';
import { set_period } from '../../redux/actions/reports';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Selector de periodo global (mes/año) para todo el dashboard.
 * Flechas para mes anterior/siguiente (cruzan de año solas) y una hoja con los 12 meses.
 */
const PeriodSelector = ({ current_Month, current_Year, set_period, className = '' }) => {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const isCurrent = current_Year === thisYear && current_Month === thisMonth;

  const shift = (delta) => {
    const idx = current_Year * 12 + (current_Month - 1) + delta;
    set_period(Math.floor(idx / 12), (idx % 12) + 1);
  };

  const btn = 'w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:text-topi-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';

  return (
    <div className={`flex items-center gap-0.5 p-0.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm ${className}`}>
      <button type="button" className={btn} onClick={() => shift(-1)} aria-label="Mes anterior">
        <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
      </button>

      <Popover className="relative">
        <PopoverButton
          className="h-8 px-2 rounded-xl flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 transition-colors"
          aria-label={`Periodo: ${MONTHS_LONG[current_Month - 1]} de ${current_Year}. Cambiar`}
        >
          <CalendarDaysIcon className="w-4 h-4 text-topi-500" aria-hidden="true" />
          <span className="tabular-nums whitespace-nowrap">{MONTHS[current_Month - 1]} {current_Year}</span>
        </PopoverButton>

        <PopoverPanel
          anchor={{ to: 'bottom', gap: 8 }}
          transition
          className="z-50 w-64 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 shadow-xl transition duration-150 ease-out data-[closed]:opacity-0 data-[closed]:-translate-y-1"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" className={btn} onClick={() => set_period(current_Year - 1, current_Month)} aria-label="Año anterior">
              <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{current_Year}</span>
            <button type="button" className={btn} onClick={() => set_period(current_Year + 1, current_Month)} aria-label="Año siguiente">
              <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {MONTHS.map((m, i) => {
              const month = i + 1;
              const selected = month === current_Month;
              const isToday = current_Year === thisYear && month === thisMonth;
              return (
                <CloseButton
                  key={m}
                  as="button"
                  type="button"
                  onClick={() => set_period(current_Year, month)}
                  aria-pressed={selected}
                  className={`h-9 rounded-xl text-sm font-medium transition-colors ${selected
                    ? 'bg-topi-500 text-white shadow'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-topi-50 dark:hover:bg-gray-700'} ${isToday && !selected ? 'ring-1 ring-topi-500/50' : ''}`}
                >
                  {m}
                </CloseButton>
              );
            })}
          </div>
          {!isCurrent && (
            <CloseButton
              as="button"
              type="button"
              onClick={() => set_period(thisYear, thisMonth)}
              className="mt-2 w-full h-8 rounded-xl text-sm font-medium text-topi-600 dark:text-indigo-300 hover:bg-topi-50 dark:hover:bg-gray-700 transition-colors"
            >
              Ir al mes actual
            </CloseButton>
          )}
        </PopoverPanel>
      </Popover>

      <button type="button" className={btn} onClick={() => shift(1)} aria-label="Mes siguiente">
        <ChevronRightIcon className="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  );
};

const mapStateToProps = (state) => ({
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, { set_period })(PeriodSelector);
