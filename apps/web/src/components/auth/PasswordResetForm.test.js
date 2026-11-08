// Recuperar la contraseña con código: pedir el código, cambiarla, y los errores de la API.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import axios from 'axios';
import PasswordResetForm from './PasswordResetForm';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
global.IS_REACT_ACT_ENVIRONMENT = true;

const actions = [];
const makeStore = () => createStore((state = {}, action) => { actions.push(action); return state; }, applyMiddleware(thunk));

let container;
let root;

const render = async (props = {}) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Provider store={makeStore()}><PasswordResetForm {...props} /></Provider>);
  });
};

const setValue = async (selector, value) => {
  const input = container.querySelector(selector);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const submit = async () => {
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

const alerts = () => actions.filter(a => a.type === 'SET_ALERT').map(a => a.payload.msg);

const goToCodeStep = async (props) => {
  axios.post.mockResolvedValueOnce({ status: 200, data: { messages: ['ok'] } });
  await render(props);
  if (!props?.email) await setValue('#reset-email', 'ana@example.com');
  await submit();
};

beforeEach(() => {
  actions.length = 0;
  axios.post.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('pide el código y pasa al segundo paso', async () => {
  await goToCodeStep();

  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/users/password/forgot'), JSON.stringify({ email: 'ana@example.com' }), expect.anything());
  expect(container.querySelector('#reset-code')).not.toBeNull();
  expect(container.textContent).toContain('ana@example.com');
  expect(container.textContent).toContain('Reenviar código (60s)');
});

test('cambia la contraseña con el código y deja la sesión iniciada', async () => {
  const onDone = jest.fn();
  await goToCodeStep({ onDone });

  axios.post.mockResolvedValueOnce({ status: 200, data: { data: { access_token: 'jwt', refresh_token: 'r' } } });
  await setValue('#reset-code', '12a34-56');
  expect(container.querySelector('#reset-code').value).toBe('123456');
  await setValue('#new-password', 'Nueva123!');
  await setValue('#confirm-new-password', 'Nueva123!');
  await submit();

  expect(axios.post).toHaveBeenLastCalledWith(
    expect.stringContaining('/users/password/reset'),
    JSON.stringify({ email: 'ana@example.com', code: '123456', password: 'Nueva123!', confirm_password: 'Nueva123!' }),
    expect.anything(),
  );
  expect(actions.some(a => a.type === 'LOGIN_SUCCESS')).toBe(true);
  expect(onDone).toHaveBeenCalled();
});

test('código incorrecto y código vencido', async () => {
  await goToCodeStep();
  await setValue('#reset-code', '123456');
  await setValue('#new-password', 'Nueva123!');
  await setValue('#confirm-new-password', 'Nueva123!');

  axios.post.mockRejectedValueOnce({ response: { status: 401, data: { messages: ['invalid verification code provided'] } } });
  await submit();
  expect(alerts().pop()).toContain('El código no es correcto');

  axios.post.mockRejectedValueOnce({ response: { status: 400, data: { messages: ['confirmation code has expired'] } } });
  await submit();
  expect(alerts().pop()).toContain('Pide uno nuevo');
  expect(container.querySelector('#reset-code').value).toBe('');
  expect(actions.some(a => a.type === 'LOGIN_SUCCESS')).toBe(false);
});

test('no llama a la API si la contraseña no cumple o no coincide', async () => {
  await goToCodeStep();
  await setValue('#reset-code', '123456');
  await setValue('#new-password', 'corta');
  await setValue('#confirm-new-password', 'corta');
  await submit();
  expect(alerts().pop()).toContain('no cumple');

  await setValue('#new-password', 'Nueva123!');
  await setValue('#confirm-new-password', 'Nueva123?');
  await submit();
  expect(alerts().pop()).toContain('no coinciden');
  expect(axios.post).toHaveBeenCalledTimes(1);
});

test('usuario migrado: correo fijo y mensaje de la migración', async () => {
  await render({ email: 'migrado@example.com', migration: true });

  expect(container.textContent).toContain('Actualizamos Topi');
  expect(container.querySelector('#reset-email').disabled).toBe(true);

  axios.post.mockResolvedValueOnce({ status: 200, data: {} });
  await submit();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/users/password/forgot'), JSON.stringify({ email: 'migrado@example.com' }), expect.anything());
  expect(container.textContent).not.toContain('Cambiar correo');
  expect(container.textContent).toContain('Crear contraseña y entrar');
});

test('límite de códigos', async () => {
  axios.post.mockRejectedValueOnce({ response: { status: 429, data: { messages: ['limit exceeded, too many requests'] } } });
  await render();
  await setValue('#reset-email', 'ana@example.com');
  await submit();

  expect(alerts().pop()).toContain('Espera unos minutos');
  expect(container.querySelector('#reset-code')).toBeNull();
});
