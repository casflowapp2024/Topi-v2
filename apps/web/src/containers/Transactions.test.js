// Transacciones agrupadas por día: cabeceras, neto diario, transferencias neutrales y Agregar discreto.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import Transactions from './Transactions';
import { dayLabel, dayNet, groupByDay } from '../components/transactions/transactionDays';
import { formatMoney } from '../components/helpers';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => () => {},
}), { virtual: true });
jest.mock('../components/ui/RangeDateSelector.tsx', () => ({ RangeDateSelector: () => null }));
jest.mock('../components/ui/DatePicker.tsx', () => ({ DatePicker: () => null }));
jest.mock('../components/ui/SingleDateSelector.tsx', () => ({ SingleDateSelector: () => null }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const tx = (id, date, amount, extra = {}) => ({
  id, description: `Mov ${id}`, amount, amount_base: amount, currency: 'COP', expense: true, checked: true, should_verify: false,
  date: `${date} 10:00:00 -0500`, category: { id: 7, name: 'mercado', emoji: '1f6d2' }, account: { id: 1, name: 'Nómina' }, ...extra,
});
const items = [
  tx(1, '2026-10-30', 50000),
  tx(2, '2026-10-30', 200000, { expense: false, category: { id: 8, name: 'salario' } }),
  tx(3, '2026-10-30', 90000, { transfer_group_id: 'g1' }),
  tx(4, '2026-10-27', 90000, { transfer_group_id: 'g2' }),
];
const state = (over = {}) => ({
  CashFlow: {
    user_accounts: { items: [] }, user_categories: { items: [{ id: 7, name: 'mercado', emoji: '1f6d2' }], default: [] },
    user_transactions: { items, total: items.length, default_limit: 30 },
    trans_filters_activated: { categorie_ids: [], accounts_ids: [], iniDate: '', endDate: '', keyword: '', expence: '', sortby: 'date', automated: '', shouldVerify: '', checked: '', transfer: '', params: '' },
    first_steps: {}, banks: { items: [] }, ...over,
  },
  Reports: {}, Alert: {},
});
const mount = async (st) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Provider store={createStore((s = st) => s, applyMiddleware(thunk))}><Transactions /></Provider>); });
  return { el, root };
};

test('Cabecera del día: Hoy, Ayer y día de la semana', () => {
  const now = new Date(2026, 9, 30, 15);
  expect(dayLabel('2026-10-30', now)).toBe('Hoy, 30 oct');
  expect(dayLabel('2026-10-29', now)).toBe('Ayer, 29 oct');
  expect(dayLabel('2026-10-26', now)).toBe('lun 26 oct');
  expect(dayLabel('2025-10-27', now)).toBe('lun 27 oct 2025');
});

test('Neto del día sin transferencias ni pagos sin su otra pata', () => {
  const [today, past] = groupByDay(items);
  expect(today.items).toHaveLength(3);
  expect(dayNet(today.items)).toBe(150000);
  expect(dayNet(past.items)).toBeNull();
  expect(dayNet([tx(9, '2026-10-30', 1000, { needs_counterpart: true })])).toBeNull();
  expect(dayNet([tx(9, '2026-10-30', 1000), tx(10, '2026-10-30', 500, { amount_base: null })])).toBe(-1000);
});

test('Una compra a cuotas pesa su cuota en el neto y lo dice en la fila', async () => {
  const purchase = tx(11, '2026-11-10', 1200000, {
    installments: 6, installment_amount: '200000', installment_amount_base: '200000',
  });
  expect(dayNet([purchase])).toBe(-200000);
  expect(dayNet([tx(12, '2026-10-10', 1200000, { installments: 6 })])).toBe(-1200000); // sin repartir
  const { el, root } = await mount(state({ user_transactions: { items: [purchase], total: 1, default_limit: 30 } }));
  expect(el.textContent).toMatch(/6 cuotas de .*200\.000/);
  await act(async () => root.unmount());
});

test('Lista por día con neto, transferencias neutrales y Agregar sin relleno', async () => {
  const { el, root } = await mount(state());
  expect([...el.querySelectorAll('h3')].map(h => h.id)).toEqual(['date-2026-10-30', 'date-2026-10-27']);
  expect(el.querySelector('section').textContent).toContain(`+${formatMoney(150000)}`);
  const row = (text) => [...el.querySelectorAll('li')].find(li => li.textContent.includes(text));
  expect(row('Mov 1').textContent).toContain('Mercado · Nómina');
  const transfer = row('Mov 3');
  expect(transfer.textContent).toContain('Transferencia');
  expect(transfer.querySelector('[aria-label]').getAttribute('aria-label')).not.toMatch(/^menos/);
  expect(transfer.querySelector('.text-data-transfer')).not.toBeNull();
  const add = el.querySelector('[aria-label="Agregar movimiento"]');
  expect(add.className).not.toContain('bg-topi-500');
  await act(async () => root.unmount());
});

test('El día partido por la paginación no muestra un neto a medias', async () => {
  const { el, root } = await mount(state({ user_transactions: { items, total: 40, default_limit: 4 } }));
  const sections = [...el.querySelectorAll('section')];
  expect(sections[0].textContent).toContain(`+${formatMoney(150000)}`);
  expect(sections[1].querySelector('.tabular-nums.text-money-out, .tabular-nums.text-money-in')).toBeNull();
  await act(async () => root.unmount());
});

test('Sin transacciones invita a conectar el correo, no a digitar', async () => {
  const { el, root } = await mount(state({ user_transactions: { items: [], total: 0, default_limit: 30 } }));
  expect(el.textContent).toContain('Conectar correo');
  expect(el.textContent).not.toContain('Crear');
  await act(async () => root.unmount());
});
