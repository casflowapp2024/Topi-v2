import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// axios viene en ESM y CRA no lo transforma en jest; las llamadas de billing se reemplazan abajo.
jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...p }) => <a href={String(to)} {...p}>{children}</a>,
  useSearchParams: () => [new URLSearchParams()],
}), { virtual: true });
global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
const MemoryRouter = ({ children }) => children;
jest.mock('../../apiCalls/billing', () => ({
  startSupport: jest.fn(),
  getPayment: jest.fn(),
  // función normal: el jest de CRA corre con resetMocks
  getBillingConfig: () => Promise.resolve({ enabled: true, presets: ['10000', '20000', '50000'], min: '5000', max: '2000000', currency: 'COP' }),
  getAdminMoney: jest.fn(),
  PENDING_STATUSES: ['created', 'pending'],
}));
// la página de gracias va dentro del Layout (redux); aquí se prueba solo su contenido
jest.mock('../../hocs/Layout', () => ({ children }) => children);

import { startSupport, getPayment } from '../../apiCalls/billing';
import SupportSheet, { digitsOnly, validateSupportAmount } from './SupportSheet';
import { SupportThanksContent, thanksState } from '../../containers/SupportThanks';
import UserMenu from '../ui/UserMenu';
import { AdminMoneyView, fmtMonth } from '../admin/AdminMoney';

// formatMoney usa Intl: el espacio después de "$" puede ser duro
const norm = (text) => text.replace(/\s/g, ' ');

beforeEach(() => {
  startSupport.mockReset();
  getPayment.mockReset();
});

describe('Apoyar a Topi: monto', () => {
  test('digitsOnly deja solo los dígitos', () => {
    expect(digitsOnly('$ 20.000')).toBe('20000');
    expect(digitsOnly('00150')).toBe('150');
    expect(digitsOnly('abc')).toBe('');
  });

  test('el monto libre respeta mínimo y máximo', () => {
    expect(validateSupportAmount('')).toMatch(/Escribe/);
    expect(norm(validateSupportAmount('4999'))).toMatch(/mínimo es \$ 5\.000/);
    expect(norm(validateSupportAmount('2000001'))).toMatch(/máximo es \$ 2\.000\.000/);
    expect(validateSupportAmount('5000')).toBeNull();
  });
});

describe('Apoyar a Topi: hoja', () => {
  test('ofrece 10.000 / 20.000 / 50.000 / otro y abre el checkout con el monto como texto', async () => {
    const redirect = jest.fn();
    startSupport.mockResolvedValue({ payment_id: 'p1', checkout_url: 'https://mp.test/checkout' });
    render(<SupportSheet open onClose={() => {}} redirect={redirect} />);

    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => norm(r.textContent))).toEqual(['$ 10.000', '$ 20.000', '$ 50.000', 'Otro monto']);
    expect(radios[1].getAttribute('aria-checked')).toBe('true');

    fireEvent.click(radios[2]);
    fireEvent.click(screen.getByRole('button', { name: /Aportar/ }));
    await waitFor(() => expect(redirect).toHaveBeenCalledWith('https://mp.test/checkout'));
    expect(startSupport).toHaveBeenCalledWith('50000');
  });

  test('el monto libre inválido no llama a la API; el válido sí', async () => {
    const redirect = jest.fn();
    startSupport.mockResolvedValue({ payment_id: 'p1', checkout_url: 'https://mp.test/c' });
    render(<SupportSheet open onClose={() => {}} redirect={redirect} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Otro monto' }));
    const input = screen.getByLabelText('Monto en pesos');
    fireEvent.change(input, { target: { value: '3.000' } });
    fireEvent.click(screen.getByRole('button', { name: /Aportar/ }));
    expect(norm(screen.getByText(/El mínimo es/).textContent)).toMatch(/\$ 5\.000/);
    expect(startSupport).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '15.000' } });
    expect(input.value).toBe('15.000');
    fireEvent.click(screen.getByRole('button', { name: /Aportar/ }));
    await waitFor(() => expect(startSupport).toHaveBeenCalledWith('15000'));
  });

  test('si la API falla lo dice y no redirige', async () => {
    const redirect = jest.fn();
    startSupport.mockRejectedValue(new Error('502'));
    render(<SupportSheet open onClose={() => {}} redirect={redirect} />);
    fireEvent.click(screen.getByRole('button', { name: /Aportar/ }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(redirect).not.toHaveBeenCalled();
  });

  test('no vende nada: sin Plus, planes ni precios de suscripción', () => {
    render(<SupportSheet open onClose={() => {}} redirect={() => {}} />);
    const text = document.body.textContent;
    expect(text).toMatch(/pago único, no una suscripción/);
    expect(text).not.toMatch(/\bPlus\b|\/mes|al mes|mensual|anual|premium|desbloquea/i);
  });
});

