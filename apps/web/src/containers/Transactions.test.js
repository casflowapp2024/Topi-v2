// Transacciones agrupadas por día: cabeceras, neto diario, transferencias neutrales y Agregar discreto.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import Transactions, { TX_COLUMNS } from './Transactions';
import { dayLabel, dayNet, groupByDay, installmentsNote, pairTransfers, directionLabel } from '../components/transactions/transactionDays';
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

test('Las compras con tarjeta dicen sus cuotas; lo demás no', () => {
  const card = { id: 4, name: 'Visa', type: { id: 4 } };
  expect(installmentsNote({ expense: true, account: card })).toBe('1 cuota');
  expect(installmentsNote({ expense: true, account: card, installments: 6 })).toBe('6 cuotas');
  expect(installmentsNote({ expense: true, account: card, installments: 6, installment_amount: '200000', currency: 'COP' })).toMatch(/6 cuotas de .*200\.000/);
  expect(installmentsNote({ expense: false, account: card })).toBe('');                               // pago o devolución
  expect(installmentsNote({ expense: true, account: card, transfer_group_id: 'g' })).toBe('');        // transferencia
  expect(installmentsNote({ expense: true, account: { id: 1, type: { id: 1 } } })).toBe('');         // cuenta de ahorros
});

test('Una compra a cuotas pesa su cuota en el neto y lo dice en la fila', async () => {
  const purchase = tx(11, '2026-11-10', 1200000, {
    installments: 6, installment_amount: '200000', installment_amount_base: '200000',
    account: { id: 4, name: 'Visa', type: { id: 4 } },
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
  // una pata sola dice si sale o entra (−/+), pero en el gris de transferencia, no como gasto
  expect(transfer.querySelector('[aria-label]').getAttribute('aria-label')).toMatch(/^menos/);
  expect(transfer.querySelector('.tabular-nums').className).toContain('text-data-transfer');
  expect(transfer.querySelector('.lg\\:hidden').textContent).toBe('Sale de Nómina · Mercado');
  const add = el.querySelector('[aria-label="Agregar movimiento"]');
  expect(add.className).not.toContain('bg-topi-500');
  await act(async () => root.unmount());
});

test('En PC la lista es una tabla: el monto va junto a la descripción y la cuenta dice su tipo', async () => {
  const accounts = { items: [{ id: 1, name: 'Nómina', type: { id: 1, class: 'deposit' } }, { id: 4, name: 'Visa', type: { id: 4, class: 'credit' } }] };
  const list = [...items, tx(5, '2026-10-27', 30000, { account: { id: 4, name: 'Visa' } })];
  const { el, root } = await mount(state({ user_accounts: accounts, user_transactions: { items: list, total: list.length, default_limit: 30 } }));
  const header = [...el.querySelectorAll('div[aria-hidden="true"]')].find(d => d.textContent.includes('Descripción'));
  expect([...header.children].map(c => c.textContent)).toEqual(['', 'Descripción', 'Monto', '', 'Categoría', 'Cuenta']);
  expect(header.className).toContain('hidden');
  expect(header.className).toContain(TX_COLUMNS);
  const rowOf = (text) => [...el.querySelectorAll('li')].find(li => li.textContent.includes(text)).querySelector('button');
  const row = rowOf('Mov 1');
  expect(row.className).toContain(TX_COLUMNS);
  // en PC el orden lo da lg:order: ícono · descripción · monto · estado · categoría · cuenta
  const orderOf = (node) => Number(node.className.match(/lg:order-(\d)/)[1]);
  const money = row.querySelector('[aria-label]').closest('[class*="lg:order-"]');
  const desc = [...row.querySelectorAll('span')].find(sp => sp.textContent === 'Mov 1').parentElement;
  const category = row.querySelector('.hidden.lg\\:block');
  const account = row.querySelector('.hidden.lg\\:flex');
  expect([desc, money, category, account].map(orderOf)).toEqual([2, 3, 5, 6]);
  expect(category.textContent).toBe('Mercado');
  // la cuenta lleva el ícono de su tipo (con nombre para lectores de pantalla)
  expect(account.textContent).toBe('Efectivo: Nómina');
  expect(account.querySelector('svg')).not.toBeNull();
  expect(rowOf('Mov 5').querySelector('.hidden.lg\\:flex').textContent).toBe('Tarjetas: Visa');
  // en móvil, categoría y cuenta debajo de la descripción, como antes
  expect(row.querySelector('.lg\\:hidden').textContent).toBe('Mercado · Nómina');
  // el neto del día cae en la columna del monto
  expect(el.querySelector('section > div').className).toContain(TX_COLUMNS);
  expect(el.querySelector('section > div > span').className).toContain('lg:col-start-3');
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

test('Las dos patas de una transferencia van juntas, arriba la que entra', () => {
  const entra = tx(21, '2026-11-09', 251.36, { transfer_group_id: 't1', expense: false, currency: 'USD', amount_base: 817000, account: { id: 2, name: 'ARQ' } });
  const sale = tx(22, '2026-11-09', 817000, { transfer_group_id: 't1', account: { id: 3, name: 'Bolsillo' } });
  const suelta = tx(23, '2026-11-09', 100, { transfer_group_id: 't2' });
  const gasto = tx(24, '2026-11-09', 5000);
  const rows = pairTransfers([gasto, entra, suelta, sale]);
  expect(rows.map(r => r.map(t => t.id))).toEqual([[24], [21, 22], [23]]);
  expect(pairTransfers([])).toEqual([]);
  expect(directionLabel(sale)).toBe('Sale de Bolsillo');
  expect(directionLabel(entra)).toBe('Entra a ARQ');
});

test('La lista une las patas: arriba la que entra, abajo la que sale, con flecha y sin perder el emoji', async () => {
  const list = [
    tx(21, '2026-11-09', 251.36, { description: 'Trans a ARQ', transfer_group_id: 't1', expense: false, currency: 'USD', amount_base: 817000, account: { id: 2, name: 'ARQ' } }),
    tx(1, '2026-11-09', 50000),
    tx(22, '2026-11-09', 817000, { description: 'Trans a ARQ', transfer_group_id: 't1', account: { id: 3, name: 'Bolsillo' } }),
    tx(30, '2026-11-09', 1200000, { description: 'Pago tarjeta', needs_counterpart: true }),
  ];
  const { el, root } = await mount(state({ user_transactions: { items: list, total: list.length, default_limit: 30 } }));
  const pair = el.querySelector('[data-transfer-pair]');
  expect(pair.querySelectorAll('button')).toHaveLength(2);
  const [inn, out] = pair.querySelectorAll('button');
  expect(inn.textContent).toContain('Trans a ARQ');
  expect(inn.textContent).toContain('Transferencia que entra');
  expect(inn.querySelector('[aria-label]').getAttribute('aria-label')).not.toMatch(/^menos/);
  expect(inn.textContent).toContain(`+${formatMoney(251.36, 'USD')}`);
  // la que sale no repite la descripción: dice de qué cuenta sale, con −
  expect(out.textContent).not.toContain('Trans a ARQ');
  expect(out.textContent).toContain('Sale de Bolsillo');
  expect(out.textContent).toContain('Transferencia que sale');
  expect(out.querySelector('[aria-label]').getAttribute('aria-label')).toMatch(/^menos/);
  // el emoji de la categoría se queda en su columna; la flecha va junto al título
  const iconCol = inn.querySelector('.lg\\:order-1');
  expect(iconCol.querySelector('[title^="Transferencia"]')).toBeNull();
  expect(inn.querySelector('.lg\\:order-2 [title="Transferencia que entra"]')).not.toBeNull();
  // la pareja va donde aparece su primera pata: antes del gasto
  const lis = [...el.querySelector('section ul').children];
  expect(lis.indexOf(pair)).toBe(0);
  // el pago sin su otra pata sigue suelto, con su aviso
  const pago = lis.find(li => li.textContent.includes('Pago tarjeta'));
  expect(pago.hasAttribute('data-transfer-pair')).toBe(false);
  expect(pago.textContent).toContain('Falta elegir la cuenta con que pagaste');
  expect(pago.textContent).toContain('Sale de Nómina');
  await act(async () => root.unmount());
});
