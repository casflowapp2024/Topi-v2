// Pruebas del Inicio: tarjetas Ritmo, Flujo y Patrimonio.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import HomePaceCard from './HomePaceCard';
import HomeFlowCard, { flowBarSegments } from './HomeFlowCard';
import HomeNetWorthCard, { netWorthSegments } from './HomeNetWorthCard';
import { getDailyAllowance } from '../../ui/BudgetProgress';
import { formatMoney } from '../../helpers';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => mockNavigate,
}), { virtual: true });
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  const React = jest.requireActual('react');
  return { ...actual, ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 500, height: 140 }) };
});
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth() + 1;
const key = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const daily = (y, m, spent, lastDay) => ({
  date: Array.from({ length: lastDay }, (_, i) => key(y, m, i + 1)),
  mtd_expense: Array.from({ length: lastDay }, (_, i) => -(spent * (i + 1)) / lastDay),
});
const prev = new Date(Y, M - 2, 1);
const monthly = {
  year: [prev.getFullYear(), Y], month: [prev.getMonth() + 1, M],
  income: [{ value: 0 }, { value: 0 }],
  expense: [{ value: -900000 }, { value: -600000 }],
  savings: [{ value: 100000, percentage: 0 }, { value: 1400000, percentage: 40 }],
};
const history = (budget, spent = 600000) => ({ expense_budget: budget, daily: daily(Y, M, spent, now.getDate()), monthly });

const render = (ui, state) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  const store = createStore((s = state) => s, applyMiddleware(thunk));
  act(() => root.render(<Provider store={store}>{ui}</Provider>));
  return { el, root, store };
};
const reports = (extra) => ({ Reports: { current_Year: Y, current_Month: M, ...extra } });

test('Hoy puedes gastar: lo que queda del presupuesto entre los días restantes, hoy incluido', () => {
  const day = new Date(2026, 9, 30); // 30 de octubre: quedan 2 días
  expect(getDailyAllowance(1000000, 400000, 2026, 10, day)).toEqual({ left: 600000, daysLeft: 2, perDay: 300000 });
  expect(getDailyAllowance(1000000, 1500000, 2026, 10, day).perDay).toBe(0); // pasado de presupuesto
  expect(getDailyAllowance(1000000, 0, 2026, 10, new Date(2026, 9, 31)).daysLeft).toBe(1); // último día
  expect(getDailyAllowance(1000000, 400000, 2026, 9, day)).toBeNull(); // mes pasado
});

test('Ritmo: mes en curso con presupuesto', () => {
  const budget = 3000000;
  const expected = getDailyAllowance(budget, 600000, Y, M);
  const { el, root } = render(<HomePaceCard />, reports({ history_dash: history(budget) }));
  expect(el.textContent).toContain('Hoy puedes gastar');
  expect(el.textContent).toContain(formatMoney(expected.perDay));
  expect(el.textContent).toContain(`Quedan ${formatMoney(expected.left)} para ${expected.daysLeft}`);
  expect(el.querySelector('svg.recharts-surface')).not.toBeNull();
  act(() => root.unmount());
});

test('Ritmo: lo movido a inversiones usa el presupuesto aunque no sea gasto', () => {
  const dash = history(1000000, 100000);
  dash.daily.mtd_budget = dash.daily.mtd_expense.map(v => v - 500000);
  const expected = getDailyAllowance(1000000, 600000, Y, M);
  const { el, root } = render(<HomePaceCard />, reports({ history_dash: dash }));
  expect(el.textContent).toContain(`Quedan ${formatMoney(expected.left)}`);
  act(() => root.unmount());
});

test('Ritmo: un mes futuro muestra lo comprometido en cuotas', () => {
  const next = new Date(Y, M, 1);
  const { el, root } = render(<HomePaceCard />, {
    Reports: { current_Year: next.getFullYear(), current_Month: next.getMonth() + 1, history_dash: { expense_budget: 1000000 }, expenses_report_full: { value: -200000 } },
  });
  expect(el.textContent).toContain('Comprometido en cuotas');
  expect(el.textContent).toContain(formatMoney(200000));
  expect(el.textContent).toContain('Este mes aún no empieza');
  act(() => root.unmount());
});

