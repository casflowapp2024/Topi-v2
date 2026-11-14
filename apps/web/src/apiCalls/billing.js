import axios from 'axios';

// Apoyar a Topi (plan/22, N1): un pago único voluntario. El front solo abre el checkout y LEE el estado;
// el pago lo aprueba la API (webhook firmado o consulta del servidor a Mercado Pago), nunca este código.
const base = () => process.env.REACT_APP_API_URL;
const config = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
  },
});

const unwrap = (res) => res?.data?.data;

// La configuración no cambia durante la sesión: una sola llamada por carga de la app
let configPromise = null;
export const getBillingConfig = () => {
  if (!configPromise) {
    configPromise = axios.get(`${base()}/billing/config`, config())
      .then(unwrap)
      .catch((err) => {
        configPromise = null;
        throw err;
      });
  }
  return configPromise;
};
// solo pruebas
export const resetBillingConfig = () => { configPromise = null; };

/** Crea el pago y devuelve { payment_id, checkout_url }. amount: pesos enteros como texto ("20000"). */
export const startSupport = async (amount) =>
  unwrap(await axios.post(`${base()}/billing/support`, { amount: String(amount) }, config()));

/** Estado de un pago propio: { id, amount, currency, status, ... } */
export const getPayment = async (id) =>
  unwrap(await axios.get(`${base()}/billing/payments/${encodeURIComponent(id)}`, config()));

/** Sección "Dinero" del panel admin */
export const getAdminMoney = async () => unwrap(await axios.get(`${base()}/admin/money`, config()));

export const PENDING_STATUSES = ['created', 'pending'];
