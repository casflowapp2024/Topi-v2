import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// axios viene en ESM y CRA no lo transforma en jest; estos componentes reciben la API como prop.
jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
import BankLogo, { bankInitials } from '../ui/BankLogo';
import { BankSheet, CatalogBankCard, HealthLine, UserSendersPanel, apiError } from './AdminBanks';

const bank = {
  id: 3, slug: 'nequi', name: 'Nequi', country: 'CO', color: '#200020', active: true, logo_url: null, users: 12, connected_users: 9,
  senders: [
    { id: 1, email: 'alertas@nequi.com.co', active: true, note: null, health: { read: 40, transactions: 30, no_transaction: 10, errors: 0, last_email_at: '2026-11-20T10:00:00Z' } },
    { id: 2, email: 'viejo@nequi.com.co', active: false, note: 'dominio viejo', health: { read: 0 } },
  ],
};

describe('BankLogo', () => {
  test('sin logo muestra las iniciales sobre el color del banco', () => {
    const { container } = render(<BankLogo name="Lulo Bank" color="#00ff00" />);
    expect(screen.getByText('LB')).toBeTruthy();
    expect(container.querySelector('span').style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  test('con logo usa la URL de la API y vuelve a las iniciales si la imagen falla', () => {
    const { container } = render(<BankLogo name="Nubank" logoUrl="/banks/catalog/9/logo?v=abc" />);
    const img = container.querySelector('img');
    expect(img.getAttribute('src')).toContain('/banks/catalog/9/logo?v=abc');
    fireEvent.error(img);
    expect(screen.getByText('NU')).toBeTruthy();
  });

  test('iniciales', () => {
    expect(bankInitials('banco de bogotá')).toBe('BD');
    expect(bankInitials('')).toBe('?');
  });
});

describe('panel → Bancos', () => {
  test('la tarjeta muestra uso, remitentes y su salud', () => {
    render(<ul><CatalogBankCard bank={bank} onEdit={() => {}} /></ul>);
    expect(screen.getByText('Nequi')).toBeTruthy();
    expect(screen.getByText(/12 usuarios · 9 con correo conectado/)).toBeTruthy();
    expect(screen.getByText(/40 leídos · 30 con movimiento · 10 sin movimiento/)).toBeTruthy();
    expect(screen.getByText('Desactivado')).toBeTruthy();
    expect(screen.getByText('Sin correos en 30 días')).toBeTruthy();
  });

  test('HealthLine marca los errores', () => {
    render(<HealthLine health={{ read: 3, transactions: 1, no_transaction: 1, errors: 1 }} />);
    expect(screen.getByText(/1 con error/)).toBeTruthy();
  });

  test('un remitente oculto no se puede agregar; uno visible sí, al banco elegido', () => {
    const onPromote = jest.fn();
    const data = {
      min_users: 5,
      senders: [
        { email: 'j***@gmail.com', masked: true, users: 1, health: { read: 0 } },
        { email: 'pagos@nequi.com.co', masked: false, users: 2, bank_name: null, catalog_bank: null, health: { read: 4, transactions: 4, no_transaction: 0, errors: 0 } },
        { email: 'davibankinforma@davibank.com', masked: false, users: 1, in_catalog_as: 'Davibank', health: { read: 0 } },
      ],
    };
    render(<UserSendersPanel data={data} banks={[bank]} onPromote={onPromote} />);
    expect(screen.getByText('Oculto')).toBeTruthy();
    expect(screen.getByText('Ya está en Davibank')).toBeTruthy();
    const buttons = screen.getAllByRole('button', { name: 'Agregar al catálogo' });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Banco para pagos@nequi.com.co'), { target: { value: '3' } });
    fireEvent.click(buttons[0]);
    expect(onPromote).toHaveBeenCalledWith(3, 'pagos@nequi.com.co');
  });

  test('la hoja agrega un remitente y desactiva otro', async () => {
    const api = {
      addCatalogSender: jest.fn().mockResolvedValue({ id: 5 }),
      updateCatalogSender: jest.fn().mockResolvedValue(null),
    };
    const onChanged = jest.fn().mockResolvedValue(undefined);
    render(<BankSheet bank={bank} onClose={() => {}} onChanged={onChanged} api={api} />);
    fireEvent.change(screen.getByPlaceholderText('alertas@banco.com.co'), { target: { value: 'nuevo@nequi.com.co' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => expect(api.addCatalogSender).toHaveBeenCalledWith(3, 'nuevo@nequi.com.co', ''));
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(api.updateCatalogSender).toHaveBeenCalledWith(3, 1, false, null));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2));
  });

  test('los errores de la API se dicen en español', () => {
    expect(apiError({ response: { status: 409 } })).toMatch(/Ya existe/);
    expect(apiError({ response: { status: 400, data: { messages: ['invalid sender: one email address'] } } })).toMatch(/un solo correo/);
    expect(apiError({ response: { status: 400, data: { messages: ['invalid logo: a PNG, WebP or SVG of up to 100 KB'] } } })).toMatch(/100 KB/);
  });
});
