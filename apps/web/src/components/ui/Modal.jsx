import { Fragment, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import useKeepFocusInside from './useKeepFocusInside';

const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-2xl',
  full: 'sm:max-w-[1168px]',
};

const noop = () => {};

/**
 * Diálogo de Topi, hermano de `Sheet` (misma API).
 * - Móvil: hoja que sube desde abajo, con agarradera y acciones fijas abajo a lo ancho.
 * - Desde sm: diálogo centrado (`size`: sm | md | lg | xl | full).
 * Esc, clic fuera y foco atrapado los da headlessui. `dismissible={false}` solo para flujos que no se
 * pueden saltar (onboarding): no cierra con Esc ni clic fuera y no muestra el botón cerrar.
 *
 * footer: acciones. Pasa primero la secundaria (`ghost`) y luego la primaria: en PC la primaria queda a la
 * derecha; en móvil la primaria queda arriba y ambas a lo ancho.
 * Regla de uso: formularios cortos → Modal; detalle largo o que acompaña una lista → Sheet.
 */
const Modal = ({
  open, onClose, title, description, children, footer, size = 'md',
  dismissible = true, hideTitle = false, bodyClassName = 'px-5 py-4', className = '',
}) => {
  const panelRef = useRef(null);
  useKeepFocusInside(Boolean(open), panelRef);
  return (
  <Transition show={Boolean(open)} as={Fragment}>
    <Dialog as="div" className="relative z-50 font-Inter" onClose={dismissible ? onClose : noop}>
      <TransitionChild as={Fragment}
        enter="ease-out duration-200 motion-reduce:duration-0" enterFrom="opacity-0" enterTo="opacity-100"
        leave="ease-in duration-150 motion-reduce:duration-0" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      </TransitionChild>

      <div className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-6">
        <TransitionChild as={Fragment}
          enter="ease-out duration-300 motion-reduce:duration-0" enterFrom="translate-y-full sm:translate-y-0 sm:opacity-0 sm:scale-95" enterTo="translate-y-0 sm:opacity-100 sm:scale-100"
          leave="ease-in duration-200 motion-reduce:duration-0" leaveFrom="translate-y-0 sm:opacity-100 sm:scale-100" leaveTo="translate-y-full sm:translate-y-0 sm:opacity-0 sm:scale-95">
          <DialogPanel ref={panelRef} tabIndex={-1} className={`w-full ${SIZES[size] || SIZES.md} max-h-[92dvh] sm:max-h-[90vh] flex flex-col focus:outline-none bg-white dark:bg-surface-raised text-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-3xl shadow-2xl ${className}`}>
            {/* agarradera en móvil */}
            <div className="sm:hidden flex justify-center pt-2" aria-hidden="true">
              <span className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <header className={`flex items-start justify-between gap-3 px-5 pt-3 sm:pt-5 pb-3 border-b border-gray-200 dark:border-gray-700 ${hideTitle ? 'sr-only' : ''}`}>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
                {description && <p className="text-sm text-ink-2 dark:text-gray-400">{description}</p>}
              </div>
              {dismissible && (
                <button type="button" onClick={onClose} aria-label="Cerrar"
                  className="shrink-0 rounded-full p-2 -mr-2 -mt-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
                  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </header>
            <div className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${bodyClassName}`}>{children}</div>
            {footer && (
              <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 [&>*]:w-full sm:[&>*]:w-auto">
                {footer}
              </footer>
            )}
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </Transition>
  );
};

export default Modal;
