import axios from 'axios';
import {
    GET_FINANCIAL_REPORT_SUCCESS,
    GET_FINANCIAL_REPORT_FAIL,
    GET_BALANCE_HISTORY_SUCCESS,
    GET_BALANCE_HISTORY_FAIL,
    GET_EXPENSES_REPORT_SUCCESS,
    GET_EXPENSES_REPORT_FAIL,
    GET_ACCOUNT_BALANCE_SUCCESS,
    GET_ACCOUNT_BALANCE_FAIL,
    GET_SAVINGS_ACCOUNTS_SUCCESS,
    GET_SAVINGS_ACCOUNTS_FAIL,
    SET_HISTORY_DASH_SUCCESS,
    SET_HISTORY_DASH_FAIL,
    LOGOUT,
    SET_ANOTHER_MONTH,
    SET_ANOTHER_YEAR,
    SET_DASH_CATEGORY_ACTIVATED,
    GET_HISTORY_CATEGORY_BY_MONTH_SUCCESS,
    GET_HISTORY_CATEGORY_BY_MONTH_FAIL,
    SET_DASH_ACCOUNT_ACTIVATED,
    GET_ACCOUNT_STATUS_PERIOD_SUCCESS,
    GET_ACCOUNT_STATUS_PERIOD_FAIL,
    SET_INIDATE_ACCOUNT_ACTIVATED,
    SET_ENDDATE_ACCOUNT_ACTIVATED,
    GET_HISTORY_ACCOUNTS_BY_MONTH_SUCCESS,
    GET_HISTORY_ACCOUNTS_BY_MONTH_FAIL
} from './types';

import { formatDate } from '../../components/helpers';

export const get_financial_report = (mes, year) => async dispatch => {


    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    const getDateString = (year, month) => {
        // Create a date with the given year and month (note: month is 0-based in JS)
        const date = new Date(year, month - 1, 1);

        // Format it to YYYY-MM-DD
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    };

    const dateString = getDateString(year, mes);

    console.log("dateString", dateString);

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/financial-report?date=${dateString}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_FINANCIAL_REPORT_SUCCESS,
                payload: res.data
            });
            return true
        } else if (res.status === 401) {
            dispatch({
                type: LOGOUT
            });
        } else {
            dispatch({
                type: GET_FINANCIAL_REPORT_FAIL
            });
            return false
        }

    } catch (err) {

        dispatch({
            type: GET_FINANCIAL_REPORT_FAIL
        });
        return false
    }
}

export const get_balance_history = (filter) => async dispatch => {


    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    const body = JSON.stringify({
        "filter": filter
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/balance-history`, body, config);
        if (res.status === 200) {
            dispatch({
                type: GET_BALANCE_HISTORY_SUCCESS,
                payload: res.data
            });
            return true
        } else if (res.status === 401) {

            dispatch({
                type: LOGOUT
            });
        } else {
            dispatch({
                type: GET_BALANCE_HISTORY_FAIL
            });
            return false
        }
    } catch (err) {

        dispatch({
            type: GET_BALANCE_HISTORY_FAIL
        });
        return false
    }
}

export const get_expenses_report = (date, sort_by = 'amount') => async dispatch => {
    const config = {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    const body = JSON.stringify({
        "date_filter": date,
        "sort_by": sort_by
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/categories-report`, body, config);
        if (res.status === 200) {
            dispatch({
                type: GET_EXPENSES_REPORT_SUCCESS,
                payload: res.data
            });
            return true
        } else if (res.status === 401) {
            dispatch({
                type: LOGOUT
            });
        } else {
            dispatch({
                type: GET_EXPENSES_REPORT_FAIL
            });
            return false
        }

    } catch (err) {
        dispatch({
            type: GET_EXPENSES_REPORT_FAIL
        });
        return false
    }
}

