import axios from 'axios';

// Cambios de moneda: de una cuenta con movimientos (re-etiquetar o convertir, con vista previa y
// deshacer), cerrar y reabrir cuentas, y la moneda base del usuario. Montos como string decimal.
// Todas devuelven { ok, data, status, messages }.

const authConfig = () => ({
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
});

const call = async (request) => {
    try {
        const res = await request();
        return { ok: res.status >= 200 && res.status < 300, data: res.data?.data, status: res.status };
    } catch (err) {
        return { ok: false, status: err.response?.status, messages: err.response?.data?.messages };
    }
};

const url = (path) => `${process.env.REACT_APP_API_URL}${path}`;

// mode: 'relabel' (los montos ya estaban en la moneda nueva) | 'convert'; apply false = vista previa
export const change_account_currency = (accountId, { currency, mode, apply = false }) =>
    call(() => axios.post(url(`/accounts/${accountId}/currency`), JSON.stringify({ currency, mode, apply }), authConfig()));

export const fetch_currency_changes = (accountId) =>
    call(() => axios.get(url(`/accounts/${accountId}/currency-changes`), authConfig()));

export const undo_currency_change = (accountId, changeId) =>
    call(() => axios.post(url(`/accounts/${accountId}/currency-changes/${changeId}/undo`), null, authConfig()));

export const close_account = (accountId) =>
    call(() => axios.post(url(`/accounts/${accountId}/close`), null, authConfig()));

export const reopen_account = (accountId) =>
    call(() => axios.post(url(`/accounts/${accountId}/reopen`), null, authConfig()));

export const change_base_currency = ({ currency, apply = false }) =>
    call(() => axios.post(url('/user-extra/base-currency'), JSON.stringify({ currency, apply }), authConfig()));
