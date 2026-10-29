// Prueba de humo de las gráficas: con datos con la forma del API, cada pestaña renderiza sin
// errores, con y sin presupuesto, en el mes en curso y en uno pasado.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import MultiChartDash from '../dashboard/general/MultiChartDash';
import BudDashDailySpent from '../dashboard/budgetCategories/BudDashDailySpent';
import AccChartHistory from '../dashboard/productsAccounts/AccChartHistory';

// axios viene en ESM y CRA no lo transforma en jest; las gráficas no lo usan.
jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});

// En jsdom ResponsiveContainer mide 0 y no dibuja: se reemplaza por un tamaño fijo.
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

const makeStore = (budget, month = M) => createStore(() => ({
  Reports: {
    history_dash: historyDash(budget),
    history_category: { budget: -500000, monthly: { expense: months.map(() => metric(-600000)), year: months.map(x => x.y), month: months.map(x => x.m) } },
    category_activated: { name: 'mercado' },
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
  test('inicio: las 4 pestañas y el diario del balance', () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { el, root } = render(<MultiChartDash />, makeStore(budget, month));
    for (const tab of ['Flujo', 'Gastos', 'Ritmo', 'Balance']) {
      click(el, tab);
      expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
    }
    click(el, 'Diario');
    expect(el.querySelector('.recharts-area')).not.toBeNull();
    act(() => root.unmount());
    expect(errors.mock.calls.filter(c => !String(c[0]).includes('act('))).toEqual([]);
    errors.mockRestore();
  });

  test('presupuestos: total, ritmo y categoría', () => {
    let tab = 1;
    const store = makeStore(budget, month);
    const { el, root } = render(<BudDashDailySpent activeChartTab={tab} setActiveChartTab={(t) => { tab = t; }} />, store);
    expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
    click(el, 'Ritmo del mes');
    expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
    act(() => root.render(<Provider store={store}><BudDashDailySpent activeChartTab={2} setActiveChartTab={() => {}} /></Provider>));
    expect(el.textContent).toContain('Mercado');
    act(() => root.unmount());
  });
});

test('cuentas: historial de una tarjeta en USD', () => {
  const { el, root } = render(<AccChartHistory />, makeStore(3000000));
  expect(el.textContent).toMatch(/deuda/i);
  act(() => root.unmount());
});
