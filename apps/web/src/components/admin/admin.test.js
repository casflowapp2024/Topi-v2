import { render, screen } from '@testing-library/react';

// axios viene en ESM y CRA no lo transforma en jest; estos componentes no llaman a la API en las pruebas.
jest.mock('axios', () => {
  const noop = { use() {} };
  const api = { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn(), interceptors: { request: noop, response: noop } };
  return { __esModule: true, default: { ...api, create: () => api } };
});
import { fillDays, fmtPct, fmtInt, pct, BarList, SimpleTable } from './AdminUi';
import { FounderBadge, SEGMENTS } from './AdminUsers';

describe('panel admin: helpers', () => {
  test('fillDays rellena con 0 los días sin fila y respeta el último día', () => {
    const rows = fillDays({ tx_auto: [{ day: '2026-11-09', value: 4 }], tx_manual: [] }, ['tx_auto', 'tx_manual'], 3, '2026-11-10');
    expect(rows).toEqual([
      { day: '2026-11-08', tx_auto: 0, tx_manual: 0 },
      { day: '2026-11-09', tx_auto: 4, tx_manual: 0 },
      { day: '2026-11-10', tx_auto: 0, tx_manual: 0 },
    ]);
  });

  test('porcentajes y enteros en es-CO; sin total no hay porcentaje', () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(1, 0)).toBeNull();
    expect(fmtPct(null)).toBe('—');
    expect(fmtPct(12.34)).toMatch(/^12,3\s%$/);
    expect(fmtInt(12345)).toBe('12.345');
  });

  test('BarList muestra cada nombre con su valor y un vacío si no hay datos', () => {
    const { rerender } = render(<BarList items={[{ name: 'Comida', value: 7 }]} />);
    expect(screen.getByText('Comida')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
    rerender(<BarList items={[]} empty="Ningún nombre con 5 o más usuarios" />);
    expect(screen.getByText('Ningún nombre con 5 o más usuarios')).toBeTruthy();
  });

  test('SimpleTable usa encabezados de columna', () => {
    render(<SimpleTable rows={[{ name: 'Otros', users: 60 }]} columns={[{ key: 'name', label: 'Categoría' }, { key: 'users', label: 'Usuarios', align: 'right' }]} />);
    expect(screen.getByRole('columnheader', { name: 'Categoría' })).toBeTruthy();
    expect(screen.getByRole('cell', { name: '60' })).toBeTruthy();
  });
});

describe('panel admin: usuarios', () => {
  test('la insignia de fundador distingue confirmado, elegible y ninguno', () => {
    const { rerender } = render(<FounderBadge row={{ founder_eligible: true, founder_confirmed_at: '2026-11-11T10:00:00Z' }} />);
    expect(screen.getByText('Confirmado')).toBeTruthy();
    rerender(<FounderBadge row={{ founder_eligible: true, founder_confirmed_at: null }} />);
    expect(screen.getByText('Elegible')).toBeTruthy();
    rerender(<FounderBadge row={{ founder_eligible: false }} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  test('los filtros son los mismos segmentos que acepta la API', () => {
    expect(SEGMENTS.map((s) => s.id)).toEqual(['', 'active7', 'active30', 'active90', 'inactive90', 'no_connection', 'broken']);
  });
});
