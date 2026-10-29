import moment from 'moment';
import 'moment/locale/es';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { CalendarDaysIcon, ChevronDownIcon } from '@heroicons/react/20/solid';
import { DatePicker } from './DatePicker.tsx';

const DAY = 'YYYY-MM-DD';
const short = (d) => moment(d).locale('es').format('D MMM');

/**
 * Selector de rango con la misma forma que el selector de mes (PeriodSelector): pastilla redondeada,
 * texto corto ("14 oct – 13 nov") y el calendario anclado al botón (se monta fuera de la tarjeta,
 * así nunca queda tapado). from/to y onChange en 'YYYY-MM-DD'.
 */
const RangePill = ({ from, to, onChange, className = '' }) => {
  const value = from ? { from: moment(from, DAY).toDate(), to: to ? moment(to, DAY).toDate() : undefined } : undefined;
  const sameYear = from && to && moment(from, DAY).year() === moment(to, DAY).year();
  const label = from
    ? `${short(moment(from, DAY))} – ${to ? short(moment(to, DAY)) : '…'}${to && !sameYear ? ` ${moment(to, DAY).year()}` : ''}`
    : 'Elegir fechas';

  return (
    <Popover className={`relative ${className}`}>
      <PopoverButton
        className="h-9 pl-2.5 pr-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 transition-colors"
        aria-label={`Rango: ${label}. Cambiar`}
      >
        <CalendarDaysIcon className="w-4 h-4 text-topi-500" aria-hidden="true" />
        <span className="tabular-nums whitespace-nowrap">{label}</span>
        <ChevronDownIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 8 }}
        transition
        className="z-50 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 shadow-xl transition duration-150 ease-out data-[closed]:opacity-0 data-[closed]:-translate-y-1"
      >
        <DatePicker
          mode="range"
          selected={value}
          onSelect={(r) => onChange(r?.from ? moment(r.from).format(DAY) : '', r?.to ? moment(r.to).format(DAY) : '')}
        />
      </PopoverPanel>
    </Popover>
  );
};

export default RangePill;
