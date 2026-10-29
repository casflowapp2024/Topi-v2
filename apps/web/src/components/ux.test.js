// Pruebas de humo de las correcciones de UX: grupos de cuentas, saldo a favor, cuentas cerradas
// fuera del inicio, panel de filtros y confirmación de borrado.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import AccbyTypeDash from './dashboard/productsAccounts/AccbyTypeDash';
import AccountGroupSummary from './dashboard/productsAccounts/AccountGroupSummary';
import DashAccounts from './dashboard/general/DashAccounts';
import TransactionFilterSheet from './transactions/TransactionFilterSheet';
import CardReconcile from './dashboard/productsAccounts/CardReconcile';
import BudgetOverview from './dashboard/budgetCategories/BudgetOverview';
import BudDashCategorieList from './dashboard/budgetCategories/BudDashCategorieList';
import { SET_DASH_CATEGORY_ACTIVATED } from '../redux/actions/types';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
// react-router-dom 7 no se resuelve en el jest de CRA: basta con Link y useNavigate
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => () => {},
}), { virtual: true });
// react-day-picker trae date-fns en ESM (jest de CRA no lo transforma); el selector de rango no se prueba aquí
jest.mock('./ui/RangeDateSelector.tsx', () => ({ RangeDateSelector: () => null }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const acc = (id, name, typeId, extra = {}) => ({ id, name, type: { id: typeId, name: `t${typeId}` }, bank: { name: 'Banco' }, last_four_digits: '1234', currency: 'COP', ...extra });
const accounts = [
  acc(1, 'Nómina', 1), acc(2, 'Bolsillo', 1),
  acc(3, 'Visa', 4), acc(4, 'Fondo', 3),
  acc(5, 'Vieja', 1, { closed_at: '2026-01-01' }),
];
const nw = (id, balance) => ({ account_id: id, name: `a${id}`, balance: String(balance), base_value: String(balance), currency: 'COP', type_id: 1 });
const state = {
  CashFlow: {
    user_accounts: { items: accounts },
    user_categories: { items: [{ id: 10, name: 'mercado', emoji: '1f6d2' }] },
    trans_filters_activated: { categorie_ids: [], accounts_ids: [], iniDate: '', endDate: '', keyword: '', expence: '', sortby: 'date', automated: '', shouldVerify: '', checked: '', transfer: '', params: '' },
  },
  Reports: { account_activated: accounts[0] },
  Fx: { net_worth: { base_currency: 'COP', total: '1000', accounts: [nw(1, 900), nw(2, 100), nw(3, 50000), nw(4, 2000), nw(5, 70)] } },
};
const store = () => createStore((s = state) => s, applyMiddleware(thunk));

const render = (ui) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<Provider store={store()}>{ui}</Provider>));
  return { el, root };
};

test('Mis cuentas: grupos con conteo y lista del grupo elegido', () => {
  const onGroupChange = jest.fn();
  const { el, root } = render(<AccbyTypeDash group="deposit" onGroupChange={onGroupChange} onOpenDetail={() => {}} onOpenCreate={() => {}} />);
  const tabs = [...el.querySelectorAll('[role=tab]')].map(t => t.textContent.replace(/\s+/g, ' ').trim());
  expect(tabs).toEqual(['Efectivo 2', 'Tarjetas 1', 'Inversiones 1', 'Cerradas 1']);
  expect(el.textContent).toContain('Nómina');
  expect(el.textContent).not.toContain('Vieja');
  act(() => [...el.querySelectorAll('[role=tab]')][3].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onGroupChange).toHaveBeenCalledWith('closed');
  act(() => root.unmount());
});

test('Tarjeta con saldo positivo: pagado de más (cargos sin registrar)', () => {
  const { el, root } = render(<AccbyTypeDash group="credit" onGroupChange={() => {}} onOpenDetail={() => {}} onOpenCreate={() => {}} />);
  expect(el.textContent).toContain('Pagado de más');
  act(() => root.unmount());
  const s = render(<AccountGroupSummary group="credit" />);
  expect(s.el.textContent).toContain('Pagado de más');
  act(() => s.root.unmount());
});

test('Inicio: las cuentas cerradas no aparecen y se avisa del pagado de más', () => {
  const { el, root } = render(<DashAccounts />);
  expect(el.textContent).toMatch(/Visa: pagaste .*más de lo registrado/);
  expect(el.textContent).toContain('Nómina');
  expect(el.textContent).not.toContain('Vieja');
  act(() => root.unmount());
});

