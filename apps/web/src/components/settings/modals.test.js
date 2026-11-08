// B5: configuración de usuario, onboarding y los demás diálogos con ui/Modal.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore, applyMiddleware } from 'redux';
import { thunk } from 'redux-thunk';
import AccountSettings from '../../containers/AccountSettings';
import Onboarding2 from '../../hocs/Onboarding2';
import NextStepsPopover from '../onboarding2/NextStepsPopover';
import InstallPwaModal from '../ui/InstallPwaModal';
import ConexionErrorDisplay from './ConexionErrorDisplay';

jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(() => Promise.resolve({ status: 200, data: { data: [] } })), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
const mockNavigate = [];
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useNavigate: () => (to) => mockNavigate.push(to),
  useLocation: () => ({ pathname: '/dashboard' }),
  Outlet: () => null,
}), { virtual: true });
jest.mock('../ui/RangeDateSelector.tsx', () => ({ RangeDateSelector: () => null }));
jest.mock('../ui/DatePicker.tsx', () => ({ DatePicker: () => null }));
// el contenido de cada pestaña y cada paso se prueba aparte: aquí solo el contenedor
jest.mock('../../hocs/Layout', () => ({ children }) => <div>{children}</div>);
jest.mock('./ProfileSetts', () => () => <div data-tab="profile" />);
jest.mock('./ConexionesSetts', () => () => <div data-tab="connections" />);
jest.mock('./EmailPrefsSetts', () => () => <div data-tab="emails" />);
jest.mock('./Membership', () => () => null);
jest.mock('../onboarding2/GoalSelection', () => () => <div data-step="1" />);
jest.mock('../onboarding2/StepLinkEmail', () => () => <div data-step="2" />);
jest.mock('../onboarding2/StepCreateAccount', () => () => <div data-step="3" />);
jest.mock('../onboarding2/StepCompletion', () => () => <div data-step="4" />);
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const base = {
  Auth: { user: { name: 'Ana', email: 'ana.prueba@topi.test' }, user_extra_data: { read_email: false } },
  CashFlow: { first_steps: { email: false, bank: false, keep_open: true } },
  Alert: { alert: null },
};
const mount = async (ui) => {
  const store = createStore((s = base) => s, applyMiddleware(thunk));
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(<Provider store={store}>{ui}</Provider>));
  return { el, unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
};
const dialog = () => document.querySelector('[role=dialog]');
const click = async (node) => act(async () => node.click());
const byText = (root, re) => [...root.querySelectorAll('button')].find(b => re.test(b.textContent));
const esc = async () => act(async () => {
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});
const clean = (d) => expect(d.outerHTML).not.toMatch(/#[0-9a-f]{6}|indigo-/i);

afterEach(() => { localStorage.clear(); mockNavigate.length = 0; });

test('Configuración: Modal con pestañas Perfil/Conexiones/Correos, cerrar sesión en el pie y Esc cierra', async () => {
  const close = jest.fn();
  const logout = jest.fn();
  const m = await mount(<AccountSettings isModal activeTab="connections" closeSettingsModal={close} handleLogout={logout} />);
  const d = dialog();
  expect(d.querySelector('h2').textContent).toBe('Configuración');
  clean(d);
  const tabs = [...d.querySelectorAll('[role=tab]')];
  expect(tabs.map(t => t.textContent)).toEqual(['Perfil', 'Conexiones', 'Correos']);
  expect(tabs.map(t => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false']);
  expect(d.querySelector('[data-tab]').dataset.tab).toBe('connections');
  await click(tabs[2]);
  expect(d.querySelector('[data-tab]').dataset.tab).toBe('emails');
  await click(tabs[0]);
  expect(d.querySelector('[data-tab]').dataset.tab).toBe('profile');
  await click(byText(d.querySelector('footer'), /Cerrar sesión/));
  expect(logout).toHaveBeenCalled();
  await esc();
  expect(close).toHaveBeenCalled();
  await m.unmount();
});

test('Onboarding: Modal no descartable (sin X ni Esc); "Hacerlo más tarde" lo cierra', async () => {
  const m = await mount(<Onboarding2 NextStepsPopoverOnboarding={() => {}} />);
  const d = dialog();
  clean(d);
  expect(d.querySelector('h2').textContent).toBe('Bienvenido a Topi!');
  expect(d.textContent).toContain('Paso 1 de 4');
  expect(d.querySelector('[aria-label="Cerrar"]')).toBeNull();
  expect(d.querySelector('[aria-label="Paso anterior"]')).toBeNull();
  await esc();
  expect(dialog()).not.toBeNull();
  // el paso 1 se puede saltar con la flecha; en el 2 (sin correo) no hay "siguiente"
  await click(d.querySelector('[aria-label="Paso siguiente"]'));
  expect(d.querySelector('[data-step]').dataset.step).toBe('2');
  expect(d.querySelector('[aria-label="Paso siguiente"]')).toBeNull();
  await click(byText(d, /Hacerlo más tarde/));
  await act(async () => { await new Promise(r => setTimeout(r, 400)); });
  expect(dialog()).toBeNull();
  expect(localStorage.getItem('onboardingLastClosed')).not.toBeNull();
  await m.unmount();
});

test('Siguientes pasos: Modal con los tres atajos y el botón al Inicio', async () => {
  let open = true;
  const m = await mount(<NextStepsPopover open setOpen={(v) => { open = v; }} />);
  const d = dialog();
  clean(d);
  expect([...d.querySelectorAll('li button')].map(b => b.textContent)).toEqual([
    expect.stringMatching(/^Cuentas/), expect.stringMatching(/^Categorías/), expect.stringMatching(/^Transacciones/),
  ]);
  await click(d.querySelectorAll('li button')[1]);
  expect(mockNavigate).toEqual(['/dashboard/budgets']);
  expect(open).toBe(false);
  await click(byText(d.querySelector('footer'), /ir al Inicio/));
  expect(mockNavigate).toEqual(['/dashboard/budgets', '/']);
  await m.unmount();
});

test('Instalar Topi: se abre con beforeinstallprompt y "Ahora no" lo cierra y lo recuerda', async () => {
  const m = await mount(<InstallPwaModal />);
  expect(dialog()).toBeNull();
  const ev = new Event('beforeinstallprompt');
  await act(async () => { window.dispatchEvent(ev); });
  const d = dialog();
  clean(d);
  expect(d.querySelector('h2').textContent).toBe('Instalar Topi');
  expect([...d.querySelectorAll('footer button')].map(b => b.textContent)).toEqual(['Ahora no', 'Instalar aplicación']);
  await click(byText(d, /Ahora no/));
  expect(localStorage.getItem('pwa_install_dismissed')).not.toBeNull();
  await m.unmount();
});

test('Error de conexión: Modal con el correo y el estado con ícono + palabra', async () => {
  const m = await mount(<ConexionErrorDisplay openErrorPopup setOpenErrorPopup={() => {}}
    emailErrorSelected={{ email: 'ana.prueba@topi.test', error: 'token_expired_or_revoked' }} />);
  const d = dialog();
  clean(d);
  expect(d.querySelector('h2').textContent).toBe('Conexión con problemas');
  expect(d.textContent).toContain('ana.prueba@topi.test');
  const status = [...d.querySelectorAll('p')].find(p => p.textContent.trim() === 'Sin lectura');
  expect(status.querySelector('svg')).not.toBeNull();
  await m.unmount();
});
