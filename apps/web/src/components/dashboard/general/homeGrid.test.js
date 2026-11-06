// Grilla del Inicio en PC (12 columnas) y orden en móvil. Las tarjetas se reemplazan por marcadores:
// aquí solo importa dónde va cada una.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import AAGenDashboard from './AAGenDashboard';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => () => {},
}), { virtual: true });
jest.mock('./HomePaceCard', () => () => <div data-card="ritmo" />);
jest.mock('./HomeFlowCard', () => () => <div data-card="flujo" />);
jest.mock('./HomeNetWorthCard', () => () => <div data-card="patrimonio" />);
jest.mock('./MultiChartDash', () => () => <div data-card="graficas" />);
jest.mock('./ReviewInbox', () => () => <div data-card="por-revisar" />);
jest.mock('./DashPlan', () => () => <div data-card="presupuestos" />);
jest.mock('./DashAccounts', () => () => <div data-card="cuentas" />);
global.IS_REACT_ACT_ENVIRONMENT = true;

const mount = async () => {
  const store = createStore((s = { Reports: { current_Month: 11, current_Year: 2026 } }) => s, applyMiddleware(thunk));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Provider store={store}><AAGenDashboard /></Provider>));
  return { el, unmount: () => act(() => root.unmount()) };
};
// la celda de la grilla es el ancestro más cercano con col-span
const cell = (el, name) => el.querySelector(`[data-card="${name}"]`).closest('[class*="lg:col-span-"]');
const span = (node) => node.className.match(/lg:col-span-(\d+)/)[1];

test('Inicio en PC: Ritmo · Flujo · Patrimonio arriba (4/4/4), gráficas (8) con lateral (4) y Cuentas a lo ancho', async () => {
  const { el, unmount } = await mount();
  const grid = el.querySelector('.lg\\:grid-cols-12');
  expect(grid).not.toBeNull();
  expect(['ritmo', 'flujo', 'patrimonio'].map(n => span(cell(el, n)))).toEqual(['4', '4', '4']);
  expect(span(cell(el, 'graficas'))).toBe('8');
  // Por revisar y Presupuestos comparten la columna lateral
  const side = cell(el, 'por-revisar');
  expect(side).toBe(cell(el, 'presupuestos'));
  expect(span(side)).toBe('4');
  expect(span(cell(el, 'cuentas'))).toBe('12');
  // en el DOM (y así en la grilla) el orden es fila 1, luego gráficas y lateral, luego cuentas
  const order = [...el.querySelectorAll('[data-card]')].map(n => n.dataset.card);
  expect(order).toEqual(['ritmo', 'flujo', 'patrimonio', 'graficas', 'por-revisar', 'presupuestos', 'cuentas']);
  // sin anchos fijos en px en la grilla
  expect(grid.outerHTML).not.toMatch(/w-\[\d+px\]|_\d+px\]/);
  unmount();
});

test('Inicio en móvil: el orden de la pila no cambia (Por revisar después de Flujo)', async () => {
  const { el, unmount } = await mount();
  const orderOf = (n) => Number(el.querySelector(`[data-card="${n}"]`).closest('[class*="order-"]').className.match(/(?:^|\s)order-(\d+)/)[1]);
  const stack = ['ritmo', 'flujo', 'por-revisar', 'patrimonio', 'graficas', 'presupuestos', 'cuentas'];
  expect(stack.map(orderOf)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  unmount();
});
