// Cuentas › Todo: el patrimonio y su historia al cierre de cada mes.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import AAAcountsDashboard from './AAAcountsDashboard';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => () => {},
}), { virtual: true });
jest.mock('../../ui/RangeDateSelector.tsx', () => ({ RangeDateSelector: () => null }));
jest.mock('../../ui/DatePicker.tsx', () => ({ DatePicker: () => null }));
jest.mock('../../ui/SingleDateSelector.tsx', () => ({ SingleDateSelector: () => null }));
jest.mock('recharts', () => {
  const actual = jest.requireActual('recharts');
  const React = jest.requireActual('react');
  return { ...actual, ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 500, height: 240 }) };
});
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const point = (date, total) => ({
  date, total: String(total), cash_total: String(total), investments_total: '1000000', credit_total: '0',
  investments_cost: '900000', missing_rates: false,
});

test('En Todo va la gráfica del patrimonio por mes, sin lo aportado a inversiones', async () => {
  const state = {
    Reports: { current_Year: 2026, current_Month: 11, account_activated: null },
    CashFlow: { user_accounts: { items: [] }, banks: { items: [], default: [] }, account_types: [], user_categories: { items: [], default: [] } },
    Conexions: { automated_emails: { emails: [] } },
    Fx: {
      net_worth: { base_currency: 'COP', total: '7500000', cash_total: '6500000', investments_total: '1000000', credit_total: '0', accounts: [] },
      net_worth_history: { base_currency: 'COP', points: [point('2026-09-30', 6000000), point('2026-10-31', 7000000), point('2026-11-07', 7500000)] },
    },
    UI: {}, Alert: { alert: null },
  };
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Provider store={createStore((s = state) => s, applyMiddleware(thunk))}><AAAcountsDashboard /></Provider>); });
  const section = el.querySelector('section[aria-label="Patrimonio por mes"]');
  expect(section).not.toBeNull();
  expect(section.querySelector('svg.recharts-surface')).not.toBeNull();
  expect(section.textContent).toMatch(/Subió desde sep/);
  expect(el.textContent).not.toMatch(/[Aa]portado/);
  await act(async () => root.unmount());
});
