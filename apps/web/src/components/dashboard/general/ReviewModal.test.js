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
const categories = { items: [{ id: 2, name: 'transporte', emoji: '' }, { id: 3, name: 'comida', emoji: '' }, { id: 7, name: 'babies', emoji: '' }] };

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
  expect(document.body.textContent).toContain('Topi no estaba seguro de la categoría');
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
