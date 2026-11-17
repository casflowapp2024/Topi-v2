// plan/31, bloque C: crear el presupuesto sin salir del Inicio
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { BudgetQuickCreate } from './BudgetQuickCreate';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('emoji-picker-react', () => ({ __esModule: true, default: () => null, Emoji: () => <span /> }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const report = [
  { category_id: 3, name: 'comida', emoji: '1f354', value: -220161, budget: 0 },
  { category_id: 5, name: 'salud', emoji: '', value: -785820, budget: 0 },
  { category_id: 7, name: 'babies', emoji: '', value: 0, budget: -200000 },
];

let el; let root;
const mount = async (props) => {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(<BudgetQuickCreate open expenses_report={report} current_Month={11} current_Year={2026}
    get_user_categories={jest.fn()} get_expenses_report={jest.fn()} get_history_dash={jest.fn()} get_financial_report={jest.fn()}
    setAlert={jest.fn()} {...props} />); });
};
afterEach(() => { act(() => root.unmount()); el.remove(); document.body.innerHTML = ''; });

const typeInto = async (input, value) => {
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setValue.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
};
const button = (text) => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text));

test('categorías con más gasto primero y presupuesto para una que ya existe', async () => {
  const set_category_budget = jest.fn(async () => ({ res: true }));
  const onClose = jest.fn();
  await mount({ set_category_budget, create_category: jest.fn(), onClose });
  const options = [...document.querySelectorAll('[role="option"]')].map(o => o.textContent);
  expect(options[0]).toContain('Salud');
  expect(options[0]).toContain('Gastaste');
  expect(button('Crear presupuesto').disabled).toBe(true);
  await act(async () => { document.querySelectorAll('[role="option"]')[1].click(); });
  await typeInto(document.querySelector('input[inputmode="numeric"]'), '300000');
  expect(document.body.textContent).toContain('Este mes llevas');
  await act(async () => { button('Crear presupuesto').click(); });
  expect(set_category_budget).toHaveBeenCalledWith(3, 300000);
  expect(onClose).toHaveBeenCalled();
});

test('categoría nueva con su nombre', async () => {
  const create_category = jest.fn(async () => ({ res: true, id: 9 }));
  await mount({ set_category_budget: jest.fn(), create_category, onClose: jest.fn() });
  await act(async () => { button('Nueva categoría').click(); });
  await typeInto(document.querySelector('input[placeholder="Ej. Mercado"]'), 'Mercado');
  await typeInto(document.querySelector('input[inputmode="numeric"]'), '500000');
  await act(async () => { button('Crear presupuesto').click(); });
  expect(create_category).toHaveBeenCalledWith('Mercado', 500000, '', false);
});

test('si falla, lo dice y no cierra', async () => {
  const onClose = jest.fn();
  await mount({ set_category_budget: jest.fn(async () => ({ res: false })), create_category: jest.fn(), onClose });
  await act(async () => { document.querySelectorAll('[role="option"]')[0].click(); });
  await typeInto(document.querySelector('input[inputmode="numeric"]'), '100000');
  await act(async () => { button('Crear presupuesto').click(); });
  expect(document.body.textContent).toContain('No pudimos guardar');
  expect(onClose).not.toHaveBeenCalled();
});