export const get_savings_account = () => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/accounts-balance`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_SAVINGS_ACCOUNTS_SUCCESS,
                payload: res.data
            });
            return true
        } else if (res.status === 401) {
            dispatch({
                type: LOGOUT
            });
        } else {
            dispatch({
                type: GET_SAVINGS_ACCOUNTS_FAIL
            });
            return false
        }

    } catch (err) {

        dispatch({
            type: GET_SAVINGS_ACCOUNTS_FAIL
        });
        return false
    }
}


export const set_another_month = (month) => async dispatch => {

    dispatch({
        type: SET_ANOTHER_MONTH,
        payload: month
    });
    return true

}

export const set_another_year = (year) => async dispatch => {
    console.log("accion set_another_year", year);

    dispatch({
        type: SET_ANOTHER_YEAR,
        payload: year
    });
    return true

}

//category dashboard
export const get_history_dash = (date) => async dispatch => {


    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/financial-analysis?date=${date}`, config);
        if (res.status === 200) {
            dispatch({
                type: SET_HISTORY_DASH_SUCCESS,
                payload: res.data
            });
            return true
        } else {
            dispatch({
                type: SET_HISTORY_DASH_FAIL
            });
            return false
        }
    } catch (err) {

        dispatch({
            type: SET_HISTORY_DASH_FAIL
        });
        return false
    }
}

export const set_dash_category_activated = (category) => async dispatch => {

    dispatch({
        type: SET_DASH_CATEGORY_ACTIVATED,
        payload: category
    });
    return true

}

export const get_history_category_by_month = (category_id, date) => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/category-analysis?=&category_id=${category_id}&date=${date}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_HISTORY_CATEGORY_BY_MONTH_SUCCESS,
                payload: res.data
            });
            return true
        } else {
            dispatch({
                type: GET_HISTORY_CATEGORY_BY_MONTH_FAIL
            });
            return false
        }
    } catch (err) {

        dispatch({
            type: GET_HISTORY_CATEGORY_BY_MONTH_FAIL
        });
        return false
    }
}

//acountts dashboard
export const set_dash_account_activated = (account) => async dispatch => {

    console.log("action set account activated:", account);

    dispatch({
        type: SET_DASH_ACCOUNT_ACTIVATED,
        payload: account
    });
    return true

}

export const set_init_date_account_activated = (date) => async dispatch => {

    dispatch({
        type: SET_INIDATE_ACCOUNT_ACTIVATED,
        payload: date
    });
    return true

}

export const set_end_date_account_activated = (date) => async dispatch => {
    console.log("action set end date:", date);
    dispatch({
        type: SET_ENDDATE_ACCOUNT_ACTIVATED,
        payload: date
    });
    return true

}


export const get_accounts_status_by_period = (start, end, accounts_type, accounts) => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };
    const body = JSON.stringify({
        "start": start,
        "end": end,
        "accounts_type": accounts_type,
        "accounts": accounts
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/analysis/accounts-report`, body, config);
        if (res.status === 200) {
            dispatch({
                type: GET_ACCOUNT_STATUS_PERIOD_SUCCESS,
                payload: res.data
            });
            return true
        } else {
            dispatch({
                type: GET_ACCOUNT_STATUS_PERIOD_FAIL
            });
            return false
        }
    } catch (err) {

        dispatch({
            type: GET_ACCOUNT_STATUS_PERIOD_FAIL
        });
        return false
    }
}

export const get_history_accounts_by_month = (date, account_id) => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/analysis/account-analysis?account_id=${account_id}&date=${date}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_HISTORY_ACCOUNTS_BY_MONTH_SUCCESS,
                payload: res.data
            });
            return true
        } else {
            dispatch({
                type: GET_HISTORY_ACCOUNTS_BY_MONTH_FAIL
            });
            return false
        }
    } catch (err) {

        dispatch({
            type: GET_HISTORY_ACCOUNTS_BY_MONTH_FAIL
        });
        return false
    }
}
