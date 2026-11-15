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
//   supported_banks: [...], samples_address }
export const getReadingStatus = async () => unwrap(await axios.get(`${base()}/email/status`, config()));

// { steps: [{ id, done }], complete, pending_review }
export const getOnboardingStatus = async () => unwrap(await axios.get(`${base()}/onboarding/status`, config()));

// Devuelve el buzón del equipo al que reenviar un correo del banco (la app nunca guarda ese correo)
export const requestBankSample = async (bankId) =>
  unwrap(await axios.post(`${base()}/banks/sample-request`, bankId ? { bank_id: bankId } : {}, config()))?.address;

// Lista pública (sin sesión) de los bancos que Topi lee: landing
export const getPublicBanks = async () => unwrap(await axios.get(`${base()}/public/banks`))?.banks || [];
