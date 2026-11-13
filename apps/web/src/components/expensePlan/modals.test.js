// Presupuestos: crear y editar (Modal) y Panorama con Gastos e Ingresos.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import CreateCategory from './CreateCategory';
import EditCategory, { budgetFromNotice, budgetMonthLabel } from './EditCategory';
import FullBudgetsModal, { panoramaRows } from '../dashboard/budgetCategories/FullBudgetsModal';
import BudDashCategorieList from '../dashboard/budgetCategories/BudDashCategorieList';
import { SET_DASH_CATEGORY_ACTIVATED, SET_ACTIVE_REPORT_TAB } from '../../redux/actions/types';

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
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const row = (category_id, name, value, budget, extra = {}) => ({
  category_id, name, emoji: '1f6d2', value, budget, usage: budget ? (Math.abs(value) / budget) * 100 : 0, ...extra,
});
const expenses = [row(1, 'mercado', -450000, 500000), row(2, 'salidas', -600000, 400000), row(3, 'hogar', -100000, 1000000), row(4, 'regalos', 0, 0)];
const incomes = [row(8, 'salario', 5000000, 5000000), row(9, 'arriendo recibido', 600000, 1200000)];
const base = {
  Reports: {
    current_Month: 3, current_Year: 2020, // un mes pasado: sin marca de ritmo
    expenses_report: expenses, income_report: incomes,
    expenses_report_full: { value: -1150000, budget: 1900000 },
    income_report_full: { value: 5600000, budget: 6200000 },
    category_activated: null,
  },
  UI: { active_report_tab: 'Expenses' },
  CashFlow: { user_categories: { items: [], default: [] }, account_types: { items: [] }, banks: { items: [] } },
  Alert: { alert: null },
};

