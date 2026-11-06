// Modales de cuentas: crear (Modal), detalle (Sheet) con editar y desvincular, y cambio de moneda (Modal).
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import AccountCreate from './AccountCreate';
import AccountDetail from './AccountDetail';
import CurrencyChangeWizard from './CurrencyChangeWizard';

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
jest.mock('../ui/SingleDateSelector.tsx', () => ({ SingleDateSelector: () => null }));
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const banks = [{ id: 1, name: 'Banco Demo', is_automated: false, isDefault: false }];
const types = { items: [{ id: 1, name: 'Ahorros', class: 'deposit' }, { id: 4, name: 'Tarjeta de crédito', class: 'credit' }] };
const account = {
  id: 9, name: 'Nómina', last_four_digits: '1111', currency: 'COP', initial_balance: 0,
  type: { id: 1, name: 'Ahorros', class: 'deposit' }, bank: { id: 1, name: 'Banco Demo' },
  email: { active: false }, automation: { configured: true }, has_transactions: true,
};
const state = {
  CashFlow: {
    banks: { items: banks, default: [] }, account_types: types, user_accounts: { items: [account] },
    user_categories: { items: [], default: [] },
  },
  Conexions: { automated_emails: { emails: [] } },
  Reports: { balance_by_account: [] },
  Fx: { net_worth: { accounts: [{ account_id: 9, balance: '1500000', base_value: '1500000' }] } },
  Alert: { alert: null },
};

const mount = async (ui) => {
  const store = createStore((s = state) => s, applyMiddleware(thunk));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Provider store={store}>{ui}</Provider>));
  return { el, unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
};
const dialogs = () => [...document.querySelectorAll('[role=dialog]')];
const dialog = () => dialogs()[dialogs().length - 1];
const click = async (node) => act(async () => node.click());
const footer = (d = dialog()) => [...d.querySelectorAll('footer button')].map(b => b.textContent.trim());
const clean = (d) => expect(d.outerHTML).not.toMatch(/#5266EB|#151C2C|#9fa7da|#3b3e44|indigo-/i);

test('Agregar cuenta: Modal con la tarjeta de vista previa, campos comunes y Crear cuenta en el pie', async () => {
  const onOpen = jest.fn();
  const m = await mount(<AccountCreate openCreateBox setOpenCreateBox={onOpen} />);
  const d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Agregar cuenta');
  clean(d);
  expect(d.querySelector('label[for="accountType"]').textContent).toBe('Tipo de producto');
  expect(d.querySelector('#accountType').className).toContain('rounded-xl');
  expect(d.querySelector('label[for="name"]').textContent).toBe('Nombre de la cuenta');
  expect(footer(d)).toEqual(['Cancelar', 'Crear cuenta']);
  expect([...d.querySelectorAll('footer button')][1].getAttribute('form')).toBe('create-account-form');
  // banco sin lectura automática: aviso con ícono, no solo texto gris
  expect(d.textContent).toContain('no permite leer sus transacciones del correo');
  await click([...d.querySelectorAll('footer button')][0]);
  expect(onOpen).toHaveBeenCalledWith(false);
  await m.unmount();
});

test('Detalle de cuenta: hoja lateral; desvincular pide confirmación y editar trae sus acciones', async () => {
  const m = await mount(<AccountDetail openAccDetail setOpenAccDetail={() => {}} detailInfo={account} setDetailInfo={() => {}} />);
  const d = dialog();
  expect(d.querySelector('[class*="sm:rounded-l-3xl"]')).not.toBeNull();
  expect(d.querySelector('h2').textContent).toBe('Cuenta');
  clean(d);
  // estado de la lectura automática con ícono + palabra
  const status = [...d.querySelectorAll('p')].find(p => p.textContent.includes('Lectura automática'));
  expect(status.textContent).toContain('activada');
  expect(status.querySelector('svg')).not.toBeNull();
  expect(footer(d)).toEqual(['Desvincular', 'Editar']);

  await click([...d.querySelectorAll('footer button')][0]);
  expect(d.querySelector('h2').textContent).toBe('¿Desvincular esta cuenta?');
  expect(footer(d)).toEqual(['Cancelar', 'Sí, desvincular']);
  await click([...d.querySelectorAll('footer button')][0]);

  await click([...d.querySelectorAll('footer button')][1]);
  expect(d.querySelector('h2').textContent).toBe('Editar cuenta');
  expect(d.querySelector('footer')).toBeNull();
  const actions = [...d.querySelectorAll('button')].map(b => b.textContent.trim());
  expect(actions).toEqual(expect.arrayContaining(['Cancelar', 'Guardar cambios']));
  await m.unmount();
});

test('Cambio de moneda: Modal con el paso y sus acciones en el pie', async () => {
  const onClose = jest.fn();
  const m = await mount(<CurrencyChangeWizard open onClose={onClose} account={account} />);
  const d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Cambiar la moneda de Nómina');
  clean(d);
  expect(d.querySelector('label[for="newCurrency"]').textContent).toBe('Moneda nueva (hoy: COP)');
  expect(d.querySelectorAll('input[type=radio]')).toHaveLength(3);
  expect(footer(d)).toEqual(['Cancelar', 'Ver qué va a cambiar']);
  // cerrar y abrir: pide el nombre de la cuenta nueva y cambia la acción
  await click(d.querySelectorAll('input[type=radio]')[2]);
  expect(d.querySelector('label[for="newAccountName"]')).not.toBeNull();
  expect(footer(d)).toEqual(['Cancelar', 'Cerrar y abrir']);
  await act(async () => document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(onClose).toHaveBeenCalled();
  await m.unmount();
});
