import axios from 'axios';

// Transferencias entre cuentas propias: ligar una transacción con su otra pata, desligar y la
// bandeja de posibles transferencias. Las patas ligadas no cuentan como ingreso ni gasto (sí en
// saldos, categorías y presupuestos). Devuelven { ok, data, status } como create_transfer.

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

// Liga la transacción con otra existente (counterpartTransactionId) o crea la otra pata en
// counterpartAccountId; counterpartAmount solo entre monedas (sin él usa la tasa del día).
export const link_transfer = (transactionId, { counterpartTransactionId, counterpartAccountId, counterpartAmount } = {}) => {
    const body = {};
    if (counterpartTransactionId) body.counterpart_transaction_id = parseInt(counterpartTransactionId);
    if (counterpartAccountId) body.counterpart_account_id = parseInt(counterpartAccountId);
    if (counterpartAmount !== undefined && counterpartAmount !== null) body.counterpart_amount = String(counterpartAmount);
    return call(() => axios.post(`${process.env.REACT_APP_API_URL}/transactions/${transactionId}/transfer`,
        JSON.stringify(body), authConfig()));
};

// Pago de tarjeta que no salió de una cuenta del usuario: deja de preguntar por la otra pata
export const dismiss_counterpart = (transactionId) =>
    call(() => axios.post(`${process.env.REACT_APP_API_URL}/transactions/${transactionId}/transfer/dismiss`, null, authConfig()));

// La cuenta que más veces ha pagado a esta (null si no hay historia)
export const fetch_counterpart_suggestion = async (transactionId) => {
    const result = await call(() => axios.get(
        `${process.env.REACT_APP_API_URL}/transactions/${transactionId}/transfer/suggestion`, authConfig()));
    return result.ok ? (result.data?.account_id ?? null) : null;
};

export const unlink_transfer = (groupId) =>
    call(() => axios.delete(`${process.env.REACT_APP_API_URL}/transactions/transfer/${groupId}`, authConfig()));

export const fetch_transfer_candidates = async (limit = 200) => {
    const result = await call(() => axios.get(
        `${process.env.REACT_APP_API_URL}/transactions/transfer/candidates?limit=${limit}`, authConfig()));
    return result.ok ? (result.data || []) : null;
};

export const dismiss_transfer_candidate = (outTransactionId, inTransactionId) =>
    call(() => axios.post(`${process.env.REACT_APP_API_URL}/transactions/transfer/dismiss`, JSON.stringify({
        out_transaction_id: parseInt(outTransactionId),
        in_transaction_id: parseInt(inTransactionId),
    }), authConfig()));
