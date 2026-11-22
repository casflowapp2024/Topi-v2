import axios from 'axios';

// Catálogo de bancos (plan/33). Las rutas /admin/* exigen rol admin y quedan en admin_audit.
const base = () => process.env.REACT_APP_API_URL;
const config = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
  },
});
const unwrap = (res) => res?.data?.data;
const id = (v) => encodeURIComponent(v);

// { banks: [{ id, slug, name, country, color, active, logo_url, users, connected_users, senders: [{ id, email, active, note, health }] }] }
export const getCatalogBanks = async () => unwrap(await axios.get(`${base()}/admin/banks`, config()));

// { senders: [{ email, masked, users, accounts, bank_name, catalog_bank, in_catalog_as, health }], min_users }
export const getUserSenders = async () => unwrap(await axios.get(`${base()}/admin/banks/user-senders`, config()));

export const createCatalogBank = async (bank) => unwrap(await axios.post(`${base()}/admin/banks`, bank, config()));

export const updateCatalogBank = async (bankId, bank) =>
  unwrap(await axios.put(`${base()}/admin/banks/${id(bankId)}`, bank, config()));

export const setCatalogBankActive = async (bankId, active) =>
  unwrap(await axios.post(`${base()}/admin/banks/${id(bankId)}/active`, { active }, config()));

export const addCatalogSender = async (bankId, email, note) =>
  unwrap(await axios.post(`${base()}/admin/banks/${id(bankId)}/senders`, { email, note: note || null }, config()));

export const updateCatalogSender = async (bankId, senderId, active, note) =>
  unwrap(await axios.put(`${base()}/admin/banks/${id(bankId)}/senders/${id(senderId)}`, { active, note: note || null }, config()));

export const uploadCatalogLogo = async (bankId, file) => {
  const form = new FormData();
  form.append('logo', file);
  return unwrap(await axios.put(`${base()}/admin/banks/${id(bankId)}/logo`, form, config()));
};

export const deleteCatalogLogo = async (bankId) =>
  unwrap(await axios.delete(`${base()}/admin/banks/${id(bankId)}/logo`, config()));

// logo_url viene relativo a la API ("/banks/catalog/3/logo?v=..."), sin sesión: sirve en un <img>
export const logoSrc = (logoUrl) => (logoUrl ? `${base() || ''}${logoUrl}` : null);

export const LOGO_MAX_BYTES = 100 * 1024;
export const LOGO_TYPES = ['image/png', 'image/webp', 'image/svg+xml'];
