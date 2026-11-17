// Bienvenida (plan/27 §B) y banco no soportado (§C): el estado sale de la API, no del front.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { OnboardingChecklist } from './OnboardingChecklist';
import UnsupportedBankNotice from './UnsupportedBankNotice';
import { readingLine, timeAgo } from './readingText';
import { emitDataChanged, onDataChanged, kindOfRequest } from '../../../lib/dataEvents';

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
  jest.useRealTimers();
  sessionStorage.clear();
});

const steps = (done) => ['connect_email', 'first_auto_tx', 'review', 'budget'].map((id) => ({ id, done: done.includes(id) }));
const reading = (connections, extra = {}) => ({ connections, supported_banks: ['BBVA', 'Bancolombia'], ...extra });

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
  expect(container.textContent).toContain('tus movimientos recientes');
});

test('Por revisar muestra cuántos hay', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx']), complete: false, pending_review: 2 })}
    loadReading={async () => reading([])} />);
  expect(container.textContent).toContain('Te quedan 2 por revisar');
});

test('completa: se oculta', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx', 'review', 'budget']), complete: true })}
    loadReading={async () => reading([{ id: 1, reading: 'ok', banks: [] }])} />);
  expect(container.textContent).toBe('');
});

test('banco sin correos de su remitente: pregunta el remitente aunque la checklist esté completa, sin lista de bancos', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx', 'review', 'budget']), complete: true })}
    loadReading={async () => reading([{ id: 2, reading: 'no_transactions', banks: [{ id: 9, name: 'ARQ', supported: false,
      sender: 'no-reply@arqfinance.com', reading: 'no_emails', found: 0, account_ids: [4] }] }])} />);
  expect(container.textContent).toContain('No encontramos correos de ARQ');
  expect(container.textContent).toContain('no-reply@arqfinance.com');
  expect(container.textContent).toContain('¿Desde qué correo te escribe tu banco?');
  expect(container.textContent).not.toContain('Hoy leemos');
  expect(container.textContent).not.toContain('Reenvía');
});

test('correos encontrados que aún no sabemos leer: lo dice y no pide nada', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email']), complete: false, pending_review: 0 })}
    loadReading={async () => reading([{ id: 2, reading: 'no_transactions', banks: [{ id: 9, name: 'ARQ', supported: false,
      sender: 'no-reply@arqfinance.com', reading: 'unreadable', found: 6, account_ids: [4] }] }])} />);
  expect(container.textContent).toContain('Aún no sabemos leer los correos de ARQ');
  expect(container.textContent).toContain('Encontramos 6 correos');
  expect(container.querySelector('input')).toBeNull();
});

test('corregir el remitente: confirma el dominio, guarda y vuelve a leer las cuentas de ese banco', async () => {
  const save = jest.fn(async () => {});
  const onSaved = jest.fn();
  const bank = { id: 9, name: 'Davibank', sender: 'viejo@banco.co', reading: 'no_emails', found: 0, account_ids: [4, 5] };
  await mount(<UnsupportedBankNotice bank={bank} save={save} onSaved={onSaved} />);
  const input = container.querySelector('input');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setValue.call(input, 'DAVIbankInforma@davibank.com');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(container.textContent).toContain('Topi leerá solo los correos de @davibank.com');
  const ok = [...container.querySelectorAll('button')].find(b => b.textContent === 'Confirmar');
  await act(async () => { ok.click(); });
  expect(save).toHaveBeenCalledWith(bank, 'DAVIbankInforma@davibank.com', [4, 5]);
  expect(onSaved).toHaveBeenCalled();
  expect(container.textContent).toContain('Estamos leyendo los correos de @davibank.com');
});

test('readingLine y timeAgo', () => {
  expect(readingLine({ reading: 'ok' })).toBeNull();
  expect(readingLine({ reading: 'no_accounts', provider: 'outlook' }).detail).toContain('Outlook');
  expect(timeAgo(new Date(NOW - 3 * 3600000).toISOString(), NOW)).toBe('hace 3 h');
  expect(timeAgo(new Date(NOW - 2 * 86400000).toISOString(), NOW)).toBe('hace 2 días');
  expect(timeAgo(null, NOW)).toBeNull();
});

// plan/30, bloque 2: el Inicio en vivo
test('mientras lee: cada 5 s, cuenta lo revisado y avisa a las demás tarjetas cuando llega algo', async () => {
  jest.useFakeTimers();
  const seen = [];
  const off = onDataChanged((kind) => seen.push(kind));
  let processed = 0;
  const loadReading = jest.fn(async () => reading([{ id: 1, provider: 'gmail', reading: 'reading_first',
    emails_processed: processed, transactions_created: 0, banks: [{ id: 3, name: 'Davibank', supported: true }] }]));
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email']), complete: false, pending_review: 0 })} loadReading={loadReading} />);
  expect(container.textContent).toContain('Suele tardar menos de un minuto');

  processed = 12;
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(loadReading).toHaveBeenCalledTimes(2);
  expect(container.textContent).toContain('Revisamos 12 correos');
  expect(seen).toEqual(['transactions']);
  off();
});

test('una revisión o un presupuesto vuelven a pedir el estado', async () => {
  const load = jest.fn(async () => ({ steps: steps(['connect_email', 'first_auto_tx']), complete: false, pending_review: 3 }));
  await mount(<OnboardingChecklist now={() => NOW} load={load} loadReading={async () => reading([])} />);
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { emitDataChanged('review'); });
  await act(async () => { emitDataChanged('budget'); });
  expect(load).toHaveBeenCalledTimes(3);
});

test('al terminar en esta sesión: "¡Listo!" hasta que se descarta', async () => {
  let complete = false;
  const load = async () => ({ steps: steps(complete ? ['connect_email', 'first_auto_tx', 'review', 'budget'] : ['connect_email', 'first_auto_tx', 'review']), complete, pending_review: 0 });
  await mount(<OnboardingChecklist now={() => NOW} load={load} loadReading={async () => reading([])} />);
  expect(container.textContent).toContain('3 de 4');
  complete = true;
  await act(async () => { emitDataChanged('budget'); });
  expect(container.textContent).toContain('¡Listo!');
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'Entendido');
  await act(async () => { button.click(); });
  expect(container.textContent).toBe('');
});

test('quien ya lo había terminado no ve el "¡Listo!"', async () => {
  await mount(<OnboardingChecklist now={() => NOW}
    load={async () => ({ steps: steps(['connect_email', 'first_auto_tx', 'review', 'budget']), complete: true })}
    loadReading={async () => reading([])} />);
  expect(container.textContent).toBe('');
});

test('kindOfRequest: qué escrituras avisan', () => {
  const base = process.env.REACT_APP_API_URL || '';
  expect(kindOfRequest('post', `${base}/accounts/create`)).toBe('account');
  expect(kindOfRequest('put', `${base}/accounts/12`)).toBe('account');
  expect(kindOfRequest('post', `${base}/email/register?code=x`)).toBe('connection');
  expect(kindOfRequest('put', `${base}/categories/5/budgets`)).toBe('budget');
  expect(kindOfRequest('post', `${base}/transactions/9/installments`)).toBe('review');
  expect(kindOfRequest('get', `${base}/transactions/list`)).toBeNull();
  expect(kindOfRequest('post', `${base}/feedback`)).toBeNull();
});
