import { act } from 'react';
import { createRoot } from 'react-dom/client';
import Sheet from './Sheet';

global.IS_REACT_ACT_ENVIRONMENT = true;

// visualViewport falso: el teclado tapa `covered` px de una pantalla de 800 px
const fakeViewport = () => {
  const listeners = {};
  const vv = { height: 800, offsetTop: 0, addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: () => {} };
  return { vv, keyboard: (covered) => { vv.height = 800 - covered; listeners.resize?.(); } };
};

test('en el celular la hoja sube encima del teclado y vuelve al cerrarlo', async () => {
  const { vv, keyboard } = fakeViewport();
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  window.matchMedia = (q) => ({ matches: q.includes('max-width: 639px'), addEventListener() {}, removeEventListener() {} });
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Sheet open onClose={() => {}} title="Hoja"><input aria-label="campo" /></Sheet>));
  const panel = () => document.querySelector('[role=dialog] [tabindex="-1"]');
  expect(['', '0px']).toContain(panel().style.marginBottom);
  await act(async () => keyboard(320));
  expect(panel().style.marginBottom).toBe('320px');
  expect(panel().style.maxHeight).toBe('472px');
  // barras del navegador (poco) no cuentan como teclado
  await act(async () => keyboard(60));
  expect(['', '0px']).toContain(panel().style.marginBottom);
  await act(async () => root.unmount());
});
