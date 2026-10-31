// Bandeja "Por revisar": reúne los 4 tipos, confirma con un toque y baja el contador.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import axios from 'axios';
import ReviewInbox, { buildQueue, nextPaymentNotice } from './ReviewInbox';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('../../ui/RangeDateSelector.tsx', () => ({ RangeDateSelector: () => null }));
jest.mock('../../ui/DatePicker.tsx', () => ({ DatePicker: () => null }));
jest.mock('../../ui/SingleDateSelector.tsx', () => ({ SingleDateSelector: () => null }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const tx = (id, extra = {}) => ({
  id, description: `Compra ${id}`, amount: 25000, amount_base: 25000, currency: 'COP', expense: true,
  date: '2026-10-30 10:00:00 -0500', category: { id: 7, name: 'mercado', emoji: '1f6d2' }, account: { id: 1, name: 'Nómina' },
  should_verify: true, needs_counterpart: false, ...extra,
});
const payment = tx(2, { description: 'Pago tarjeta', expense: false, should_verify: false, needs_counterpart: true, account: { id: 3, name: 'Visa' } });
const pair = {
  out_transaction_id: 50, in_transaction_id: 51, out_amount: '100000', in_amount: '100000', out_currency: 'COP', in_currency: 'COP',
  out_account_id: 1, in_account_id: 2, out_date: '2026-10-29', in_date: '2026-10-29', out_description: 'a', in_description: 'b', confidence: 'high',
};
const accounts = [
  { id: 1, name: 'Nómina', type: { id: 1 } }, { id: 2, name: 'Bolsillo', type: { id: 1 } },
  { id: 3, name: 'Visa', type: { id: 4 } }, { id: 4, name: 'Vieja', type: { id: 4 }, closed_at: '2026-01-01' },
];
const nw = (id, balance) => ({ account_id: id, balance: String(balance), base_value: String(balance), currency: 'COP' });
const state = (extra = {}) => ({
  CashFlow: {
    user_accounts: { items: accounts },
    user_categories: { items: [{ id: 7, name: 'mercado', emoji: '1f6d2' }, { id: 8, name: 'salidas', emoji: '1f389' }], default: [] },
    user_transactions: { default_limit: 10 },
    trans_filters_activated: { categorie_ids: [], accounts_ids: [], params: '' },
    first_steps: { retrieved_email: true, email: true },
    ...extra.CashFlow,
  },
  Reports: { current_Month: 10, current_Year: 2026 },
  Fx: { net_worth: { accounts: [nw(1, 900), nw(3, 60000), nw(4, 70)] }, ...extra.Fx },
  Alert: {},
});

const api = (txs, candidates, creditCards = []) => {
  axios.get.mockImplementation((url) => {
    if (url.includes('should_verify=true')) return Promise.resolve({ status: 200, data: { data: { transactions: txs, meta: { total: txs.length } } } });
    if (url.includes('transfer/candidates')) return Promise.resolve({ status: 200, data: { data: candidates } });
    if (url.includes('analysis/credit-cards')) return Promise.resolve({ status: 200, data: { data: creditCards } });
    return Promise.resolve({ status: 200, data: { data: {} } });
  });
  axios.put.mockResolvedValue({ status: 200, data: { data: {} } });
};

const mount = async (st) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  const store = createStore((s = st) => s, applyMiddleware(thunk));
  await act(async () => { root.render(<Provider store={store}><ReviewInbox /></Provider>); });
  return { el, root };
};
const button = (el, text) => [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const click = (node) => act(async () => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const title = (el) => el.querySelector('h2').textContent;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  axios.put.mockClear();
  mockNavigate.mockClear();
});

test('La cola toma un ítem de cada tipo antes de repetir', () => {
  expect(buildQueue([[1, 2, 3], ['a'], [], ['x', 'y']])).toEqual([1, 'a', 'x', 2, 'y', 3]);
});

test('Muestra el actual y, solo en PC, el siguiente; Siguiente recorre los 4 tipos', async () => {
  api([tx(1), payment], [pair]);
  const { el, root } = await mount(state());
  const next = () => click(el.querySelector('[aria-label="Ver el siguiente por revisar"]'));
  expect(title(el)).toBe('Por revisar · 4');
  expect(button(el, 'Mercado')).toBeTruthy();                 // categoría sugerida, un toque
  expect(button(el, 'Otra…')).toBeTruthy();
  expect(button(el, '¿De qué cuenta salió?').closest('.hidden.lg\\:block')).not.toBeNull();
  expect(button(el, 'Unir como transferencia')).toBeFalsy();  // el resto espera su turno
  await next();
  expect(button(el, '¿De qué cuenta salió?').closest('.hidden.lg\\:block')).toBeNull();
  await next();
  expect(button(el, 'Unir como transferencia').closest('.hidden.lg\\:block')).toBeNull();
  await next();
  expect(el.textContent).toContain('Pagado de más en Visa');
  expect(el.textContent).not.toContain('Vieja');               // las cerradas no se revisan
  await next();
  expect(button(el, 'Mercado')).toBeTruthy();                 // da la vuelta
  await act(async () => root.unmount());
});

test('Confirmar con un toque guarda, saca el ítem y baja el contador', async () => {
  jest.useFakeTimers();
  api([tx(1), tx(3)], []);
  const { el, root } = await mount(state({ Fx: { net_worth: { accounts: [] } } }));
  expect(title(el)).toBe('Por revisar · 2');
  await click(button(el, 'Mercado'));
  expect(axios.put).toHaveBeenCalledTimes(1);
  const [url, body] = axios.put.mock.calls[0];
  expect(url).toContain('/transactions/1');
  expect(JSON.parse(body)).toMatchObject({ category_id: 7, should_verify: false, checked: true });
  await act(async () => { jest.advanceTimersByTime(250); });
  expect(title(el)).toBe('Por revisar · 1');
  expect(el.textContent).not.toContain('Compra 1');
  expect(el.textContent).toContain('Compra 3');               // sale el siguiente
  jest.useRealTimers();
  await act(async () => root.unmount());
});

test('Una pareja que llega a una tarjeta se une como pago de tarjeta', async () => {
  api([], [{ ...pair, in_account_id: 3 }]);
  const { el, root } = await mount(state({ Fx: { net_worth: { accounts: [] } } }));
  expect(button(el, 'Unir como pago de tarjeta')).toBeTruthy();
  expect(button(el, 'Unir como transferencia')).toBeFalsy();
  await act(async () => root.unmount());
});

test('Ver todo lleva a Transacciones con el filtro', async () => {
  api([1, 3, 4, 5, 6, 7].map(i => tx(i)), []);
  const st = state({ Fx: { net_worth: { accounts: [] } } });
  const { el, root } = await mount(st);
  expect(title(el)).toBe('Por revisar · 6');
  await click(button(el, 'Ver todo'));
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/transactions');
  await act(async () => root.unmount());
});

test('Vacío: "Todo al día"; sin correo conectado invita a conectarlo, no a digitar', async () => {
  api([], []);
  const empty = await mount(state({ Fx: { net_worth: { accounts: [] } } }));
  expect(empty.el.textContent).toContain('Todo al día');
  await act(async () => empty.root.unmount());
  const noMail = await mount(state({ Fx: { net_worth: { accounts: [] } }, CashFlow: { first_steps: { retrieved_email: true, email: false } } }));
  expect(noMail.el.textContent).toContain('Conecta tu correo');
  await click(button(noMail.el, 'Conectar correo'));
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/connect-email');
  await act(async () => noMail.root.unmount());
});

test('Sin pendientes recuerda el próximo pago de tarjeta, sin sumarlo al contador', async () => {
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  const card = { name: 'Visa', currency: 'COP', pending_statement: '200000', due_date: soon };
  expect(nextPaymentNotice([{ ...card, pending_statement: '0' }])).toBeNull();
  api([], [], [card]);
  const { el, root } = await mount(state({ Fx: { net_worth: { accounts: [] } } }));
  expect(title(el)).toBe('Por revisar');
  expect(el.textContent).toContain('Todo al día');
  expect(el.textContent).toMatch(/Visa: paga ≈ .*200\.000 antes del/);
  await act(async () => root.unmount());
});

test('Si la API falla no dice "Todo al día"', async () => {
  axios.get.mockRejectedValue(new Error('caída'));
  const { el, root } = await mount(state({ Fx: { net_worth: { accounts: [] } } }));
  expect(el.textContent).not.toContain('Todo al día');
  expect(button(el, 'Reintentar')).toBeTruthy();
  await act(async () => root.unmount());
});
