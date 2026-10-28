import axios from 'axios';
import {
    GET_CURRENCIES_SUCCESS,
    GET_NET_WORTH_SUCCESS,
    GET_NET_WORTH_FAIL,
    SET_NET_WORTH_LOADING,
} from './types';
import { setCurrencies } from '../../components/helpers';

// Multimoneda: monedas, cotizaciones, patrimonio y transferencias entre cuentas.
// Los montos y tasas llegan como string decimal: solo se convierten a número para mostrarlos.

const authConfig = () => ({
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
});

export const get_currencies = () => async dispatch => {
    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/currencies`, authConfig());
        if (res.status === 200) {
            setCurrencies(res.data.data);
            dispatch({ type: GET_CURRENCIES_SUCCESS, payload: res.data.data });
        }
    } catch (err) {
        // sin la lista quedan las monedas por defecto de helpers.js
    }
};

export const get_net_worth = () => async dispatch => {
    dispatch({ type: SET_NET_WORTH_LOADING });
    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/net-worth`, authConfig());
        if (res.status === 200) {
            dispatch({ type: GET_NET_WORTH_SUCCESS, payload: res.data.data });
            return;
        }
        dispatch({ type: GET_NET_WORTH_FAIL });
    } catch (err) {
        dispatch({ type: GET_NET_WORTH_FAIL });
    }
};

// Cotización 1 from = rate to (hoy si no hay fecha). Devuelve { rate, source, date } o null.
export const fetch_fx_rate = async (from, to, date) => {
    if (!from || !to) return null;
    if (from === to) return { rate: '1', source: 'identity', date };
    try {
        const params = new URLSearchParams({ from, to });
        if (date) params.set('date', date);
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/fx/rate?${params}`, authConfig());
        return res.status === 200 ? res.data.data : null;
    } catch (err) {
        return null;
    }
};

// Transferencia entre cuentas. Devuelve { ok, data, status }.
export const create_transfer = async ({
    fromAccountId, toAccountId, amountSent, amountReceived, date, categoryId, description,
}) => {
    const body = JSON.stringify({
        from_account_id: parseInt(fromAccountId),
        to_account_id: parseInt(toAccountId),
        amount_sent: String(amountSent),
        amount_received: String(amountReceived),
        date,
        category_id: parseInt(categoryId),
        description,
    });
    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/transactions/transfer`, body, authConfig());
        return { ok: res.status === 201, data: res.data.data, status: res.status };
    } catch (err) {
        return { ok: false, status: err.response?.status, messages: err.response?.data?.messages };
    }
};
