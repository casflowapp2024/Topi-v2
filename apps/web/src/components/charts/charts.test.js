// Prueba de humo de las gráficas: con datos con la forma del API, cada pestaña renderiza sin
// errores, con y sin presupuesto, en el mes en curso y en uno pasado.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import MultiChartDash from '../dashboard/general/MultiChartDash';
import BudDashDailySpent from '../dashboard/budgetCategories/BudDashDailySpent';
import AccChartHistory from '../dashboard/productsAccounts/AccChartHistory';
import NetWorthChart, { netWorthRows } from './NetWorthChart';

// axios viene en ESM y CRA no lo transforma en jest; las gráficas no lo usan.
jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});

// En jsdom ResponsiveContainer mide 0 y no dibuja: se reemplaza por un tamaño fijo. (Con algunos anchos
// el cálculo de ticks de recharts no termina en jsdom, que mide todo el texto en 0; con 500 es estable.)
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  const React = jest.requireActual('react');
  return {
    ...actual,
    ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 500, height: 240 }),
  };
});

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth() + 1;
const metric = (value) => ({ value, diff: value / 10, percentage: 5, usage: 80, left: 0 });
const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(Y, M - 12 + i, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
});
const days = Array.from({ length: now.getDate() }, (_, i) => `${Y}-${String(M).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);

const historyDash = (budget) => ({
  income_budget: 10000000, expense_budget: budget, savings_budget: 1000000,
  daily: {
    income: days.map(() => 0), expense: days.map(() => -100000),
    mtd_income: days.map(() => 0), mtd_expense: days.map((_, i) => -(i + 1) * 120000),
    mtd_savings: days.map(() => 0), running_savings_balance: days.map((_, i) => 5000000 - i * 1000),
    running_credits_balance: days.map(() => -200000), date: days,
  },
  monthly: {
    income: months.map(() => metric(8000000)), expense: months.map((_, i) => metric(-(2000000 + i * 300000))),
    savings: months.map((_, i) => metric(i % 3 ? 500000 : -35800000)),
    running_savings_balance: months.map((_, i) => metric(100000000 + i * 1e6)),
    running_credits_balance: months.map(() => metric(-1e6)),
    year: months.map(x => x.y), month: months.map(x => x.m),
  },
});

const nwPoint = (date, total, extra = {}) => ({
  date, total: String(total), cash_total: String(total), investments_total: '0', credit_total: '0', investments_cost: '0', missing_rates: false, ...extra,
});
const netWorthHistory = { base_currency: 'COP', points: [
  nwPoint('2026-09-30', 6000000), nwPoint('2026-10-31', 7000000, { investments_total: '1000000', investments_cost: '900000' }),
  nwPoint('2026-11-07', 6500000, { credit_total: '-500000' }),
] };

const makeStore = (budget, month = M) => createStore(() => ({
  UI: { active_report_tab: 'Expenses' },
  Fx: { net_worth_history: netWorthHistory, net_worth: { total: '6500000' } },
  Reports: {
    history_dash: historyDash(budget),
    history_category: { budget: -500000, monthly: { expense: months.map(() => metric(-600000)), year: months.map(x => x.y), month: months.map(x => x.m) } },
    category_activated: { category_id: 7, name: 'mercado' },
    expenses_report: [{ category_id: 7, name: 'mercado' }], income_report: [],
    current_Year: Y, current_Month: month,
    account_activated: { id: 1, currency: 'USD', type: { id: 4 } },
    history_accounts_by_month: { monthly: { balance: months.map(() => metric(-1200)), year: months.map(x => x.y), month: months.map(x => x.m) } },
  },
}));

const render = (ui, store) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(<Provider store={store}>{ui}</Provider>));
  return { el, root };
};
const click = (el, text) => {
  const btn = [...el.querySelectorAll('button')].find(b => b.textContent.trim() === text);
  if (!btn) throw new Error(`No hay botón "${text}"`);
  act(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};

describe.each([[3000000, M], [0, M], [3000000, M === 1 ? 12 : M - 1]])('presupuesto %s, mes %s', (budget, month) => {
  test('inicio: las 3 pestañas', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { el, root } = render(<MultiChartDash />, makeStore(budget, month));
    for (const tab of ['Flujo', 'Gastos', 'Balance']) {
      click(el, tab);
      expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
    }
    act(() => root.unmount());
    expect(errors.mock.calls.filter(c => !String(c[0]).includes('act('))).toEqual([]);
    errors.mockRestore();
  });

  test('presupuestos: categoría dentro del total y proyección', () => {
    const store = makeStore(budget, month);
    const { el, root } = render(<BudDashDailySpent />, store);
    expect(el.textContent).toContain('Mercado');
    expect(el.textContent).toMatch(/del total/);
    click(el, 'Proyección');
    expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
    click(el, 'Por mes');
    expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
    act(() => root.unmount());
  });
});

test('cuentas: historial de una tarjeta en USD', () => {
  const { el, root } = render(<AccChartHistory />, makeStore(3000000));
  expect(el.textContent).toMatch(/deuda/i);
  act(() => root.unmount());
});

test('patrimonio: un punto por cierre de mes, el último es hoy y el cambio solo con tasas', () => {
  const rows = netWorthRows(netWorthHistory);
  expect(rows.map(r => r.label)).toEqual(['sep', 'oct', 'hoy']);
  expect(rows.map(r => r.diff)).toEqual([null, 1000000, -500000]);
  expect(rows.map(r => r.longLabel)).toEqual(['septiembre 2026', 'octubre 2026', 'noviembre 2026 · hoy']);
  const missing = netWorthRows({ points: [nwPoint('2026-10-31', 1, { missing_rates: true }), nwPoint('2026-11-07', 2)] });
  expect(missing[1].diff).toBeNull();

  const { el, root } = render(<NetWorthChart />, makeStore(0));
  expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
  expect(el.textContent).toMatch(/Subió desde sep/);
  act(() => root.unmount());

  const single = createStore(() => ({ Fx: { net_worth_history: { points: [nwPoint('2026-11-07', 2)] } } }));
  const one = render(<NetWorthChart />, single);
  expect(one.el.textContent).toContain('empieza este mes');
  act(() => one.root.unmount());
});

test('patrimonio por mes: no está en las gráficas del inicio', () => {
  const home = render(<MultiChartDash />, makeStore(0));
  expect([...home.el.querySelectorAll('[role=tab]')].map(t => t.textContent)).toEqual(['Balance', 'Flujo', 'Gastos']);
  act(() => home.root.unmount());
});
