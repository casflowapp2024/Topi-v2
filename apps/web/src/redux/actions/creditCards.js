import axios from 'axios';

// Tarjetas de crédito: términos (cupo, corte, pago, tasa) y su estado de hoy (deuda, disponible,
// último corte, lo que falta pagar y la fecha límite). Montos como string decimal.

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

export const save_credit_card = (accountId, { creditLimit, statementDay, dueDay, interestRateEA }) =>
    call(() => axios.put(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/credit-card`, JSON.stringify({
        credit_limit: creditLimit === '' || creditLimit === null || creditLimit === undefined ? null : String(creditLimit),
        statement_day: statementDay ? Number(statementDay) : null,
        due_day: dueDay ? Number(dueDay) : null,
        interest_rate_ea: interestRateEA === '' || interestRateEA === null || interestRateEA === undefined ? null : String(interestRateEA),
    }), authConfig()));

// Estado de todas las tarjetas abiertas del usuario; null si falló
export const fetch_credit_cards = async () => {
    const result = await call(() => axios.get(`${process.env.REACT_APP_API_URL}/analysis/credit-cards`, authConfig()));
    return result.ok ? (result.data || []) : null;
};
