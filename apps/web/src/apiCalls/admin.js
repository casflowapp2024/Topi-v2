import axios from 'axios';

// Llamadas del panel admin (plan/25). Solo lectura de agregados, salvo fundadores y recalcular.
// La API exige rol admin y audita cada acceso; aquí no se guarda nada en Redux: es un panel interno.
const base = () => process.env.REACT_APP_API_URL;
const config = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
  },
});

const unwrap = (res) => res?.data?.data;

export const ADMIN_SECTIONS = ['summary', 'activation', 'cohorts', 'reading', 'quality', 'catalog', 'costs'];

export const getAdminMetric = async (section) =>
  unwrap(await axios.get(`${base()}/admin/metrics/${section}`, config()));

export const getAdminUsers = async ({ segment = '', q = '', limit = 50, offset = 0 } = {}) => {
  const params = new URLSearchParams();
  if (segment) params.set('segment', segment);
  if (q) params.set('q', q);
  params.set('limit', limit);
  params.set('offset', offset);
  return unwrap(await axios.get(`${base()}/admin/users?${params.toString()}`, config()));
};

export const refreshAdminMetrics = async () =>
  unwrap(await axios.post(`${base()}/admin/metrics/refresh`, {}, config()));

export const getFounders = async () => unwrap(await axios.get(`${base()}/admin/founders`, config()));

export const previewConfirmActive = async () =>
  unwrap(await axios.post(`${base()}/admin/founders/confirm-active?dry_run=true`, {}, config()));

export const confirmActiveFounders = async () =>
  unwrap(await axios.post(`${base()}/admin/founders/confirm-active`, {}, config()));

export const confirmFounder = async (id) =>
  unwrap(await axios.post(`${base()}/admin/founders/${encodeURIComponent(id)}/confirm`, {}, config()));

export const unconfirmFounder = async (id) =>
  unwrap(await axios.delete(`${base()}/admin/founders/${encodeURIComponent(id)}/confirm`, config()));

// 403 = la sesión no es de un admin
export const isForbidden = (err) => err?.response?.status === 403;
