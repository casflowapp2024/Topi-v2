import axios from 'axios';

// Números que reconocen una cuenta en los correos del banco (plan/32): los que escribió el usuario y los que
// Topi aprendió de sus correcciones. Una cuenta puede tener varios (tarjeta adicional o renovada).

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

// [{id, digits, source: 'user' | 'learned', created_at}] o null si falló
export const fetch_account_identifiers = async (accountId) => {
    const result = await call(() => axios.get(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/identifiers`, authConfig()));
    return result.ok ? (result.data || []) : null;
};

// { ok, status, data }: 409 = los dígitos ya son de otra cuenta del banco
export const add_account_identifier = (accountId, digits) =>
    call(() => axios.post(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/identifiers`,
        JSON.stringify({ digits }), authConfig()));

export const delete_account_identifier = (accountId, identifierId) =>
    call(() => axios.delete(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/identifiers/${identifierId}`, authConfig()));
