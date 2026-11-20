// plan/32: los dígitos de cuenta son opcionales, la primera cuenta no los pide y el detalle muestra los números
// reconocidos (escritos o aprendidos).
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import axios from 'axios';
import AccountCreate from './AccountCreate';
import AccountDetail from './AccountDetail';
import { accountDigitsSuffix, isValidAccountDigits } from '../helpers';
import { updatedMessage } from '../transactions/learnedMessage';

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
const types = { items: [{ id: 1, name: 'Ahorros', class: 'deposit' }, { id: 3, name: 'Inversión', class: 'investment' }, { id: 4, name: 'Tarjeta de crédito', class: 'credit' }] };
const card = {
  id: 9, name: 'Visa', last_four_digits: '', currency: 'COP', initial_balance: 0,
  type: { id: 4, name: 'Tarjeta de crédito', class: 'credit' }, bank: { id: 1, name: 'Banco Demo' },
  email: { active: false }, automation: { configured: false }, has_transactions: true,
};
const stateWith = (accounts) => ({
  CashFlow: {
    banks: { items: banks, default: [] }, account_types: types, user_accounts: { items: accounts },
    user_categories: { items: [], default: [] },
  },
  Conexions: { automated_emails: { emails: [] } },
  Reports: { balance_by_account: [] },
  Fx: { net_worth: { accounts: [] } },
  Alert: { alert: null },
});

const mount = async (ui, state) => {
  const store = createStore((s = state) => s, applyMiddleware(thunk));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Provider store={store}>{ui}</Provider>));
  return { unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
};
const dialogs = () => [...document.querySelectorAll('[role=dialog]')];
const dialog = () => dialogs()[dialogs().length - 1];
const digitsLabel = (d) => d.querySelector('label[for="lastFourDigits"]');

test('la primera cuenta (onboarding) no pide los dígitos', async () => {
  const m = await mount(<AccountCreate openCreateBox setOpenCreateBox={() => {}} />, stateWith([]));
  expect(digitsLabel(dialog())).toBeNull();
  await m.unmount();
});

test('con otras cuentas los dígitos son opcionales y explican para qué sirven', async () => {
  const m = await mount(<AccountCreate openCreateBox setOpenCreateBox={() => {}} />, stateWith([card]));
  const d = dialog();
  expect(digitsLabel(d).textContent).toBe('Últimos 4 dígitos (opcional)');
  const input = d.querySelector('#lastFourDigits');
  expect(input.required).toBe(false);
  expect(d.textContent).toContain('los aprende cuando corrijas un movimiento');

  // una inversión no se reconoce por dígitos
  const select = d.querySelector('#accountType');
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(select, '3');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(digitsLabel(dialog())).toBeNull();
  await m.unmount();
});

test('el detalle muestra los números reconocidos y de dónde salieron', async () => {
  axios.get.mockImplementation((url) => Promise.resolve({
    status: 200,
    data: { data: url.endsWith('/accounts/9/identifiers') ? [
      { id: 1, digits: '1111', source: 'user' }, { id: 2, digits: '2222', source: 'learned' },
    ] : [] },
  }));
  const m = await mount(<AccountDetail openAccDetail setOpenAccDetail={() => {}} detailInfo={card} setDetailInfo={() => {}} />, stateWith([card]));
  const d = dialog();
  expect(d.textContent).toContain('Números reconocidos');
  expect(d.textContent).toContain('••1111 · lo agregaste tú');
  expect(d.textContent).toContain('••2222 · aprendido de tus correcciones');
  expect(d.querySelector('[aria-label="Quitar ••2222"]')).not.toBeNull();
  // la tarjeta sin número escrito no muestra "****" suelto
  expect(d.textContent).not.toContain('****');
  await m.unmount();
});

test('helpers de dígitos', () => {
  expect(isValidAccountDigits('')).toBe(true);
  expect(isValidAccountDigits('1234')).toBe(true);
  expect(isValidAccountDigits('12a4')).toBe(false);
  expect(isValidAccountDigits('123')).toBe(false);
  expect(accountDigitsSuffix({ last_four_digits: '1234' })).toBe(' ••1234');
  expect(accountDigitsSuffix({ last_four_digits: '' })).toBe('');
});

test('el aviso al guardar dice lo que Topi aprendió', () => {
  expect(updatedMessage(null)).toBe('Transacción actualizada');
  expect(updatedMessage({ learned: true, digits: '4321', moved: 0 }))
    .toBe('Transacción actualizada. Topi recordará ••4321 para esta cuenta.');
  expect(updatedMessage({ learned: true, digits: '4321', moved: 2 }))
    .toBe('Transacción actualizada. Topi recordará ••4321 para esta cuenta y le pasó 2 movimientos pendientes con ese número.');
  expect(updatedMessage({ learned: false, digits: '4321', moved: 1 }))
    .toBe('Transacción actualizada. También pasamos 1 movimiento pendiente de ••4321 a esta cuenta.');
  expect(updatedMessage({ learned: false, digits: '4321', moved: 0 })).toBe('Transacción actualizada');
});
