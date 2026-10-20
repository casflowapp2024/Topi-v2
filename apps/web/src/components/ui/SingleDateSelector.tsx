import * as React from "react"
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "@heroicons/react/24/outline"
import { DatePicker } from "./DatePicker.tsx"

interface SingleDateSelectorProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  className?: string
}

export function SingleDateSelector({ value, onChange, className }: SingleDateSelectorProps) {
  return (
    <div className={`w-full block ${className || ''}`}>
      <Popover className="relative w-full block">
        <PopoverButton className={`
          flex items-center w-full px-3 py-2 text-sm text-left bg-white border border-gray-300 rounded-lg 
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 
          dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500
        `}>
          <CalendarIcon className="w-5 h-5 mr-2 text-gray-400" aria-hidden="true" />
          {value ? (
            format(value, "PPP", { locale: es })
          ) : (
            <span className="text-gray-400">Seleccionar fecha</span>
          )}
        </PopoverButton>

        <PopoverPanel className="absolute z-50 bottom-full mb-1 w-max min-w-[300px] p-1 sm:p-2 bg-white border border-gray-200 rounded-lg shadow-lg dark:bg-gray-800 dark:border-gray-700 left-1/2 -translate-x-1/2">


          {({ close }) => (
            <div className="w-full flex items-center justify-center">
              <DatePicker
                mode="single"
                selected={value}
                onSelect={(date) => {
                  onChange(date)
                  close()
                }}
              />
            </div>
          )}
        </PopoverPanel>
      </Popover>
    </div>
  )
}