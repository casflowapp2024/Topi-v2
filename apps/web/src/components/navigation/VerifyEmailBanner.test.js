// Aviso de verificación del correo: solo para cuentas nuevas sin verificar, no bloquea.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import axios from 'axios';
import VerifyEmailBanner from './VerifyEmailBanner';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const render = async (user) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const store = createStore((state = { Auth: { user } }) => state, applyMiddleware(thunk));
  await act(async () => {
    root.render(<Provider store={store}><VerifyEmailBanner /></Provider>);
  });
};

const typeCode = async (value) => {
  const input = container.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const click = async (label) => {
  const button = [...container.querySelectorAll('button')].find(b => b.textContent.includes(label) || b.getAttribute('aria-label') === label);
  await act(async () => { button.click(); });
};

beforeEach(() => {
  axios.post.mockReset();
  axios.get.mockReset();
  sessionStorage.clear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('no aparece para cuentas verificadas o sin el campo', async () => {
  await render({ email: 'a@example.com', email_verified: true });
  expect(container.textContent).toBe('');
  act(() => root.unmount());
  container.remove();

  await render({ email: 'a@example.com' });
  expect(container.textContent).toBe('');
});

test('confirma el correo con el código', async () => {
  await render({ email: 'nuevo@example.com', email_verified: false });
  expect(container.textContent).toContain('Confirma tu correo');
  expect(container.textContent).toContain('nuevo@example.com');

  axios.post.mockResolvedValueOnce({ status: 200, data: {} });
  axios.get.mockResolvedValueOnce({ status: 200, data: { data: { email_verified: true } } });
  await typeCode('123456');
  await click('Confirmar');

  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/users/email/verify'), JSON.stringify({ code: '123456' }), expect.anything());
});

test('código incorrecto y reenvío', async () => {
  await render({ email: 'nuevo@example.com', email_verified: false });

  axios.post.mockRejectedValueOnce({ response: { data: { messages: ['invalid verification code provided'] } } });
  await typeCode('000000');
  await click('Confirmar');
  expect(container.textContent).toContain('El código no es correcto');

  axios.post.mockResolvedValueOnce({ status: 200, data: {} });
  await click('Reenviar código');
  expect(axios.post).toHaveBeenLastCalledWith(expect.stringContaining('/users/email/verify/resend'), null, expect.anything());
  expect(container.textContent).toContain('Te enviamos un código nuevo');
});

test('se puede cerrar por esta sesión', async () => {
  await render({ email: 'nuevo@example.com', email_verified: false });
  await click('Cerrar aviso');
  expect(container.textContent).toBe('');
  expect(sessionStorage.getItem('topi.verifyEmailDismissed')).toBe('1');
});
