// Lanzamiento por etapas (plan/27 §I): criterios por etapa contra los números reales, manuales marcados.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminLaunchView } from './AdminLaunch';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
afterEach(() => { act(() => root.unmount()); container.remove(); });

const data = {
  current: 'I.1',
  activation_from: '2026-11-15',
  stages: [{ stage: 'I.1', started_at: '2026-11-15', note: 'Arrancamos con 20 cercanos' }],
  activation: { signups: 12, connection_24h_pct: 66.7, first_auto_tx_48h_pct: 41.7 },
  uas_now: 7,
  uas_weeks: [{ day: '2026-11-08', value: 3 }, { day: '2026-11-15', value: 7 }],
  retention_w4_pct: null,
  gmail: { connected: 24, cap: 100, note: 'Google cuenta cada cuenta que dio permiso alguna vez.' },
  reconnect: { open: 1, reconnected_7d_pct: 50 },
  feedback_unread: 2,
  criteria: [
    { stage: 'I.1', label: 'Correo conectado en 24 h', target: '≥ 60 %', value: '67 % de 12 registros', ok: true },
    { stage: 'I.1', label: '1.ª transacción automática en 48 h', target: '≥ 50 %', value: '42 %', ok: false },
    { stage: 'I.1', label: 'Errores graves abiertos', target: '0', value: 'revisar a mano', ok: null },
  ],
};

test('muestra cada criterio con su estado, los cupos de Gmail y la decisión anotada', async () => {
  const onSetStage = jest.fn();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<AdminLaunchView data={data} onSetStage={onSetStage} saving={false} />); });
  const t = container.textContent;
  expect(t).toContain('Etapa actual: I.1');
  expect(t).toContain('Cumple');
  expect(t).toContain('Aún no');
  expect(t).toContain('A mano');
  expect(t).toContain('24 / 100');
  expect(t).toContain('Decisión: Arrancamos con 20 cercanos');
  expect(container.querySelector('select').value).toBe('I.2'); // siguiente etapa sugerida

  await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(onSetStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'I.2' }));
});
