import { forwardRef, useId, cloneElement, isValidElement } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/20/solid';

// Estilos comunes de los controles de formulario (también para controles propios que no usan Input/Select).
const BASE = 'w-full rounded-xl border bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-topi-500 focus:border-topi-500 disabled:opacity-60 disabled:cursor-not-allowed';
const BORDER = 'border-gray-200 dark:border-gray-700';
const BORDER_ERROR = 'border-status-crit dark:border-red-400';

export const controlClass = ({ invalid = false, className = '' } = {}) =>
  `${BASE} ${invalid ? BORDER_ERROR : BORDER} ${className}`;
export const inputClass = (opts = {}) => controlClass({ ...opts, className: `h-11 px-3 ${opts.className || ''}` });
export const selectClass = (opts = {}) => controlClass({ ...opts, className: `h-11 pl-3 pr-8 ${opts.className || ''}` });
export const textareaClass = (opts = {}) => controlClass({ ...opts, className: `min-h-[88px] px-3 py-2.5 ${opts.className || ''}` });

/**
 * Campo de formulario: etiqueta, control, ayuda y error.
 * El control (un solo hijo) recibe id, aria-describedby y aria-invalid; si es Input/Select/Textarea,
 * además toma el borde de error. El error se dice con ícono + texto (no solo color).
 */
const Field = ({ label, help, error, required = false, id: idProp, className = '', labelClassName = '', children }) => {
  const auto = useId();
  const id = idProp || `f${auto.replace(/:/g, '')}`;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
      id: children.props.id || id,
      'aria-describedby': describedBy,
      'aria-invalid': error ? true : undefined,
      ...(children.type?.topiControl ? { invalid: Boolean(error) } : {}),
    })
    : children;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={children?.props?.id || id} className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${labelClassName}`}>
          {label}{required && <span className="text-status-crit-text dark:text-red-400" aria-hidden="true"> *</span>}
        </label>
      )}
      {control}
      {help && !error && <p id={helpId} className="text-xs text-ink-2 dark:text-gray-400">{help}</p>}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-xs font-medium text-status-crit-text dark:text-red-400">
          <ExclamationCircleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export const Input = forwardRef(({ invalid = false, className = '', ...props }, ref) => (
  <input ref={ref} className={inputClass({ invalid, className })} {...props} />
));
Input.topiControl = true;

export const Select = forwardRef(({ invalid = false, className = '', children, ...props }, ref) => (
  <select ref={ref} className={selectClass({ invalid, className })} {...props}>{children}</select>
));
Select.topiControl = true;

export const Textarea = forwardRef(({ invalid = false, className = '', ...props }, ref) => (
  <textarea ref={ref} className={textareaClass({ invalid, className })} {...props} />
));
Textarea.topiControl = true;

export default Field;
