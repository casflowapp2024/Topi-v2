// Barra superior: contenedor común, menú de usuario y tema Claro · Oscuro · Sistema.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import axios from 'axios';
import UserMenu, { initials } from './ui/UserMenu';
import ThemeSwitch from './ui/ThemeSwitch';
import PageContainer from './ui/PageContainer';
import { themePreference, useResolvedDark } from './ui/theme';
import { set_theme } from '../redux/actions/auth';
import { GET_USER_EXTRA_SUCESS } from '../redux/actions/types';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(() => Promise.resolve({ status: 200 })), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => () => {},
}), { virtual: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

// matchMedia controlable: cambia el tema del sistema en mitad de la prueba
const media = { matches: false, listeners: new Set() };
// función normal: el jest de CRA corre con resetMocks y borraría la implementación de un jest.fn
window.matchMedia = () => ({
  get matches() { return media.matches; },
  addEventListener: (_, fn) => media.listeners.add(fn),
  removeEventListener: (_, fn) => media.listeners.delete(fn),
});
const setSystemDark = (v) => { media.matches = v; media.listeners.forEach(fn => fn({ matches: v })); };

const mount = (ui) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  act(() => root.render(ui));
  return { el, root, unmount: () => { act(() => root.unmount()); el.remove(); } };
};
const click = (node) => act(() => { node.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
// headlessui abre el menú en pointerdown/click; jsdom no implementa todos los eventos de puntero
const openMenu = async (el) => {
  const btn = el.querySelector('[aria-label="Menú de usuario"]');
  await act(async () => {
    btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  if (!document.querySelector('[role=menu]')) {
    await act(async () => {
      btn.focus();
      btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
  }
};

test('Tema: "theme" manda; sin él, quien eligió oscuro sigue oscuro y los demás quedan en Sistema', () => {
  expect(themePreference(undefined)).toBe('system');
  expect(themePreference({})).toBe('system');
  expect(themePreference({ dark_mode: false })).toBe('system');
  expect(themePreference({ dark_mode: true })).toBe('dark');
  expect(themePreference({ dark_mode: true, theme: 'light' })).toBe('light');
  expect(themePreference({ theme: 'system', dark_mode: true })).toBe('system');
  expect(themePreference({ theme: 'raro' })).toBe('system');
});

test('Tema "Sistema" sigue a prefers-color-scheme y escucha sus cambios', () => {
  const Probe = ({ pref }) => <span>{useResolvedDark(pref) ? 'oscuro' : 'claro'}</span>;
  setSystemDark(false);
  const sys = mount(<Probe pref="system" />);
  expect(sys.el.textContent).toBe('claro');
  act(() => setSystemDark(true));
  expect(sys.el.textContent).toBe('oscuro');
  sys.unmount();
  expect(media.listeners.size).toBe(0);

  const light = mount(<Probe pref="light" />);
  expect(light.el.textContent).toBe('claro'); // el sistema está oscuro pero el usuario eligió claro
  light.unmount();
  setSystemDark(false);
  const dark = mount(<Probe pref="dark" />);
  expect(dark.el.textContent).toBe('oscuro');
  dark.unmount();
});

test('set_theme guarda config.theme sin perder el resto de la configuración', async () => {
  axios.put.mockImplementation(() => Promise.resolve({ status: 200 }));
  let extra = { onboarding_completed: true, utc_offset: -5, config: { otra: 1, dark_mode: true } };
  const store = createStore((s = { Auth: { user_extra_data: extra } }, a) =>
    a.type === GET_USER_EXTRA_SUCESS ? { Auth: { user_extra_data: a.payload.data } } : s, applyMiddleware(thunk));
  await act(async () => { await store.dispatch(set_theme('system')); });
  expect(store.getState().Auth.user_extra_data.config).toEqual({ otra: 1, theme: 'system', dark_mode: false });
  const body = JSON.parse(axios.put.mock.calls[0][1]);
  expect(body.config).toEqual({ otra: 1, theme: 'system', dark_mode: false });
  expect(body.utc_offset).toBe(-5);
});

test('Menú de usuario: iniciales, nombre y correo, Configuración, Conexiones, tema y cerrar sesión', async () => {
  expect(initials({ name: 'ana', lastName: 'pérez' })).toBe('AP');
  expect(initials({ email: 'x@example.com' })).toBe('X');
  const onTheme = jest.fn(); const onSettings = jest.fn(); const onLogout = jest.fn();
  const user = { name: 'ana', lastName: 'pérez', email: 'ana@example.com' };
  const m = mount(<UserMenu user={user} theme="system" onThemeChange={onTheme} onOpenSettings={onSettings} onLogout={onLogout} />);
  expect(m.el.querySelector('[aria-label="Menú de usuario"]').textContent).toBe('AP');
  await openMenu(m.el);
  const menu = document.querySelector('[role=menu]');
  expect(menu).not.toBeNull();
  expect(menu.textContent).toContain('ana pérez');
  expect(menu.textContent).toContain('ana@example.com');
  const items = [...menu.querySelectorAll('[role=menuitem]')].map(i => i.textContent.replace(' (elegido)', '').trim());
  expect(items).toEqual(['Configuración', 'Conexiones', 'Claro', 'Oscuro', 'Sistema', 'Cerrar sesión']);
  const radios = [...menu.querySelectorAll('[data-theme-option]')];
  expect(radios.map(r => r.hasAttribute('data-selected'))).toEqual([false, false, true]);
  expect(radios[2].textContent).toContain('(elegido)');
  click(radios[1]);
  expect(onTheme).toHaveBeenCalledWith('dark');

  await openMenu(m.el);
  click([...document.querySelectorAll('[role=menuitem]')].find(i => i.textContent.includes('Conexiones')));
  expect(onSettings).toHaveBeenCalledWith('connections');
  await openMenu(m.el);
  click([...document.querySelectorAll('[role=menuitem]')].find(i => i.textContent.includes('Cerrar sesión')));
  expect(onLogout).toHaveBeenCalled();
  m.unmount();
});

test('ThemeSwitch: radios con la opción actual marcada; elegir la misma no guarda', () => {
  const onChange = jest.fn();
  const m = mount(<ThemeSwitch value="light" onChange={onChange} />);
  const radios = [...m.el.querySelectorAll('[role=radio]')];
  expect(radios.map(r => r.textContent)).toEqual(['Claro', 'Oscuro', 'Sistema']);
  click(radios[0]);
  expect(onChange).not.toHaveBeenCalled();
  click(radios[2]);
  expect(onChange).toHaveBeenCalledWith('system');
  m.unmount();
});

test('PageContainer: ancho fluido con contenido de hasta 1168px y el mismo margen para barra y vistas', () => {
  const m = mount(<PageContainer as="main" className="py-1">x</PageContainer>);
  const main = m.el.querySelector('main');
  expect(main.className).toContain('max-w-[1216px]');
  expect(main.className).toContain('mx-auto');
  expect(main.className).toContain('px-4');
  expect(main.className).toContain('lg:px-6');
  m.unmount();
});
