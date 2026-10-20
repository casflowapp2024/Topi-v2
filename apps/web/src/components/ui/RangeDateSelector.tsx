import * as React from "react"
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "@heroicons/react/24/outline"
import { DatePicker } from "./DatePicker.tsx"
import { DateRange } from "react-day-picker"

interface RangeDateSelectorProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  className?: string
}

export function RangeDateSelector({ value, onChange, className }: RangeDateSelectorProps) {
  const formatDateDisplay = (date: Date) => {
    return format(date, "dd/MMM/yyyy", { locale: es }).toUpperCase();
  }

  return (
    <Popover className="relative">
      <PopoverButton className={`
        flex items-center justify-center w-full px-3 py-2 text-sm text-center bg-white border border-gray-300 rounded-lg 
        focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
        dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500
        ${className}
      `}>
        <CalendarIcon className="w-5 h-5 mr-2 text-gray-400" aria-hidden="true" />
        {value?.from ? (
          <>
            {formatDateDisplay(value.from)}
            {value.to ? `  ↔  ${formatDateDisplay(value.to)}` : "  ↔  ..."}
          </>
        ) : (
          <span className="text-gray-400">Seleccionar rango</span>
        )}
      </PopoverButton>

      <PopoverPanel className="absolute py-3 z-50 bottom-full mb-1 lg:bottom-auto lg:top-full lg:mt-1 lg:mb-0 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700">
        <DatePicker
          mode="range"
          selected={value}
          onSelect={onChange}
        />
      </PopoverPanel>
    </Popover>
  )
}