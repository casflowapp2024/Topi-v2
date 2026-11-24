import reducer from './cashflow';
import { UPDATE_USER_TRANSACTION_LOCAL, UPDATE_USER_TRANSACTION_LOCAL_DASH } from '../actions/types';

// Editar desde Presupuestos sin haber abierto Transacciones: la lista local es null y no debe romper
// (antes lanzaba y el detalle no recargaba la vista: el cambio de categoría "no se veía")
test('la actualización local tolera listas que aún no se cargaron', () => {
  const base = reducer(undefined, { type: '@@init' });
  const st = { ...base, user_transactions: { ...base.user_transactions, items: null }, user_transactions_dash: { ...base.user_transactions_dash, items: null } };
  expect(() => reducer(st, { type: UPDATE_USER_TRANSACTION_LOCAL, payload: { id: 1, category: { id: 2 } } })).not.toThrow();
  expect(() => reducer(st, { type: UPDATE_USER_TRANSACTION_LOCAL_DASH, payload: { id: 1 } })).not.toThrow();
  const loaded = { ...st, user_transactions: { ...st.user_transactions, items: [{ id: 1, category: { id: 9 } }, { id: 3 }] } };
  const next = reducer(loaded, { type: UPDATE_USER_TRANSACTION_LOCAL, payload: { id: 1, category: { id: 2 } } });
  expect(next.user_transactions.items[0].category.id).toBe(2);
});