const mount = async (ui, over = {}) => {
  const actions = [];
  const store = createStore((s = { ...base, ...over }, a) => { actions.push(a); return s; }, applyMiddleware(thunk));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Provider store={store}>{ui}</Provider>));
  return { el, actions, unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
};
const dialog = () => document.querySelector('[role=dialog]');
const click = async (node) => act(async () => node.click());
const footer = () => [...dialog().querySelectorAll('footer button')].map(b => b.textContent.trim());
const clean = (d) => expect(d.outerHTML).not.toMatch(/#5266EB|#151C2C|indigo-/i);

test('Nuevo presupuesto: Modal con campos comunes y Crear en el pie', async () => {
  const setOpen = jest.fn();
  const m = await mount(<CreateCategory openCreateBox setOpenCreateBox={setOpen} />);
  const d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Nuevo presupuesto');
  clean(d);
  expect(d.querySelector('label[for="budget"]').textContent).toBe('Presupuesto mensual');
  expect(d.querySelector('#budget').className).toContain('rounded-xl');
  expect(footer()).toEqual(['Cancelar', 'Crear']);
  await click([...d.querySelectorAll('footer button')][0]);
  expect(setOpen).toHaveBeenCalledWith(false);
  await m.unmount();
});

test('Editar presupuesto: muestra lo gastado del mes y el estado junto al monto, y lo recalcula al editar', async () => {
  const detail = { id: 2, name: 'salidas', budget: 400000, income: false, emoji: '1f389' };
  const m = await mount(<EditCategory openEditCat setOpenEditCat={() => {}} detailInfo={detail} setDetailInfo={() => {}} />);
  const d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Presupuesto');
  clean(d);
  expect(d.textContent).toContain('Gastado este mes');
  expect(d.textContent).toMatch(/600\.000.*de.*400\.000/);
  // estado con ícono + palabra
  const status = [...d.querySelectorAll('span')].find(s => /Te pasaste · 150%/.test(s.textContent));
  expect(status.querySelector('svg')).not.toBeNull();
  expect(footer()).toEqual(['Eliminar', 'Editar']);

  await click([...d.querySelectorAll('footer button')][1]);
  expect(d.querySelector('h2').textContent).toBe('Editar presupuesto');
  expect(footer()).toEqual(['Cancelar', 'Guardar cambios']);
  // con un monto nuevo de 1.200.000 la barra queda al 50%
  const input = d.querySelector('#budget');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, '1200000'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(d.querySelector('[role=progressbar]').getAttribute('aria-valuenow')).toBe('50');

  await click([...d.querySelectorAll('footer button')][0]);
  await click([...d.querySelectorAll('footer button')][0]);
  expect(d.querySelector('h2').textContent).toBe('¿Eliminar esta categoría?');
  expect(footer()).toEqual(['Cancelar', 'Sí, eliminar']);
  await m.unmount();
});

test('panoramaRows: por % de uso (o monto), las que no tienen presupuesto al final y sin filas vacías', () => {
  expect(panoramaRows(expenses).map(r => r.category_id)).toEqual([2, 1, 3]);
  expect(panoramaRows(expenses, 'amount').map(r => r.category_id)).toEqual([2, 1, 3]);
  expect(panoramaRows([row(5, 'x', -10, 0), row(6, 'y', -5, 100)]).map(r => r.category_id)).toEqual([6, 5]);
});

test('Panorama: Gastos e Ingresos con gastado/recibido, % y estado; tocar una tarjeta elige la categoría', async () => {
  const onClose = jest.fn();
  const m = await mount(<FullBudgetsModal isOpen onClose={onClose} />);
  const d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Panorama de presupuestos');
  clean(d);
  // empieza en la pestaña de la vista (Gastos)
  const tabs = [...d.querySelectorAll('[role=tab]')];
  expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
  const summary = d.querySelector('[aria-label="Resumen del mes"]');
  expect(summary.textContent).toMatch(/Presupuestado.*1\.900\.000/);
  expect(summary.textContent).toMatch(/Gastado.*1\.150\.000/);
  expect(summary.textContent).toContain('Vas bien · 61%');
  const cards = () => [...d.querySelectorAll('ul button')];
  expect(cards().map(c => c.querySelector('span span:last-child').textContent)).toEqual(['Salidas', 'Mercado', 'Hogar']);
  expect(cards()[0].textContent).toMatch(/600\.000.*de.*400\.000.*Te pasaste · 150%/);
  expect(cards()[0].querySelector('[role=progressbar]')).not.toBeNull();

  // Ingresos: recibido y estado de meta
  await click(tabs[1]);
  expect(summary.textContent).toMatch(/Esperado.*6\.200\.000/);
  expect(summary.textContent).toMatch(/Recibido.*5\.600\.000/);
  expect(summary.textContent).toContain('En progreso · 90%');
  expect(cards().map(c => c.textContent)).toEqual([
    expect.stringMatching(/Salario.*Meta cumplida · 100%/),
    expect.stringMatching(/Arriendo Recibido.*En progreso · 50%/),
  ]);
  // elegir una de ingresos cambia la pestaña de la vista y la selecciona
  await click(cards()[1]);
  const types = m.actions.map(a => a.type);
  expect(types).toEqual(expect.arrayContaining([SET_ACTIVE_REPORT_TAB, SET_DASH_CATEGORY_ACTIVATED]));
  expect(m.actions.find(a => a.type === SET_ACTIVE_REPORT_TAB).payload).toBe('Income');
  expect(m.actions.find(a => a.type === SET_DASH_CATEGORY_ACTIVATED).payload.category_id).toBe(9);
  expect(onClose).toHaveBeenCalled();
  await m.unmount();
});

test('Presupuestos: el botón del Panorama está también en la pestaña de Ingresos', async () => {
  const m = await mount(<BudDashCategorieList handleOpenEditCat={() => {}} setOpenCreateBox={() => {}} />, { UI: { active_report_tab: 'Income' } });
  expect(m.el.querySelector('[aria-label="Panorama completo"]')).not.toBeNull();
  await m.unmount();
});

// Presupuestos con historial (plan/26-presupuestos-historicos.md)
test('budgetFromNotice: hasta cuándo rige un presupuesto fijado desde un mes pasado', () => {
  const versions = [{ budget: 1000000, from: '2026-11' }, { budget: 800000, from: '2000-01', base: true }];
  expect(budgetFromNotice(versions, '2026-11', '2026-11')).toBeNull();
  expect(budgetFromNotice(versions, '2026-06', '2026-11')).toMatch(/^Rige desde jun 2026 hasta oct 2026; desde nov 2026 sigue .*1\.000\.000\.$/);
  expect(budgetFromNotice(versions, '2026-10', '2026-11')).toMatch(/^Rige solo en oct 2026; desde nov 2026/);
  expect(budgetFromNotice([{ budget: 5, from: '2000-01' }], '2026-03', '2026-11')).toBe('Rige desde mar 2026 en adelante, también este mes.');
  expect(budgetFromNotice(versions, '2000-01', '2026-11')).toMatch(/^Rige desde el inicio hasta oct 2026/);
  expect(budgetMonthLabel('2000-01')).toBe('el inicio');
});

test('Editar presupuesto: historial con borrar (menos la base) y "Aplica desde" con el mes en curso por defecto', async () => {
  const axios = require('axios').default;
  const versions = [{ budget: 1000000, from: '2026-11', base: false }, { budget: 800000, from: '2000-01', base: true }];
  axios.get.mockImplementation((url) => Promise.resolve({ status: 200, data: { data: url.includes('/budgets') ? versions : [] } }));
  const detail = { id: 2, name: 'salidas', budget: 1000000, income: false, emoji: '1f389' };
  const m = await mount(<EditCategory openEditCat setOpenEditCat={() => {}} detailInfo={detail} setDetailInfo={() => {}} />);
  const d = dialog();
  expect(d.textContent).toContain('Historial del presupuesto');
  expect(d.textContent).toMatch(/1\.000\.000 desde nov 2026 · vigente/);
  expect(d.textContent).toMatch(/800\.000 desde el inicio/);
  const trash = [...d.querySelectorAll('button[aria-label^="Borrar el presupuesto"]')];
  expect(trash.map(b => b.getAttribute('aria-label'))).toEqual(['Borrar el presupuesto desde nov 2026']);
  await click(trash[0]);
  expect(d.textContent).toMatch(/¿Borrar\? Desde nov 2026 vuelve a .*800\.000/);

  await click([...d.querySelectorAll('footer button')][1]); // Editar
  const select = d.querySelector('#applyFrom');
  const now = new Date();
  expect(select.value).toBe(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  expect(select.options[0].textContent).toMatch(/^Este mes \(/);
  expect(select.options[select.options.length - 1].textContent).toBe('Desde el inicio');
  axios.get.mockImplementation(() => Promise.resolve({ status: 200, data: { data: [] } }));
  await m.unmount();
});

test('Editar presupuesto desde un mes pasado: solo fija la versión (sin el PUT de la categoría si no cambió nada más)', async () => {
  const axios = require('axios').default;
  const versions = [{ budget: 1000000, from: '2026-11', base: false }, { budget: 800000, from: '2000-01', base: true }];
  axios.get.mockImplementation((url) => Promise.resolve({ status: 200, data: { data: url.includes('/budgets') ? versions : [] } }));
  axios.put.mockReset();
  axios.put.mockImplementation(() => Promise.resolve({ status: 200, data: { data: [{ budget: 1000000, from: '2026-11' }, { budget: 650000, from: '2026-03' }, versions[1]] } }));
  const detail = { id: 2, name: 'salidas', budget: 1000000, income: false, emoji: '1f389' };
  const m = await mount(<EditCategory openEditCat setOpenEditCat={() => {}} detailInfo={detail} setDetailInfo={() => {}} />);
  const d = dialog();
  await click([...d.querySelectorAll('footer button')][1]); // Editar
  const set = async (el, v, ev) => act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v);
    el.dispatchEvent(new Event(ev, { bubbles: true }));
  });
  const select = d.querySelector('#applyFrom');
  const past = select.options[3].value;
  await set(select, past, 'change');
  await set(d.querySelector('#budget'), '650000', 'input');
  expect(d.textContent).toMatch(/hasta .*; desde nov 2026 sigue .*1\.000\.000/);
  await click([...d.querySelectorAll('footer button')].find(b => b.textContent.trim() === 'Guardar cambios'));
  expect(axios.put).toHaveBeenCalledTimes(1);
  const [url, body] = axios.put.mock.calls[0];
  expect(url).toMatch(/\/categories\/2\/budgets$/);
  expect(JSON.parse(body)).toEqual({ budget: 650000, from: past });
  expect(d.textContent).toMatch(/650\.000 desde/);
  axios.get.mockImplementation(() => Promise.resolve({ status: 200, data: { data: [] } }));
  await m.unmount();
});
