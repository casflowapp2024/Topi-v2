// Bienvenida (plan/27 §B) y banco no soportado (§C): el estado sale de la API, no del front.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { OnboardingChecklist } from './OnboardingChecklist';
import UnsupportedBankNotice from './UnsupportedBankNotice';
import { readingLine, timeAgo } from './readingText';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
}), { virtual: true });
global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const NOW = new Date('2026-11-14T12:00:00Z').getTime();

const mount = async (element) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(element); });
};

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.clearAllMocks();
});

const steps = (done) => ['connect_email', 'first_auto_tx', 'review', 'budget'].map((id) => ({ id, done: done.includes(id) }));
const reading = (connections, extra = {}) => ({ connections, supported_banks: ['BBVA', 'Bancolombia'], samples_address: '', ...extra });

test('cuenta nueva: 4 pasos, el primero con su acción', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps([]), complete: false, pending_review: 0 })}
    loadReading={async () => reading([])} />);
  expect(container.textContent).toContain('Empieza con Topi');
  expect(container.textContent).toContain('0 de 4');
  const link = [...container.querySelectorAll('a')].find(a => a.textContent === 'Conectar correo');
  expect(link.getAttribute('href')).toBe('/dashboard/connect-email');
  expect(container.textContent).not.toContain('Ir a Presupuestos'); // solo la acción del siguiente paso
});

test('tras conectar: "Leyendo tus correos…" con el banco esperado y la última lectura', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email']), complete: false, pending_review: 0 })}
    loadReading={async () => reading([{ id: 1, provider: 'gmail', reading: 'reading_first',
      last_read_at: new Date(NOW - 5 * 60000).toISOString(), banks: [{ id: 3, name: 'Bancolombia', supported: true }] }])} />);
  expect(container.textContent).toContain('1 de 4');
  expect(container.textContent).toContain('Leyendo tus correos…');
  expect(container.textContent).toContain('Esperamos movimientos de Bancolombia');
  expect(container.textContent).toContain('hace 5 min');
  expect(container.textContent).toContain('los últimos días');
});

test('Por revisar muestra cuántos hay', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx']), complete: false, pending_review: 2 })}
    loadReading={async () => reading([])} />);
  expect(container.textContent).toContain('Tienes 2 movimientos por revisar');
});

test('completa: se oculta', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx', 'review', 'budget']), complete: true })}
    loadReading={async () => reading([{ id: 1, reading: 'ok', banks: [] }])} />);
  expect(container.textContent).toBe('');
});

test('banco no soportado: aviso aunque la checklist esté completa, con los bancos que se leen', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx', 'review', 'budget']), complete: true })}
    loadReading={async () => reading([{ id: 2, reading: 'no_transactions', banks: [{ id: 9, name: 'Banco Raro', supported: false }] }])} />);
  expect(container.textContent).toContain('Todavía no vemos movimientos de tu banco');
  expect(container.textContent).toContain('Banco Raro');
  expect(container.textContent).toContain('Hoy leemos: BBVA, Bancolombia');
  expect(container.textContent).not.toContain('Ayudar a agregar mi banco'); // sin buzón configurado no se pide
});

test('pedir el correo de ejemplo registra el evento y muestra el buzón del equipo', async () => {
  axios.post.mockResolvedValue({ data: { data: { address: 'bancos@topi.test' } } });
  const connection = { id: 2, reading: 'no_transactions', banks: [{ id: 9, name: 'Banco Raro', supported: false }] };
  await mount(<UnsupportedBankNotice connection={connection} supportedBanks={['BBVA']} samplesAddress="bancos@topi.test" />);
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Ayudar a agregar mi banco');
  await act(async () => { button.click(); });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/banks/sample-request'), { bank_id: 9 }, expect.any(Object));
  expect(container.textContent).toContain('bancos@topi.test');
  expect(container.textContent).toContain('No queda guardado en Topi');
});

test('readingLine y timeAgo', () => {
  expect(readingLine({ reading: 'ok' })).toBeNull();
  expect(readingLine({ reading: 'no_accounts', provider: 'outlook' }).title).toContain('Outlook');
  expect(timeAgo(new Date(NOW - 3 * 3600000).toISOString(), NOW)).toBe('hace 3 h');
  expect(timeAgo(new Date(NOW - 2 * 86400000).toISOString(), NOW)).toBe('hace 2 días');
  expect(timeAgo(null, NOW)).toBeNull();
});