test('Panel de filtros: aplica tipo y categoría', () => {
  const onApply = jest.fn();
  const { root } = render(<TransactionFilterSheet open onClose={() => {}} onApply={onApply} />);
  const byText = (t) => [...document.body.querySelectorAll('button')].find(b => b.textContent.trim() === t);
  act(() => byText('Gastos').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  act(() => byText('Mercado').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  act(() => byText('Ver resultados').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ expenseFilter: true, selectedCategories: [10] }));
  act(() => root.unmount());
});

test('Ajustar saldo: propone registrar la diferencia como gasto en Intereses', () => {
  const st = { ...state, CashFlow: { ...state.CashFlow, user_categories: { items: [
    { id: 10, name: 'mercado', emoji: '1f6d2', income: false },
    { id: 11, name: 'Intereses', emoji: '1f4b8', income: false },
    { id: 12, name: 'Comisiones', emoji: '1f9fe', income: false },
    { id: 13, name: 'salario', income: true },
  ] } } };
  const el = document.createElement('div'); document.body.appendChild(el); const root = createRoot(el);
  act(() => root.render(<Provider store={createStore((s = st) => s, applyMiddleware(thunk))}>
    <CardReconcile account={accounts[2]} balance={50000} card={{ last_statement: '2026-10-15' }} onDone={() => {}} onCancel={() => {}} />
  </Provider>));
  expect(el.textContent).toMatch(/Faltan .*50\.000/);
  const pressed = [...el.querySelectorAll('button[aria-pressed=true]')].map(b => b.textContent.trim());
  expect(pressed).toContain('Intereses');
  expect(el.textContent).toContain('Último corte');
  expect(el.textContent).not.toContain('Salario');
  act(() => root.unmount());
});

const budgetState = (category = null) => ({
  ...state,
  UI: { active_report_tab: 'Expenses' },
  Reports: {
    ...state.Reports, current_Year: 2026, current_Month: 10, category_activated: category,
    expenses_report: [
      { category_id: 7, name: 'mercado', emoji: '1f6d2', value: -640000, budget: 700000, usage: 91 },
      { category_id: 8, name: 'salidas', emoji: '1f389', value: -1300000, budget: 1000000, usage: 130 },
    ],
    income_report: [],
    expenses_report_full: { value: -1940000, budget: -1700000, left: -240000 },
    income_report_full: { value: 4000000, budget: 4000000, left: 0 },
  },
});

test('Presupuestos: cabecera con Gastos/Ingresos y total del mes', () => {
  const el = document.createElement('div'); document.body.appendChild(el); const root = createRoot(el);
  act(() => root.render(<Provider store={createStore((s = budgetState()) => s, applyMiddleware(thunk))}><BudgetOverview /></Provider>));
  expect([...el.querySelectorAll('[role=tab]')].map(t => t.textContent)).toEqual(['Gastos', 'Ingresos']);
  expect(el.textContent).toContain('Gastado este mes');
  expect(el.textContent).toMatch(/Te pasaste por/);
  expect(el.textContent).toMatch(/ahorro esperado/);
  act(() => root.unmount());
});

test('Presupuestos: ninguna categoría elegida al entrar; tocar elige y tocar otra vez quita', () => {
  const reducer = (s = budgetState(), a) => (a.type === SET_DASH_CATEGORY_ACTIVATED ? { ...s, Reports: { ...s.Reports, category_activated: a.payload } } : s);
  const store = createStore(reducer, applyMiddleware(thunk));
  const el = document.createElement('div'); document.body.appendChild(el); const root = createRoot(el);
  act(() => root.render(<Provider store={store}><BudDashCategorieList handleOpenEditCat={() => {}} setOpenCreateBox={() => {}} /></Provider>));
  const rows = () => [...el.querySelectorAll('[role=button][aria-pressed]')];
  expect(rows().filter(r => r.getAttribute('aria-pressed') === 'true')).toHaveLength(0);
  act(() => rows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(store.getState().Reports.category_activated?.category_id).toBe(8); // ordenada por monto: salidas primero
  act(() => rows()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(store.getState().Reports.category_activated).toBeNull();
  act(() => root.unmount());
});
