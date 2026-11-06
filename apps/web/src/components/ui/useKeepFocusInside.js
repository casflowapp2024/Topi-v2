import { useEffect } from 'react';

/**
 * Mantiene el foco dentro del panel de un Modal/Sheet abierto.
 * headlessui atrapa el foco, pero si el diálogo se abre desde un Menu, el Menu le devuelve el foco a su
 * botón justo después de que el diálogo lo tomó, y con Tab se sale a la página. Aquí: al abrir y cada vez
 * que el foco cae fuera, vuelve al panel. Las capas flotantes de headlessui (calendario, listas con anchor)
 * viven en su raíz de portales y no se tocan.
 */
const isInPortalLayer = (node) => Boolean(node?.closest?.('#headlessui-portal-root'));

const useKeepFocusInside = (open, panelRef) => {
  useEffect(() => {
    if (!open) return undefined;
    const bringBack = () => {
      const panel = panelRef.current;
      const active = document.activeElement;
      if (!panel || panel.contains(active) || (active && active !== document.body && isInPortalLayer(active))) return;
      (panel.querySelector('[data-autofocus]') || panel).focus({ preventScroll: true });
    };
    const onFocusIn = (e) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(e.target) || isInPortalLayer(e.target)) return;
      bringBack();
    };
    // el Menu devuelve el foco a su botón en el siguiente ciclo: revisar un par de veces al abrir
    const timers = [0, 60, 200].map(ms => setTimeout(bringBack, ms));
    document.addEventListener('focusin', onFocusIn);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, panelRef]);
};

export default useKeepFocusInside;