describe('Apoyar a Topi: gracias', () => {
  test('estados según el pago', () => {
    expect(thanksState(null, { loading: true })).toBe('loading');
    expect(thanksState(null, { error: true })).toBe('missing');
    expect(thanksState({ status: 'approved' })).toBe('approved');
    expect(thanksState({ status: 'created' })).toBe('pending');
    expect(thanksState({ status: 'rejected' })).toBe('failed');
  });

  test('pregunta a la API mientras está en proceso y muestra el aprobado', async () => {
    getPayment
      .mockResolvedValueOnce({ id: 'p1', status: 'pending', amount: '20000', currency: 'COP' })
      .mockResolvedValueOnce({ id: 'p1', status: 'approved', amount: '20000', currency: 'COP' });
    render(<MemoryRouter><SupportThanksContent paymentId="p1" pollMs={5} /></MemoryRouter>);
    expect(await screen.findByText('¡Gracias por apoyar a Topi!')).toBeTruthy();
    expect(getPayment).toHaveBeenCalledTimes(2);
    expect(getPayment).toHaveBeenCalledWith('p1');
    expect(norm(document.body.textContent)).toMatch(/aporte de \$ 20\.000/);
  });

  test('deja de preguntar después de los intentos y dice que sigue en proceso', async () => {
    getPayment.mockResolvedValue({ id: 'p1', status: 'pending', amount: '10000', currency: 'COP' });
    render(<MemoryRouter><SupportThanksContent paymentId="p1" pollMs={1} tries={3} /></MemoryRouter>);
    expect(await screen.findByText('Tu pago está en proceso')).toBeTruthy();
    await waitFor(() => expect(getPayment).toHaveBeenCalledTimes(3));
    await act(() => new Promise((r) => setTimeout(r, 20)));
    expect(getPayment).toHaveBeenCalledTimes(3);
  });

  test('rechazado: no se cobró y se puede reintentar; sin id: no encontrado', async () => {
    getPayment.mockResolvedValue({ id: 'p1', status: 'rejected', amount: '10000', currency: 'COP' });
    const { unmount } = render(<MemoryRouter><SupportThanksContent paymentId="p1" /></MemoryRouter>);
    expect(await screen.findByText('El pago no se completó')).toBeTruthy();
    expect(await screen.findByRole('button', { name: /Intentar de nuevo/ })).toBeTruthy();
    unmount();

    render(<MemoryRouter><SupportThanksContent paymentId={null} /></MemoryRouter>);
    expect(screen.getByText('No encontramos ese pago')).toBeTruthy();
    expect(getPayment).toHaveBeenCalledTimes(1);
  });
});

describe('Apoyar a Topi: menú de usuario', () => {
  const user = { name: 'ana', email: 'ana@topi.test' };

  test('aparece solo si hay pagos y abre la hoja', () => {
    const onOpenSupport = jest.fn();
    const { unmount } = render(<MemoryRouter><UserMenu user={user} theme="system" onThemeChange={() => {}} onOpenSettings={() => {}}
      onLogout={() => {}} onOpenSupport={onOpenSupport} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Apoyar a Topi/ }));
    expect(onOpenSupport).toHaveBeenCalled();
    unmount();

    render(<MemoryRouter><UserMenu user={user} theme="system" onThemeChange={() => {}} onOpenSettings={() => {}}
      onLogout={() => {}} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }));
    expect(screen.queryByRole('menuitem', { name: /Apoyar a Topi/ })).toBeNull();
  });
});

describe('panel admin: Dinero', () => {
  test('totales, meses y últimos pagos sin correos', () => {
    render(<AdminMoneyView data={{
      enabled: true, currency: 'COP', total: '30000.00', payments: 2, supporters: 1, pending: 1,
      months: [{ month: '2026-11', payments: 2, supporters: 1, amount: '30000.00' }],
      recent: [{ id: 'p1', user: 'abcd1234', kind: 'support', amount: '20000.00', currency: 'COP', status: 'approved', created_at: '2026-11-13T20:00:00Z' }],
    }} />);
    const text = norm(document.body.textContent);
    expect(text).toMatch(/Total aportado\$ 30\.000/);
    expect(screen.getByText('abcd1234')).toBeTruthy();
    expect(screen.getByText('Aprobado')).toBeTruthy();
    expect(text).not.toMatch(/@/);
    expect(fmtMonth('2026-11')).toMatch(/noviembre/);
  });
});
