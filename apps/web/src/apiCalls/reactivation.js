import axios from 'axios';

// Reactivación personal (plan/27 §G): una persona por llamada, nunca masivo. Admin y auditado.
const base = () => process.env.REACT_APP_API_URL;
const config = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
  },
});
const unwrap = (res) => res?.data?.data;
const path = (userId) => `${base()}/admin/users/${encodeURIComponent(userId)}/reactivation`;

// { allowed, reason, draft: { subject, body }, founder, last_sent_at, sent_today, daily_limit }
export const getReactivation = async (userId) => unwrap(await axios.get(path(userId), config()));

// { to, subject, html, text }: el correo final, solo para el admin
export const previewReactivation = async (userId, draft) => unwrap(await axios.post(`${path(userId)}/preview`, draft, config()));

export const sendReactivation = async (userId, draft) => unwrap(await axios.post(path(userId), draft, config()));
