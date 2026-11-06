import * as React from "react"
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "@heroicons/react/24/outline"
import { DatePicker } from "./DatePicker.tsx"
import { inputClass } from "./Field"

interface SingleDateSelectorProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  className?: string
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

// El calendario flota (anchor) en vez de ir en absolute: dentro de un Modal o Sheet con scroll no se corta
// y se voltea solo si no cabe abajo.
export function SingleDateSelector({ value, onChange, className, ...buttonProps }: SingleDateSelectorProps) {
  return (
    <div className={`w-full block ${className || ''}`}>
      <Popover className="w-full block">
        <PopoverButton {...buttonProps} className={inputClass({ className: 'flex items-center text-left' })}>
          <CalendarIcon className="w-5 h-5 mr-2 text-gray-400" aria-hidden="true" />
          {value ? (
            format(value, "PPP", { locale: es })
          ) : (
            <span className="text-gray-400">Seleccionar fecha</span>
          )}
        </PopoverButton>

        <PopoverPanel anchor={{ to: 'bottom start', gap: 4, padding: 8 }}
          className="z-[60] w-max min-w-[300px] p-1 sm:p-2 bg-white border border-gray-200 rounded-xl shadow-lg dark:bg-gray-800 dark:border-gray-700">
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