test('Ritmo: mes pasado sin "hoy puedes"', () => {
  const y = prev.getFullYear();
  const m = prev.getMonth() + 1;
  const { el, root } = render(<HomePaceCard />, { Reports: { current_Year: y, current_Month: m, history_dash: { expense_budget: 500000, daily: daily(y, m, 900000, 28), monthly } } });
  expect(el.textContent).not.toContain('Hoy puedes gastar');
  expect(el.textContent).toContain(`Gastaste${formatMoney(900000)}`);
  expect(el.textContent).toContain(`de ${formatMoney(500000)}`);
  expect(el.textContent).toContain('Te pasaste');
  act(() => root.unmount());
});

test('Ritmo: sin presupuestos invita a crearlos y compara con el mes anterior', () => {
  const { el, root } = render(<HomePaceCard />, reports({ history_dash: history(0) }));
  expect(el.textContent).toContain('Gastado este mes');
  expect(el.textContent).toContain(formatMoney(600000));
  expect(el.textContent).toContain(`el mes anterior, ${formatMoney(900000)}`);
  expect(el.querySelector('a[href="budgets"]').textContent).toBe('Crear presupuesto');
  act(() => root.unmount());
});

test('Flujo: cifras con su cambio y el ahorro del mes, no el saldo acumulado', () => {
  const { el, root } = render(<HomeFlowCard />, reports({
    income: { value: 2000000, vs_past_month: 10 }, expenses: { value: -600000, vs_past_month: -33.3 },
    savings_balance: { value: 99000000 }, history_dash: history(0),
  }));
  expect(el.textContent).toContain(formatMoney(2000000));
  expect(el.textContent).toContain(formatMoney(1400000));
  expect(el.textContent).not.toContain(formatMoney(99000000));
  expect(el.textContent).toContain('10% más');
  expect(el.textContent).toContain('33% menos');
  expect(el.textContent).not.toContain('Déficit');
  act(() => root.unmount());
});

test('Flujo: la barra marca el déficit con palabra cuando se gasta más de lo que entra', () => {
  expect(flowBarSegments(1000, 400)).toEqual({ spent: 40, saved: 60, deficit: 0 });
  expect(flowBarSegments(1000, 2000)).toEqual({ spent: 50, saved: 0, deficit: 50 });
  expect(flowBarSegments(0, 0)).toEqual({ spent: 0, saved: 0, deficit: 0 });
  const { el, root } = render(<HomeFlowCard />, reports({
    income: { value: 1000000, vs_past_month: null }, expenses: { value: -1500000, vs_past_month: null }, history_dash: history(0),
  }));
  expect(el.textContent).toContain(`Déficit de ${formatMoney(500000)}`);
  act(() => root.unmount());
});

test('Patrimonio: los tramos suman el total y el toque abre Cuentas en "Todo"', () => {
  const net_worth = {
    base_currency: 'COP', total: '7500000', cash_total: '5000000', investments_total: '3000000', credit_total: '-500000',
    accounts: [{ type_id: 1, base_value: '5000000' }, { type_id: 4, base_value: '-600000' }, { type_id: 4, base_value: '100000' }],
  };
  const segments = netWorthSegments(net_worth);
  expect(segments.map(s => [s.label, s.value])).toEqual([
    ['Efectivo', 5000000], ['Inversiones', 3000000], ['A favor en tarjetas', 100000], ['Deudas de tarjeta', -600000],
  ]);
  expect(segments.reduce((sum, s) => sum + s.value, 0)).toBe(Number(net_worth.total));
  const { el, root } = render(<HomeNetWorthCard />, { Fx: { net_worth } });
  expect(el.textContent).toContain(formatMoney(7500000));
  expect(el.textContent).toContain('Deudas de tarjeta');
  expect(el.textContent).not.toMatch(/mes anterior/);
  act(() => el.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/accounts');
  act(() => root.unmount());
});
