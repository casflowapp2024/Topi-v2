import { Fragment, useEffect, useRef } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/20/solid';
import useKeepFocusInside from './useKeepFocusInside';
import useKeyboardInset from './useKeyboardInset';

/**
 * Hoja: en móvil sube desde abajo; desde sm es un panel lateral a la derecha.
 * footer: acciones fijas abajo (no se van con el scroll del contenido).
 * En el celular, con el teclado abierto la hoja sube y se ajusta al espacio visible para no quedar debajo.
 */
const Sheet = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const panelRef = useRef(null);
  useKeepFocusInside(Boolean(open), panelRef);
  const keyboard = useKeyboardInset(Boolean(open));
  // Al subir la hoja, el campo con el foco vuelve a la vista
  useEffect(() => {
    if (!keyboard.bottom) return;
    const active = document.activeElement;
    if (!panelRef.current?.contains(active)) return;
    // un desplegable (data-keyboard-anchor) sube al tope para que su lista quepa entre él y el teclado
    const anchor = active.closest?.('[data-keyboard-anchor]');
    (anchor || active).scrollIntoView?.({ block: anchor ? 'start' : 'nearest' });
  }, [keyboard.bottom, keyboard.height]);
  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50 font-Inter" onClose={onClose}>
        <TransitionChild as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-end sm:items-stretch sm:justify-end">
          <TransitionChild as={Fragment}
            enter="ease-out duration-300 motion-reduce:duration-0" enterFrom="translate-y-full sm:translate-y-0 sm:translate-x-full" enterTo="translate-y-0 sm:translate-x-0"
            leave="ease-in duration-200 motion-reduce:duration-0" leaveFrom="translate-y-0 sm:translate-x-0" leaveTo="translate-y-full sm:translate-y-0 sm:translate-x-full">
            <DialogPanel ref={panelRef} tabIndex={-1}
              style={keyboard.bottom ? { marginBottom: keyboard.bottom, maxHeight: keyboard.height - 8 } : { marginBottom: 0, maxHeight: '' }}
              className={`w-full ${size === 'lg' ? 'sm:max-w-lg' : 'sm:max-w-md'} max-h-[88vh] sm:max-h-none sm:h-full flex flex-col focus:outline-none bg-white dark:bg-surface-raised text-gray-900 dark:text-gray-100 rounded-t-3xl sm:rounded-none sm:rounded-l-3xl shadow-2xl`}>
              {/* agarradera en móvil */}
              <div className="sm:hidden flex justify-center pt-2" aria-hidden="true">
                <span className="w-10 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
              </div>
              <header className="flex items-start justify-between gap-3 px-5 pt-3 sm:pt-6 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
                  {description && <p className="text-sm text-ink-2 dark:text-gray-400">{description}</p>}
                </div>
                <button type="button" onClick={onClose} aria-label="Cerrar"
                  className="rounded-full p-2 -mr-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
                  <XMarkIcon className="w-5 h-5" aria-hidden="true" />
                </button>
              </header>
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">{children}</div>
              {footer && (
                <footer className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

export default Sheet;
