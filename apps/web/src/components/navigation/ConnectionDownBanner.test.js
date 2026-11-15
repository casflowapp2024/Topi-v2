// Conexión caída (plan/27 §D): banner en todas las vistas, Reconectar en un toque, "Ahora no" por 24 h.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ConnectionDownBanner } from './ConnectionDownBanner';
import { suggestedProvider, isHidden, hideFor24h, HIDE_MS, openOAuthPopup } from '../conexions/reconnect';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
global.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

const broken = { id: 7, email: 'ana.banco@gmail.com', provider: 'gmail', active: true, error: 'token_expired_or_revoked' };

const render = async (props) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const all = {
    emails: [broken],
    get_automated_emails: jest.fn().mockResolvedValue([]),
    link_emails_ask_url: jest.fn().mockResolvedValue('https://accounts.example/oauth'),
    register_email_conexion: jest.fn().mockResolvedValue(true),
    ...props,
  };
  await act(async () => { root.render(<ConnectionDownBanner {...all} />); });
  return all;
};

const button = (label) => [...container.querySelectorAll('button')].find(b => b.textContent.includes(label));

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  localStorage.clear();
  jest.restoreAllMocks();
});

test('sin conexiones caídas no muestra nada', async () => {
  await render({ emails: [{ ...broken, error: null }] });
  expect(container.textContent).toBe('');
});

test('muestra el proveedor sin culpar al usuario y avisa de la pantalla de Google', async () => {
  await render();
  expect(container.textContent).toContain('Topi dejó de leer Gmail');
  expect(container.textContent).toContain('ana.banco@gmail.com');
  expect(container.textContent).toContain('Configuración avanzada');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

test('Outlook no muestra el aviso de Google', async () => {
  await render({ emails: [{ ...broken, provider: 'outlook', email: 'ana@hotmail.com' }] });
  expect(container.textContent).toContain('Topi dejó de leer Outlook');
  expect(container.textContent).not.toContain('Configuración avanzada');
});

test('Reconectar abre el permiso en el mismo clic y registra la misma dirección', async () => {
  const popup = { closed: false };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  const props = await render();

  await act(async () => { button('Reconectar').click(); });
  expect(window.open).toHaveBeenCalledWith('https://accounts.example/oauth', 'TopiReconnect', expect.any(String));
  expect(container.textContent).toContain('Esperando el permiso');

  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data: { code: 'abc' } }));
  });
  expect(props.register_email_conexion).toHaveBeenCalledWith('ana.banco@gmail.com', 'abc', 'gmail');
  expect(props.get_automated_emails).toHaveBeenCalled();
  expect(container.textContent).toContain('Topi volvió a leer tu correo');
});

test('ignora mensajes de otro origen', async () => {
  jest.spyOn(window, 'open').mockReturnValue({ closed: false });
  const props = await render();
  await act(async () => { button('Reconectar').click(); });
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', { origin: 'https://evil.example', data: { code: 'abc' } }));
  });
  expect(props.register_email_conexion).not.toHaveBeenCalled();
});

test('ventana bloqueada: explica qué hacer', async () => {
  jest.spyOn(window, 'open').mockReturnValue(null);
  await render();
  await act(async () => { button('Reconectar').click(); });
  expect(container.textContent).toContain('bloqueó la ventana');
});

test('"Ahora no" lo oculta 24 h, no para siempre', async () => {
  await render();
  await act(async () => { button('Ahora no').click(); });
  expect(container.textContent).toBe('');
  expect(isHidden(7)).toBe(true);
  expect(isHidden(7, Date.now() + HIDE_MS + 1000)).toBe(false);
});

test('el proveedor sugerido por dominio pone Outlook primero para Microsoft', () => {
  expect(suggestedProvider('ana@hotmail.com')).toBe('outlook');
  expect(suggestedProvider('ana@outlook.es')).toBe('outlook');
  expect(suggestedProvider('ana@live.com')).toBe('outlook');
  expect(suggestedProvider('ana@gmail.com')).toBe('gmail');
  expect(suggestedProvider('ana@empresa.co')).toBe('gmail');
});

test('hideFor24h limpia las entradas vencidas', () => {
  const now = Date.now();
  hideFor24h(1, now - 2 * HIDE_MS);
  hideFor24h(2, now);
  expect(JSON.parse(localStorage.getItem('topi.connectionDownHidden'))).toEqual({ 2: now + HIDE_MS });
});

test('openOAuthPopup rechaza si se cierra la ventana', async () => {
  jest.useFakeTimers();
  const popup = { closed: false };
  jest.spyOn(window, 'open').mockReturnValue(popup);
  const promise = openOAuthPopup('https://x');
  popup.closed = true;
  jest.advanceTimersByTime(600);
  await expect(promise).rejects.toThrow('closed');
  jest.useRealTimers();
});
