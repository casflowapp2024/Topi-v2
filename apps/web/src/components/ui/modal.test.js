// ui/Modal (diálogo común) y ui/Field (campos de formulario).
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from './Modal';
import Sheet from './Sheet';
import Field, { Input, Select } from './Field';
import Button from './Button';

global.IS_REACT_ACT_ENVIRONMENT = true;
global.ResizeObserver = global.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };

const mount = async (ui) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => root.render(ui));
  return { el, root, unmount: async () => { await act(async () => root.unmount()); el.remove(); } };
};
const dialog = () => document.querySelector('[role=dialog]');
const esc = async () => act(async () => {
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
});

const Harness = ({ dismissible = true, onClose = () => {} }) => {
  const [open, setOpen] = useState(true);
  return (
    <Modal open={open} onClose={() => { onClose(); setOpen(false); }} title="Nuevo presupuesto" description="Para gastos del mes"
      dismissible={dismissible}
      footer={<><Button variant="ghost">Cancelar</Button><Button>Guardar</Button></>}>
      <input aria-label="Monto" />
    </Modal>
  );
};

test('Modal: título, descripción, cerrar con nombre, cuerpo y acciones (secundaria antes que la primaria)', async () => {
  const m = await mount(<Harness />);
  const d = dialog();
  expect(d).not.toBeNull();
  expect(d.getAttribute('aria-modal')).toBe('true');
  expect(d.textContent).toContain('Nuevo presupuesto');
  expect(d.textContent).toContain('Para gastos del mes');
  // el título nombra el diálogo
  const labelledBy = d.getAttribute('aria-labelledby');
  expect(document.getElementById(labelledBy).textContent).toBe('Nuevo presupuesto');
  expect(d.querySelector('button[aria-label="Cerrar"]')).not.toBeNull();
  const actions = [...d.querySelectorAll('footer button')].map(b => b.textContent);
  expect(actions).toEqual(['Cancelar', 'Guardar']);
  // en móvil a lo ancho y la primaria arriba; en PC a la derecha
  expect(d.querySelector('footer').className).toContain('flex-col-reverse');
  expect(d.querySelector('footer').className).toContain('sm:justify-end');
  // panel con el token de superficie, sin hex sueltos
  expect(d.querySelector('.dark\\:bg-surface-raised')).not.toBeNull();
  expect(d.outerHTML).not.toMatch(/#[0-9A-Fa-f]{6}|indigo-/);
  await m.unmount();
});

test('Modal: Esc y el botón Cerrar cierran; el foco queda dentro', async () => {
  const onClose = jest.fn();
  const m = await mount(<Harness onClose={onClose} />);
  expect(dialog().contains(document.activeElement)).toBe(true);
  await esc();
  expect(onClose).toHaveBeenCalledTimes(1);
  await m.unmount();

  const onClose2 = jest.fn();
  const m2 = await mount(<Harness onClose={onClose2} />);
  await act(async () => dialog().querySelector('button[aria-label="Cerrar"]').click());
  expect(onClose2).toHaveBeenCalledTimes(1);
  await m2.unmount();
});

test('Modal y Sheet: si el foco cae fuera (p. ej. el Menu que lo abrió lo devuelve a su botón), vuelve al panel', async () => {
  for (const Kind of [Modal, Sheet]) {
    const outside = document.createElement('button');
    outside.textContent = 'Agregar';
    document.body.appendChild(outside);
    const m = await mount(<Kind open onClose={() => {}} title="x"><input aria-label="Monto" /></Kind>);
    await act(async () => { outside.focus(); });
    expect(dialog().contains(document.activeElement)).toBe(true);
    await m.unmount();
    outside.remove();
  }
});

test('Modal no descartable (onboarding): Esc no cierra y no hay botón Cerrar', async () => {
  const onClose = jest.fn();
  const m = await mount(<Harness dismissible={false} onClose={onClose} />);
  expect(dialog().querySelector('button[aria-label="Cerrar"]')).toBeNull();
  await esc();
  expect(onClose).not.toHaveBeenCalled();
  expect(dialog()).not.toBeNull();
  await m.unmount();
});

test('Modal: tamaños de PC', async () => {
  const sizes = { sm: 'sm:max-w-sm', lg: 'sm:max-w-lg', full: 'sm:max-w-[1168px]' };
  for (const [size, cls] of Object.entries(sizes)) {
    const m = await mount(<Modal open onClose={() => {}} title="x" size={size}>y</Modal>);
    expect(dialog().querySelector('[id^="headlessui-dialog-panel"]').className).toContain(cls);
    await m.unmount();
  }
});

test('Field: la etiqueta nombra el control; la ayuda y el error lo describen; el error lleva ícono y texto', async () => {
  const m = await mount(
    <form>
      <Field label="Nombre" help="Como aparece en tu banco"><Input placeholder="Nómina" /></Field>
      <Field label="Moneda" error="Elige una moneda" required><Select><option>COP</option></Select></Field>
    </form>
  );
  const input = m.el.querySelector('input');
  const label = m.el.querySelector(`label[for="${input.id}"]`);
  expect(label.textContent).toBe('Nombre');
  expect(document.getElementById(input.getAttribute('aria-describedby')).textContent).toBe('Como aparece en tu banco');
  expect(input.getAttribute('aria-invalid')).toBeNull();
  expect(input.className).toContain('rounded-xl');
  expect(input.className).toContain('focus:ring-topi-500');
  expect(input.className).toContain('dark:bg-gray-900');

  const select = m.el.querySelector('select');
  expect(select.getAttribute('aria-invalid')).toBe('true');
  expect(select.className).toContain('border-status-crit');
  const err = document.getElementById(select.getAttribute('aria-describedby'));
  expect(err.getAttribute('role')).toBe('alert');
  expect(err.textContent).toBe('Elige una moneda');
  expect(err.querySelector('svg')).not.toBeNull();
  expect(err.className).toContain('text-status-crit-text');
  expect(m.el.querySelector(`label[for="${select.id}"]`).textContent).toContain('Moneda');
  await m.unmount();
});
