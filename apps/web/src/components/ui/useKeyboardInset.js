import { useEffect, useState } from 'react';

const PHONE = '(max-width: 639px)';
// menos que esto no es el teclado (barras del navegador que aparecen y desaparecen)
const MIN_KEYBOARD = 120;

/**
 * En el celular el teclado tapa la parte de abajo de la pantalla sin achicar la página (iOS, y Chrome
 * en Android desde la v108). Una hoja pegada abajo queda escondida detrás. Este hook mide cuánto tapa
 * (`window.visualViewport`) para subir la hoja justo encima del teclado.
 * Devuelve { bottom, height }: lo tapado y el alto visible; ambos 0 sin teclado o fuera del celular.
 */
const useKeyboardInset = (active) => {
  const [inset, setInset] = useState({ bottom: 0, height: 0 });
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv || !window.matchMedia) return undefined;
    const phone = window.matchMedia(PHONE);
    const update = () => {
      const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      const next = phone.matches && covered > MIN_KEYBOARD ? { bottom: covered, height: Math.round(vv.height) } : { bottom: 0, height: 0 };
      setInset(prev => (prev.bottom === next.bottom && prev.height === next.height ? prev : next));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setInset({ bottom: 0, height: 0 });
    };
  }, [active]);
  return inset;
};

export default useKeyboardInset;
