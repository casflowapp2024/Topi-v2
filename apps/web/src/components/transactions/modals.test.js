// Modales de transacciones: crear (Modal), detalle (Sheet), transferir y posibles transferencias.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import CreateTransaction from './CreateTransaction';
import TransactionDetail from './TransactionDetail2';
import TransferModal from './TransferModal';
import TransferCandidatesModal from './TransferCandidatesModal';
import { topCategories } from './FormEditCreateTrans';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => () => {},
}), { virtual: true });
jest.mock('../ui/RangeDateSelector.tsx', () => ({ RangeDateSelector: () => null }));
jest.mock('../ui/DatePicker.tsx', () => ({ DatePicker: () => null }));
jest.mock('../ui/SingleDateSelector.tsx', () => ({ SingleDateSelector: () => <button type="button">fecha</button> }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const cat = (id, name, income = false) => ({ id, name, emoji: '1f6d2', income, budget: 0 });
const categories = [
  cat(1, 'mercado'), cat(2, 'salidas'), cat(3, 'transporte'), cat(4, 'hogar'), cat(5, 'salud'),
  cat(6, 'mascotas'), cat(7, 'regalos'), cat(8, 'salario', true),
];
const accounts = [
  { id: 1, name: 'Nómina', last_four_digits: '1111', currency: 'COP', type: { id: 1, class: 'deposit' } },
  { id: 2, name: 'Bolsillo', last_four_digits: '2222', currency: 'COP', type: { id: 1, class: 'deposit' } },
];
const tx = (id, catId, extra = {}) => ({
  id, description: `Mov ${id}`, amount: 1000, expense: true, currency: 'COP', amount_base: '1000',
  date: '2026-11-04 12:00:00 -0500', category: categories.find(c => c.id === catId), account: accounts[0], ...extra,
});
// "regalos" (7) es la más usada: debe salir entre los chips aunque esté de séptima en la lista
const recent = [tx(1, 7), tx(2, 7), tx(3, 7), tx(4, 2), tx(5, 8, { expense: false })];

const state = {
  CashFlow: {
    user_categories: { items: categories, default: [] },
    user_accounts: { items: accounts },
    user_transactions: { items: recent, total: recent.length, default_limit: 30 },
    trans_filters_activated: { params: '' },
    first_steps: { bank: true },
  },
  Reports: { current_Month: 11, current_Year: 2026 },
  Alert: { alert: null },
};

const mount = async (ui) => {
  const store = createStore((s = state) => s, applyMiddleware(thunk));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Provider store={store}>{ui}</Provider>));
  return { el, unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
};
const dialog = () => document.querySelector('[role=dialog]');
const click = async (node) => act(async () => node.click());
const noHexOrIndigo = (node) => expect(node.outerHTML).not.toMatch(/#5266EB|#151C2C|indigo-/i);

test('topCategories: las más usadas del tipo, completa con el orden de la lista y siempre incluye la elegida', () => {
  const top = topCategories(categories, recent, true, 1);
  expect(top.map(c => c.id)).toEqual([7, 2, 1, 3, 4, 5]);
  // la elegida fuera del top entra primera
  expect(topCategories(categories, recent, true, 6).map(c => c.id)).toEqual([6, 7, 2, 1, 3, 4]);
  // ingresos: solo categorías de ingreso
  expect(topCategories(categories, recent, false, 8).map(c => c.id)).toEqual([8]);
  // las transferencias no cuentan como uso
  expect(topCategories(categories, [tx(9, 5, { transfer_group_id: 'g' })], true, null).map(c => c.id)[0]).toBe(1);
});

test('Crear transacción: Modal con monto grande primero, chips de categorías y Otra…', async () => {
  const onClose = jest.fn();
  const m = await mount(<CreateTransaction openCreatePopUp SetOpenCreatePopUp={onClose} currentFrontendPage={1} />);
  const d = dialog();
  expect(d).not.toBeNull();
  expect(d.textContent).toContain('Nuevo movimiento');
  noHexOrIndigo(d);
  // el primer control del formulario es el tipo y luego el monto, grande
  const amount = d.querySelector('input[aria-label^="Monto"]');
  expect(amount.className).toContain('text-3xl');
  const fields = [...d.querySelectorAll('form input, form select, form [role=radio], form fieldset')];
  expect(fields[0].getAttribute('role')).toBe('radio');
  expect(fields.indexOf(amount)).toBeLessThan(fields.indexOf(d.querySelector('fieldset')));
  // 6 chips + Otra…; la más usada (regalos) aparece
  const chips = [...d.querySelectorAll('fieldset button')].map(b => b.textContent.trim());
  expect(chips).toHaveLength(7);
  expect(chips).toContain('Regalos');
  expect(chips[chips.length - 1]).toBe('Otra…');
  // Esc cierra
  await act(async () => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(onClose).toHaveBeenCalledWith(false);
  // acciones: Cancelar (secundaria) y Crear (primaria, envía el formulario)
  const actions = [...d.querySelectorAll('footer button')];
  expect(actions.map(b => b.textContent)).toEqual(['Cancelar', 'Crear']);
  expect(actions[1].getAttribute('form')).toBe('create-transaction-form');
  await m.unmount();
});

test('Crear transacción: Gasto/Ingreso cambia el tipo y los chips; elegir un chip lo marca', async () => {
  const m = await mount(<CreateTransaction openCreatePopUp SetOpenCreatePopUp={() => {}} currentFrontendPage={1} />);
  const d = dialog();
  const [gasto, ingreso] = [...d.querySelectorAll('[role=radio]')];
  expect(gasto.getAttribute('aria-checked')).toBe('true');
  await click(ingreso);
  expect(ingreso.getAttribute('aria-checked')).toBe('true');
  expect([...d.querySelectorAll('fieldset button')].map(b => b.textContent.trim())).toContain('Salario');
  // volver a Gasto funciona al primer toque
  await click(gasto);
  expect(gasto.getAttribute('aria-checked')).toBe('true');
  const salidas = [...d.querySelectorAll('fieldset button')].find(b => b.textContent.includes('Salidas'));
  await click(salidas);
  expect(salidas.getAttribute('aria-pressed')).toBe('true');
  // Otra… abre el buscador de categorías
  await click([...d.querySelectorAll('fieldset button')].find(b => b.textContent.includes('Otra')));
  expect(d.querySelector('fieldset [aria-expanded="true"]')).not.toBeNull();
  await m.unmount();
});

test('Detalle de transacción: hoja lateral con título y acciones por estado', async () => {
  const detail = { ...tx(1, 1), automated: false };
  const m = await mount(<TransactionDetail openTransDetail setOpenTransDetail={() => {}} detailInfo={detail} setDetailInfo={() => {}} currentFrontendPage={1} />);
  let d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Transacción');
  noHexOrIndigo(d);
  // es la hoja (Sheet): panel lateral desde sm
  expect(d.querySelector('[class*="sm:rounded-l-3xl"]')).not.toBeNull();
  const footer = () => [...d.querySelectorAll('footer button')].map(b => b.textContent.trim());
  expect(footer()).toEqual(['Eliminar', 'Editar']);
  await click([...d.querySelectorAll('footer button')][0]);
  expect(d.querySelector('h2').textContent).toBe('¿Eliminar esta transacción?');
  expect(footer()).toEqual(['Cancelar', 'Sí, eliminar']);
  await click([...d.querySelectorAll('footer button')][0]);
  expect(footer()).toEqual(['Eliminar', 'Editar']);
  await m.unmount();
});

test('Transferir y posibles transferencias: Modal con campos comunes y confianza con ícono + palabra', async () => {
  const t = await mount(<TransferModal open onClose={() => {}} />);
  let d = dialog();
  expect(d.textContent).toContain('Transferir entre cuentas');
  noHexOrIndigo(d);
  expect(d.querySelector('label[for="transferFrom"]').textContent).toBe('Desde');
  expect(d.querySelector('#transferFrom').className).toContain('rounded-xl');
  expect([...d.querySelectorAll('footer button')].map(b => b.textContent)).toEqual(['Cancelar', 'Transferir']);
  await t.unmount();

  const candidates = [{
    out_transaction_id: 1, in_transaction_id: 2, out_amount: 1000, in_amount: 1000, out_currency: 'COP', in_currency: 'COP',
    out_account_id: 1, in_account_id: 2, out_date: '2026-11-01', in_date: '2026-11-01', out_description: 'Sale', in_description: 'Entra', confidence: 'high',
  }];
  const c = await mount(<TransferCandidatesModal open onClose={() => {}} candidates={candidates} setCandidates={() => {}} />);
  d = dialog();
  expect(d.textContent).toContain('Posibles transferencias');
  noHexOrIndigo(d);
  const badge = [...d.querySelectorAll('span')].find(s => s.textContent === 'Muy probable');
  expect(badge.querySelector('svg')).not.toBeNull();
  await c.unmount();
});

describe('Cambio rápido desde el detalle', () => {
  const axios = require('axios').default;
  const recommended = { id: -6, name: 'Supermercado', emoji: '1f6d2', isDefault: true, userCat: false, income: false };
  const withRecommended = { ...state, CashFlow: { ...state.CashFlow, user_categories: { items: [...categories, recommended], default: [recommended] } } };
  const mountWith = async (st, ui) => {
    const store = createStore((s = st) => s, applyMiddleware(thunk));
    const el = document.createElement('div'); document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(<Provider store={store}>{ui}</Provider>));
    return { unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
  };
  const putBody = () => JSON.parse(axios.put.mock.calls[axios.put.mock.calls.length - 1][1]);
  beforeEach(() => {
    axios.put.mockReset();
    axios.put.mockResolvedValue({ status: 200, data: { data: {} } });
    axios.get.mockClear();
  });

  test('tocar la categoría abre la lista y elegir otra guarda sin pasar por Editar', async () => {
    const setDetail = jest.fn();
    const m = await mountWith(state, <TransactionDetail openTransDetail setOpenTransDetail={() => {}} detailInfo={tx(1, 1)} setDetailInfo={setDetail} currentFrontendPage={1} />);
    const d = dialog();
    await click(d.querySelector('button[aria-label="Categoría: cambiar"]'));
    expect(d.querySelector('h2').textContent).toBe('Cambiar categoría');
    expect(d.querySelector('input[type=search]')).not.toBeNull();
    // las de gasto primero (salario es de ingreso: va al final)
    const names = [...d.querySelectorAll('ul[aria-label="Tus categorías"] button')].map(b => b.textContent.trim());
    expect(names[names.length - 1]).toBe('Salario');
    await click([...d.querySelectorAll('ul[aria-label="Tus categorías"] button')].find(b => b.textContent.includes('Salud')));
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(putBody()).toMatchObject({ category_id: 5, account_id: 1, amount: 1000, description: 'Mov 1' });
    expect(putBody()).not.toHaveProperty('installments'); // cambiar la categoría no toca las cuotas
    expect(setDetail).toHaveBeenCalledWith(expect.objectContaining({ category: expect.objectContaining({ id: 5, name: 'salud' }) }));
    expect(d.querySelector('h2').textContent).toBe('Transacción');
    await m.unmount();
  });

  test('cambiar la cuenta guarda y en Presupuestos sin categoría elegida recarga la lista del mes', async () => {
    const st = { ...state, Reports: { ...state.Reports, category_activated: null }, UI: { active_report_tab: 'Expenses' } };
    const m = await mountWith(st, <TransactionDetail openTransDetail setOpenTransDetail={() => {}} detailInfo={tx(1, 1)} setDetailInfo={() => {}} currentFrontendPage={1} contextWindow="dashCategories" />);
    const d = dialog();
    await click(d.querySelector('button[aria-label="Cuenta: cambiar"]'));
    expect(d.querySelector('h2').textContent).toBe('Cambiar cuenta');
    await click([...d.querySelectorAll('ul[aria-label="Cuentas"] button')].find(b => b.textContent.includes('Bolsillo')));
    expect(putBody()).toMatchObject({ category_id: 1, account_id: 2, installments: 0 });
    const urls = axios.get.mock.calls.map(([url]) => url);
    expect(urls.some(u => u.includes('/transactions') && u.includes('expense=true') && !u.includes('categories='))).toBe(true);
    await m.unmount();
  });

  test('una categoría Recomendada se crea primero y la transacción usa su id', async () => {
    axios.post.mockReset();
    axios.post.mockResolvedValue({ status: 201, data: { data: { id: 42 } } });
    const m = await mountWith(withRecommended, <TransactionDetail openTransDetail setOpenTransDetail={() => {}} detailInfo={tx(1, 1)} setDetailInfo={() => {}} currentFrontendPage={1} />);
    const d = dialog();
    await click(d.querySelector('button[aria-label="Categoría: cambiar"]'));
    await click([...d.querySelectorAll('section[aria-label="Recomendadas"] button')].find(b => b.textContent.includes('Supermercado')));
    expect(axios.post.mock.calls[0][0]).toContain('/categories/create');
    expect(putBody().category_id).toBe(42);
    await m.unmount();
  });
});
