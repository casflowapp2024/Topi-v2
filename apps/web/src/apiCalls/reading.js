import axios from 'axios';

// Estado de lectura y bienvenida (plan/27 §B y §C). Todo sale de la API: el front no calcula pasos ni estados.
const base = () => process.env.REACT_APP_API_URL;
const config = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
  },
});

const unwrap = (res) => res?.data?.data;

// { connections: [{ id, provider, reading, last_read_at, emails_processed, transactions_created, banks, ... }],
//   supported_banks: [...] }. Cada banco trae sender, reading (reading | ok | no_emails | unreadable), found y
//   account_ids (plan/30)
export const getReadingStatus = async () => unwrap(await axios.get(`${base()}/email/status`, config()));

// { steps: [{ id, done }], complete, pending_review }
export const getOnboardingStatus = async () => unwrap(await axios.get(`${base()}/onboarding/status`, config()));

// Corrige el remitente de un banco y vuelve a leer sus cuentas (plan/30): el usuario dice desde qué correo le
// escribe su banco; Topi leerá solo ese remitente
export const updateBankSender = async (bank, sender, accountIds) => {
  await axios.put(`${base()}/banks/${bank.id}`, { name: bank.name, email: sender }, config());
  if (accountIds?.length) await axios.post(`${base()}/email/read`, { account_ids: accountIds }, config());
};

// Lista pública (sin sesión) de los bancos que Topi lee: landing
export const getPublicBanks = async () => unwrap(await axios.get(`${base()}/public/banks`))?.banks || [];
