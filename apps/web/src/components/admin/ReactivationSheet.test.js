// Reactivación personal (plan/27 §G): editar → ver el correo final → enviar, uno a uno; bloqueada con su motivo.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import ReactivationSheet from './ReactivationSheet';

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
const button = (label) => [...document.body.querySelectorAll('button')].find(b => b.textContent.trim() === label);
const draft = { subject: 'Rehicimos Topi', body: 'Hola {nombre},\n\nSoy JuanMa.' };

test('editar, ver el correo final y enviar a una sola persona', async () => {
  const api = {
    getReactivation: jest.fn().mockResolvedValue({ allowed: true, reason: '', draft, founder: true, sent_today: 1, daily_limit: 5 }),
    previewReactivation: jest.fn().mockResolvedValue({ to: 'ana@example.com', subject: 'Rehicimos Topi', html: '<p>Hola Ana,</p>', text: 'Hola Ana,' }),
    sendReactivation: jest.fn().mockResolvedValue(null),
  };
  await mount(<ReactivationSheet user={{ id: 'u1', name: 'ana' }} onClose={() => {}} api={api} />);
  expect(document.body.textContent).toContain('1 de 5 correos personales');
  expect(document.body.textContent).toContain('es fundador');
  expect(button('Enviar a esta persona')).toBeUndefined(); // no se envía sin ver el correo final

  await act(async () => { button('Ver el correo final').click(); });
  expect(api.previewReactivation).toHaveBeenCalledWith('u1', draft);
  expect(document.body.querySelector('iframe').getAttribute('srcdoc')).toContain('Hola Ana');
  expect(document.body.querySelector('iframe').getAttribute('sandbox')).toBe('');

  await act(async () => { button('Enviar a esta persona').click(); });
  expect(api.sendReactivation).toHaveBeenCalledWith('u1', draft);
  expect(document.body.textContent).toContain('quedó en cola');
});

test('conexión caída: deshabilitado con el motivo', async () => {
  const api = {
    getReactivation: jest.fn().mockResolvedValue({ allowed: false, reason: 'connection_down', draft, sent_today: 0, daily_limit: 5 }),
    previewReactivation: jest.fn(),
    sendReactivation: jest.fn(),
  };
  await mount(<ReactivationSheet user={{ id: 'u2', name: 'leo' }} onClose={() => {}} api={api} />);
  expect(document.body.textContent).toContain('Tiene una conexión caída');
  expect(button('Ver el correo final').disabled).toBe(true);
});

test('texto con el nombre escrito: explica que use {nombre}', async () => {
  const api = {
    getReactivation: jest.fn().mockResolvedValue({ allowed: true, reason: '', draft, sent_today: 0, daily_limit: 5 }),
    previewReactivation: jest.fn().mockRejectedValue({ response: { status: 400 } }),
    sendReactivation: jest.fn(),
  };
  await mount(<ReactivationSheet user={{ id: 'u1', name: 'ana' }} onClose={() => {}} api={api} />);
  await act(async () => { button('Ver el correo final').click(); });
  expect(document.body.textContent).toContain('escribe {nombre} en vez del nombre');
});
