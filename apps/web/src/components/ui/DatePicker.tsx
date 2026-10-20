import * as React from "react";
import { format } from "date-fns";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { es } from "date-fns/locale";

export function DatePicker(props: React.ComponentProps<typeof DayPicker>) {
  const { mode = "range", selected, onSelect } = props as any;
  /* 
  let footer = <p>Por favor, seleccione una fecha.</p>;

  if (mode === "range") {
    const range = selected as DateRange | undefined;
    if (range?.from) {
      if (!range.to) {
        footer = <p>{format(range.from, "PPP", { locale: es })}</p>;
      } else if (range.to) {
        footer = (
          <p>
            {format(range.from, "PPP", { locale: es })}–
            {format(range.to, "PPP", { locale: es })}
          </p>
        );
      }
    } else {
      footer = <p>Por favor, seleccione un rango de fechas.</p>;
    }
  } else if (mode === "single") {
    if (selected) {
      footer = <p>{format(selected as Date, "PPP", { locale: es })}</p>;
    }
  } */

  //https://daypicker.dev/docs/styling
  return (
    <DayPicker
      mode={mode}
      selected={selected}
      onSelect={onSelect}
      navLayout="around"
      //footer={footer}

      locale={es}
      captionLayout="dropdown"
      fromYear={2020}
      toYear={2030}
      style={
        {
          // Color de fondo para los días de inicio y fin (y selección simple)
          '--rdp-accent-color': '#5266EB', // Tailwind
          // Tailwind's green-600 (o el color que quieras)
          '--rdp-today-color': '#5266EB', // Tailwind's green-600 (o el color que quieras)
          '--rdp-range_start-color': 'white', // Tailwind's green-600 (o el color que quieras)
          '--rdp-background-color-active': '#D1FAE5', // Color de fondo para los días en el medio del rango

          //Sizing
          '--rdp-weekday-padding': '2px',
          '--rdp-week_number-width': '100%',
          '--rdp-week_number-height': '50%',
          '--rdp-color-selected-text': 'white',
          '--rdp-day-height': '40px',
          '--rdp-day-width': '40px',
          '--rdp-day_button-width': '100%',
          '--rdp-day_button-height': '100%',
          //navigation

          '--rdp-nav_button-height': '25px',
          '--rdp-nav_button-width': '35px',
          '--rdp-nav-height': '40px',
        } as React.CSSProperties
      }
      classNames={{
        nav: "w-full border-b border-gray-800",

      }}
      {...props}
    />
  );
}