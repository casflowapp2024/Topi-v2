import axios from 'axios';

// "¿Qué le falta a Topi?" (plan/27 §E)
const base = () => process.env.REACT_APP_API_URL;
const config = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    Accept: 'application/json',
  },
});
const unwrap = (res) => res?.data?.data;

export const FEEDBACK_MAX = 500;

export const sendFeedback = async (text, contactOk) =>
  unwrap(await axios.post(`${base()}/feedback`, { text, contact_ok: contactOk, app_version: 'web' }, config()));

// Panel admin (auditado): { items: [{ id, user, text, contact_ok, created_at, read_at }], unread }
export const getAdminFeedback = async (unreadOnly) =>
  unwrap(await axios.get(`${base()}/admin/feedback${unreadOnly ? '?unread=true' : ''}`, config()));

export const markFeedbackRead = async (id) =>
  unwrap(await axios.post(`${base()}/admin/feedback/${encodeURIComponent(id)}/read`, {}, config()));
