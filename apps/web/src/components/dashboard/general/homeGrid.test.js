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
test('Inicio en PC: Ritmo (1,5× Flujo) · Flujo · Por revisar arriba; Patrimonio sobre las gráficas y Presupuestos al lado', async () => {
  const { el, unmount } = await mount();
  const grid = el.querySelector('[class~="lg:grid"]');
  expect(grid).not.toBeNull();
  // proporciones en fr (sin anchos fijos): Ritmo 6 : Flujo 4 en lg y en xl
  expect(grid.className).toContain('lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)_minmax(0,6fr)]');
  expect(grid.className).toContain('xl:grid-cols-[minmax(0,6fr)_minmax(0,4fr)_minmax(0,5fr)]');
  expect(grid.outerHTML).not.toMatch(/w-\[\d+px\]|_\d+px\]/);
  // fila 1: tres celdas directas de la grilla
  const cellOf = (name) => el.querySelector(`[data-card="${name}"]`).parentElement;
  ['ritmo', 'flujo', 'por-revisar'].forEach(n => expect(cellOf(n).parentElement).toBe(grid));
  // Patrimonio y gráficas comparten la columna doble, en ese orden
  const double = cellOf('patrimonio').parentElement;
  expect(double.className).toContain('lg:col-span-2');
  expect(cellOf('graficas').parentElement).toBe(double);
  expect([...double.querySelectorAll('[data-card]')].map(n => n.dataset.card)).toEqual(['patrimonio', 'graficas']);
  // Presupuestos llena el alto de esa columna (absoluto dentro de su celda)
  expect(el.querySelector('[data-card="presupuestos"]').parentElement.className).toContain('lg:absolute');
  unmount();
});

test('Inicio en móvil: el orden de la pila no cambia (Por revisar después de Flujo)', async () => {
  const { el, unmount } = await mount();
  const orderOf = (n) => Number(el.querySelector(`[data-card="${n}"]`).closest('[class*="order-"]').className.match(/(?:^|\s)order-(\d+)/)[1]);
  const stack = ['ritmo', 'flujo', 'por-revisar', 'patrimonio', 'graficas', 'presupuestos', 'cuentas'];
  expect(stack.map(orderOf)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  unmount();
});
