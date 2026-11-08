// Ajustes > Correos: el resumen mensual empieza apagado y se activa con un clic.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import axios from 'axios';
import EmailPrefsSetts from './EmailPrefsSetts';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const actions = [];

const render = async () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const store = createStore((state = { Auth: { user: { email: 'ana@example.com' } } }, action) => { actions.push(action); return state; }, applyMiddleware(thunk));
  await act(async () => {
    root.render(<Provider store={store}><EmailPrefsSetts /></Provider>);
  });
};

const switches = () => [...container.querySelectorAll('[role="switch"]')];

beforeEach(() => {
  actions.length = 0;
  axios.get.mockReset();
  axios.put.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

test('muestra las preferencias por defecto: resumen apagado, avisos encendidos', async () => {
  axios.get.mockResolvedValueOnce({ status: 200, data: { data: { email_monthly_summary: false, email_connection_alerts: true, email_product_news: false } } });
  await render();

  expect(container.textContent).toContain('ana@example.com');
  const [summary, alerts] = switches();
  expect(summary.getAttribute('aria-checked')).toBe('false');
  expect(alerts.getAttribute('aria-checked')).toBe('true');
});

test('activa el resumen mensual mandando las dos preferencias', async () => {
  axios.get.mockResolvedValueOnce({ status: 200, data: { data: { email_monthly_summary: false, email_connection_alerts: true } } });
  axios.put.mockResolvedValueOnce({ status: 200, data: { data: { email_monthly_summary: true, email_connection_alerts: true } } });
  await render();

  await act(async () => { switches()[0].click(); });

  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/users/notification-prefs'),
    JSON.stringify({ email_monthly_summary: true, email_connection_alerts: true }), expect.anything());
  expect(switches()[0].getAttribute('aria-checked')).toBe('true');
});

test('si falla al guardar vuelve al valor anterior y avisa', async () => {
  axios.get.mockResolvedValueOnce({ status: 200, data: { data: { email_monthly_summary: false, email_connection_alerts: true } } });
  axios.put.mockRejectedValueOnce(new Error('network'));
  await render();

  await act(async () => { switches()[1].click(); });

  expect(switches()[1].getAttribute('aria-checked')).toBe('true');
  expect(actions.some(a => a.type === 'SET_ALERT')).toBe(true);
});
