// "¿Qué le falta a Topi?" (plan/27 §E): máx. 500 caracteres, aviso de no poner datos bancarios, 3 por día.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import FeedbackSheet from './FeedbackSheet';
import { AdminFeedbackView } from '../admin/AdminFeedback';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;
const mount = async (element) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(element); });
};
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const typeText = async (value) => {
  const area = document.body.querySelector('textarea');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  await act(async () => {
    setter.call(area, value);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const button = (label) => [...document.body.querySelectorAll('button')].find(b => b.textContent.trim() === label);

test('envía el texto recortado y si se le puede escribir', async () => {
  const send = jest.fn().mockResolvedValue({});
  await mount(<FeedbackSheet open onClose={() => {}} send={send} />);
  expect(document.body.textContent).toContain('No escribas datos bancarios');
  expect(button('Enviar').disabled).toBe(true);

  await typeText('  Que lea Davivienda  ');
  await act(async () => { document.body.querySelector('input[type="checkbox"]').click(); });
  await act(async () => { button('Enviar').click(); });

  expect(send).toHaveBeenCalledWith('Que lea Davivienda', true);
  expect(document.body.textContent).toContain('¡Gracias! Ya nos llegó.');
});

test('más de 500 caracteres: no deja enviar y lo marca', async () => {
  const send = jest.fn();
  await mount(<FeedbackSheet open onClose={() => {}} send={send} />);
  await typeText('a'.repeat(501));
  expect(button('Enviar').disabled).toBe(true);
  expect(document.body.textContent).toContain('-1');
});

test('el cuarto del día explica el límite', async () => {
  const send = jest.fn().mockRejectedValue({ response: { status: 429 } });
  await mount(<FeedbackSheet open onClose={() => {}} send={send} />);
  await typeText('otra más');
  await act(async () => { button('Enviar').click(); });
  expect(document.body.textContent).toContain('Ya nos enviaste 3 opiniones hoy');
});

test('panel: id corto, texto y marcar como leída', async () => {
  const onRead = jest.fn();
  await mount(<AdminFeedbackView unreadOnly onToggle={() => {}} onRead={onRead} marking={null} data={{
    unread: 1,
    items: [{ id: 7, user: 'a1b2c3d4', text: 'Que lea Davivienda', contact_ok: true, created_at: '2026-11-14T15:00:00Z', read_at: null }],
  }} />);
  expect(container.textContent).toContain('a1b2c3d4');
  expect(container.textContent).toContain('Que lea Davivienda');
  expect(container.textContent).toContain('Se le puede escribir');
  await act(async () => { button('Marcar como leída').click(); });
  expect(onRead).toHaveBeenCalledWith(7);
});
