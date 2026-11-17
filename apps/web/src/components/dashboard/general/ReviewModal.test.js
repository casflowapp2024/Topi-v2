// plan/31, bloque D: "Revisar movimientos" uno a uno
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ReviewModal, merchantKey, buildReviewQueue } from './ReviewModal';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('emoji-picker-react', () => ({ __esModule: true, default: () => null, Emoji: () => <span /> }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const tx = (id, description, extra = {}) => ({ id, description, amount: 19400, amount_base: 19400, currency: 'COP', expense: true,
  date: '2026-11-16', account: { id: 1, name: 'TC davibank' }, category: { id: 2, name: 'transporte' }, should_verify: true, ...extra });
const categories = { items: [{ id: 2, name: 'transporte', emoji: '' }, { id: 3, name: 'comida', emoji: '' }, { id: 7, name: 'babies', emoji: '' }, { id: 8, name: 'salario', emoji: '', income: true },
  { id: -2, name: 'Servicios', emoji: '1f4a1', userCat: false, income: false }, { id: -1, name: 'Comida', emoji: '', userCat: true, income: false }] };

let el; let root;
const mount = async (props) => {
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => { root.render(<ReviewModal open onClose={jest.fn()} user_categories={categories}
    expenses_report={[{ category_id: 7, budget: -200000 }]} get_user_categories={jest.fn()} setAlert={jest.fn()} {...props} />); });
};
afterEach(() => { if (root) act(() => root.unmount()); if (el) el.remove(); root = null; el = null; document.body.innerHTML = ''; });
const button = (text) => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text));

test('merchantKey y la cola: categorías primero, sin pagos sin contraparte', () => {
  expect(merchantKey('DLO*Didi 123')).toBe(merchantKey('dlo*didi'));
  const q = buildReviewQueue([tx(1, 'a'), tx(2, 'b', { needs_counterpart: true })], [tx(3, 'c')]);
  expect(q.map(i => i.kind)).toEqual(['verify', 'installments']);
});

test('recorre: categoría aplicada a todos los del mismo comercio y luego cuotas', async () => {
  const update_transaction = jest.fn(async () => true);
  const saveInstallments = jest.fn(async () => ({ ok: true }));
  await mount({
    update_transaction, create_category: jest.fn(), saveInstallments,
    loadVerify: async () => ({ items: [tx(1, 'DLO*Didi'), tx(2, 'dlo*didi 2'), tx(3, 'Carulla')] }),
    loadInstallments: async () => ({ items: [tx(4, 'Homecenter', { amount: 332400 })] }),
  });
  expect(document.body.textContent).toContain('1 de 4');
  expect(document.body.textContent).toContain('Elige la categoría que corresponde a este gasto.');
  expect(document.body.textContent).toContain('Aplicar a los otros 1');
  expect(document.querySelector('[aria-label="tiene presupuesto"]')).not.toBeNull();
  await act(async () => { button('Comida').click(); });
  expect(update_transaction).toHaveBeenCalledTimes(2);
  expect(update_transaction.mock.calls.map(c => c[1])).toEqual([3, 3]);
  expect(document.body.textContent).toContain('3 de 4');
  expect(document.body.textContent).toContain('Carulla');
  await act(async () => { button('Transporte').click(); });
  expect(document.body.textContent).toContain('¿Esta compra fue a cuotas?');
  await act(async () => { document.querySelector('[aria-label="6 cuotas"]').click(); });
  expect(saveInstallments).toHaveBeenCalledWith(4, 6);
  expect(document.body.textContent).toContain('¡Listo! Revisaste 4.');
});

test('saltar y crear una categoría desde la ventana', async () => {
  const update_transaction = jest.fn(async () => true);
  const create_category = jest.fn(async () => ({ res: true, id: 9 }));
  await mount({
    update_transaction, create_category, saveInstallments: jest.fn(),
    loadVerify: async () => ({ items: [tx(1, 'Didi'), tx(2, 'Carulla')] }),
    loadInstallments: async () => ({ items: [] }),
  });
  await act(async () => { button('Saltar').click(); });
  expect(document.body.textContent).toContain('Carulla');
  await act(async () => { button('Nueva categoría').click(); });
  const input = document.querySelector('input[placeholder="Ej. Domicilios"]');
  const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setValue.call(input, 'Mercado'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => { button('Crear y usar').click(); });
  expect(create_category).toHaveBeenCalledWith('Mercado', 0, '', false);
  expect(update_transaction).toHaveBeenCalledWith(2, 9, 1, 'Carulla', true, 19400, '2026-11-16', true);
});

test('un ingreso pregunta de dónde viene y ofrece las categorías de ingreso', async () => {
  await mount({
    update_transaction: jest.fn(async () => true), create_category: jest.fn(), saveInstallments: jest.fn(),
    loadVerify: async () => ({ items: [tx(1, 'Deel', { expense: false })] }),
    loadInstallments: async () => ({ items: [] }),
  });
  expect(document.body.textContent).toContain('Elige la categoría que corresponde a este ingreso.');
  expect(button('Salario')).toBeTruthy();
  expect(button('Comida')).toBeFalsy();
});

test('las categorías recomendadas que aún no existen se crean al elegirlas', async () => {
  const update_transaction = jest.fn(async () => true);
  const create_category = jest.fn(async () => ({ res: true, id: 12 }));
  await mount({
    update_transaction, create_category, saveInstallments: jest.fn(),
    loadVerify: async () => ({ items: [tx(1, 'Enel')] }),
    loadInstallments: async () => ({ items: [] }),
  });
  expect([...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Comida')).toHaveLength(1); // la que ya tiene no se repite
  await act(async () => { button('Servicios').click(); });
  expect(create_category).toHaveBeenCalledWith('Servicios', 0, '1f4a1', false);
  expect(update_transaction.mock.calls[0][1]).toBe(12);
});
