import axios from 'axios';

// Valoraciones de cuentas de inversión ("el día X valía Y") y su rendimiento. El saldo de una
// inversión sigue su última valoración más los movimientos posteriores; las valoraciones no son
// ingresos ni gastos. Montos como string decimal, en la moneda de la cuenta.

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

export const fetch_valuations = async (accountId) => {
    const result = await call(() => axios.get(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/valuations`, authConfig()));
    return result.ok ? (result.data || []) : null;
};

// Crea la valoración del día o reemplaza la que ya había ese día
export const save_valuation = (accountId, { date, value, note }) =>
    call(() => axios.post(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/valuations`,
        JSON.stringify({ date, value: String(value), note: note || '' }), authConfig()));

export const delete_valuation = (accountId, valuationId) =>
    call(() => axios.delete(`${process.env.REACT_APP_API_URL}/accounts/${accountId}/valuations/${valuationId}`, authConfig()));

// Rendimiento de las inversiones en [start, end] (YYYY-MM-DD). Devuelve { start, end, accounts } o null.
export const fetch_investments = async (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const result = await call(() => axios.get(`${process.env.REACT_APP_API_URL}/analysis/investments?${params}`, authConfig()));
    return result.ok ? result.data : null;
};
