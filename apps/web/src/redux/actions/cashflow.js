import axios from 'axios';
import {
    GET_USER_CATEGORIES_SUCCESS,
    GET_USER_CATEGORIES_FAIL,
    CREATE_USER_CATEGORY_SUCCESS,
    CREATE_USER_CATEGORY_FAIL,
    DELETE_USER_CATEGORY_SUCCESS,
    DELETE_USER_CATEGORY_FAIL,
    UPDATE_USER_CATEGORY_SUCCESS,
    UPDATE_USER_CATEGORY_FAIL,


    CREATE_NEW_USER_ACCOUNT_SUCCESS,
    CREATE_NEW_USER_ACCOUNT_FAIL,
    GET_USER_ACCOUNTS_SUCCESS,
    GET_USER_ACCOUNTS_FAIL,
    DELETE_USER_ACCOUNT_SUCCESS,
    DELETE_USER_ACCOUNT_FAIL,
    UPDATE_USER_ACCOUNT_SUCCESS,
    UPDATE_USER_ACCOUNT_FAIL,
    GET_ACCOUNT_TYPES_SUCCESS,
    GET_ACCOUNT_TYPES_FAIL,



    CREATE_USER_TRANSACTION_SUCCESS,
    CREATE_USER_TRANSACTION_FAIL,
    GET_USER_TRANSACTIONS_SUCCESS,
    GET_USER_TRANSACTIONS_FAIL,
    GET_USER_TRANSACTIONS_DASH_SUCCESS,
    GET_USER_TRANSACTIONS_DASH_FAIL,
    DELETE_USER_TRANSACTION_SUCCESS,
    DELETE_USER_TRANSACTION_FAIL,
    UPDATE_USER_TRANSACTION_SUCCESS,
    UPDATE_USER_TRANSACTION_FAIL,
    UPDATE_USER_TRANSACTION_LOCAL,
    UPDATE_TRANS_FILTER,

    UPDATE_USER_TRANSACTION_LOCAL_DASH,
    UPDATE_USER_TRANSACTION_LOCAL_BUDGET,
    UPDATE_USER_TRANSACTION_LOCAL_ACCOUNT,


    COLLAPSE_FIRST_STEPS,


    GET_USER_BALANCES_SUCCESS,
    GET_USER_BALANCES_FAIL,
    LOGOUT,

    GET_BANKS_SUCCESS,
    GET_BANKS_FAIL,
    GET_OFFICIAL_BANKS_SUCCESS,
    GET_OFFICIAL_BANKS_FAIL,
    CREATE_BANK_SUCCESS,
    CREATE_BANK_FAIL,
    UPDATE_BANK_SUCCESS,
    UPDATE_BANK_FAIL,
    DELETE_BANK_SUCCESS,
    DELETE_BANK_FAIL,


    GET_CATEGORY_TRANSACTIONS,
    GET_CATEGORY_TRANSACTIONS_FAIL,

    GET_ACCOUNTS_TRANSACTIONS_SUCCESS,
    GET_ACCOUNTS_TRANSACTIONS_FAIL


} from './types';

import { formatDate, formatDateTimeWithZone, formatToCustomDate, formatToDateFilters, classOfTypeId } from '../../components/helpers';


// categories

export const create_category = (
    name,
    budget,
    emoji,
    income
) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        }
    };

    const body = JSON.stringify({
        name,
        budget,
        emoji,
        income
    });


    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/categories/create`, body, config);

        if (res.status === 201) {
            dispatch({
                type: CREATE_USER_CATEGORY_SUCCESS,
            });
            return { 'res': true, 'id': res.data.data.id }
        } else {
            dispatch({
                type: CREATE_USER_CATEGORY_FAIL
            });
            return { 'res': false, 'id': null, 'messages': res.data.messages[0] }
        }
    } catch (err) {
        dispatch({
            type: CREATE_USER_CATEGORY_FAIL
        });
        return { 'res': false, 'id': null, 'message': err.response.data.messages[0] }
    }
}

export const get_user_categories = (skip, limit) => async dispatch => {
    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/categories/list?skip=${skip}&limit=${50}`, config);
        if (res.status === 200) {


            dispatch({
                type: GET_USER_CATEGORIES_SUCCESS,
                payload: res.data
            });
            return res.data.data.categories

        } else {
            dispatch({
                type: GET_USER_CATEGORIES_FAIL
            });
            return false
        }

    } catch (err) {
        dispatch({
            type: GET_USER_CATEGORIES_FAIL
        });
        return false
    }
}

export const delete_category = (id) => async dispatch => {
    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };
    try {
        const res = await axios.delete(`${process.env.REACT_APP_API_URL}/categories/${id}`, config);
        if (res.status === 200) {
            dispatch({
                type: DELETE_USER_CATEGORY_SUCCESS,
                payload: res.data
            });
            return { 'res': true }
        } else {
            dispatch({
                type: DELETE_USER_CATEGORY_FAIL
            });
            return { 'res': false, 'messages': res.data.messages[0] }
        }

    } catch (err) {
        dispatch({
            type: DELETE_USER_CATEGORY_FAIL
        });
        return { 'res': false, 'messages': err.response.data.messages[0] }
    }
}

export const update_category = (
    cat_id,
    name,
    budget,
    emoji,
    income) => async dispatch => {

        const config = {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        };

        const body = JSON.stringify({
            name,
            budget,
            emoji,
            income
        });

        try {
            const res = await axios.put(`${process.env.REACT_APP_API_URL}/categories/${cat_id}`, body, config);

            if (res.status === 200) {
                dispatch({
                    type: UPDATE_USER_CATEGORY_SUCCESS,
                    payload: res.data
                });
                return { 'res': true }
            } else {
                dispatch({
                    type: UPDATE_USER_CATEGORY_FAIL
                });
                return { 'res': false, 'messages': res.data.messages[0] }
            }

        } catch (err) {

            dispatch({
                type: UPDATE_USER_CATEGORY_FAIL
            });
            return { 'res': false, 'messages': err.response.data.messages[0] }
        }
    }


//accounts

export const get_account_types = (skip, limit) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    //backend online

    /* dispatch({
        type: GET_USER_ACCOUNTS_SUCCESS,
        payload: mockAccounts
    }); */

    //backend offline

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/account-types/list?skip=${skip}&limit=${limit}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_ACCOUNT_TYPES_SUCCESS,
                payload: res.data
            });
        } else if (res.status === 401) {
            dispatch({
                type: LOGOUT
            });
        } else {
            dispatch({
                type: GET_ACCOUNT_TYPES_FAIL
            });
        }

    } catch (err) {
        dispatch({
            type: GET_ACCOUNT_TYPES_FAIL
        });
    }
}

export const get_user_accounts = (skip, limit) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    //backend online

    /* dispatch({
        type: GET_USER_ACCOUNTS_SUCCESS,
        payload: mockAccounts
    }); */

    //backend offline

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/accounts/list?skip=${skip}&limit=${limit}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_USER_ACCOUNTS_SUCCESS,
                payload: res.data
            });
        } else if (res.status === 401) {
            dispatch({
                type: LOGOUT
            });
        } else {
            dispatch({
                type: GET_USER_ACCOUNTS_FAIL
            });
        }

    } catch (err) {
        dispatch({
            type: GET_USER_ACCOUNTS_FAIL
        });
    }
}

export const create_f_account = (
    name,
    last_four_digits,
    type_id,
    bank_id,
    amount,
    automation_email,
    currency // ISO 4217 (COP si no se elige)
) => async (dispatch, getState) => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    let initial_balance
    // las tarjetas (clase credit) guardan el saldo inicial como deuda: negativo
    if (classOfTypeId(type_id, getState().CashFlow.account_types?.items) === 'credit') {
        initial_balance = -amount
    } else {
        initial_balance = amount
    }

    let body = JSON.stringify({
        "name": name,
        "last_four_digits": last_four_digits,
        "type_id": type_id,
        "bank_id": bank_id,
        "initial_balance": initial_balance,
        ...(currency ? { "currency": currency } : {}),
        "email_id": automation_email,
    });

    if (automation_email === "") {
        body = JSON.stringify({
            "name": name,
            "last_four_digits": last_four_digits,
            "type_id": type_id,
            "bank_id": bank_id,
            "initial_balance": initial_balance,
        ...(currency ? { "currency": currency } : {}),
        });
    }


    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/accounts/create`, body, config);

        if (res.status === 201) {

            dispatch({
                type: CREATE_NEW_USER_ACCOUNT_SUCCESS,
            });
            return 201
        } else {
            dispatch({
                type: CREATE_NEW_USER_ACCOUNT_FAIL
            });
            return res.status
        }

    } catch (err) {
        dispatch({
            type: CREATE_NEW_USER_ACCOUNT_FAIL
        });
        return err.status
    }
}



export const delete_account = (id) => async dispatch => {


    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.delete(`${process.env.REACT_APP_API_URL}/accounts/${id}`, config);
        if (res.status === 200) {
            dispatch({
                type: DELETE_USER_ACCOUNT_SUCCESS,
            });
            return true
        } else {
            dispatch({
                type: DELETE_USER_ACCOUNT_FAIL
            });
            return false
        }

    } catch (err) {
        dispatch({
            type: DELETE_USER_ACCOUNT_FAIL
        });
        return false
    }
}


export const update_account = (
    tran_id,
    name,
    type_id,
    last_four_digits,
    bank_id,
    amount,
    automation_email,
    currency // ISO 4217; en la edición solo se manda si cambió
) => async (dispatch, getState) => {


    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    let initial_balance
    // las tarjetas (clase credit) guardan el saldo inicial como deuda: negativo
    if (classOfTypeId(type_id, getState().CashFlow.account_types?.items) === 'credit') {
        initial_balance = -amount
    } else {
        initial_balance = amount
    }

    let body = JSON.stringify({
        "name": name,
        "last_four_digits": last_four_digits,
        "type_id": type_id,
        "bank_id": bank_id,
        "initial_balance": initial_balance,
        ...(currency ? { "currency": currency } : {}),
        "email_id": automation_email,
    });

    if (automation_email === "") {
        body = JSON.stringify({
            "name": name,
            "last_four_digits": last_four_digits,
            "type_id": type_id,
            "bank_id": bank_id,
            "initial_balance": initial_balance,
        ...(currency ? { "currency": currency } : {}),
        });
    }


    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/accounts/${tran_id}`, body, config);

        console.log("res: ", res)

        if (res.status === 200) {
            dispatch({
                type: UPDATE_USER_TRANSACTION_SUCCESS,
                payload: res.data
            });
            return 200
        } else {
            dispatch({
                type: UPDATE_USER_TRANSACTION_FAIL
            });
            return res.status
        }

    } catch (err) {

        dispatch({
            type: UPDATE_USER_TRANSACTION_FAIL
        });
        return err.status
    }
}



///transactions

export const create_transaction = (
    category_id,
    account_id,
    description,
    expense,
    amount,
    date) => async dispatch => {

        const config = {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        };

        const body = JSON.stringify({
            category_id,
            account_id,
            description,
            expense,
            amount,
            date: date
        });

        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL}/transactions/create`, body, config);
            if (res.status === 201) {
                dispatch({
                    type: CREATE_USER_TRANSACTION_SUCCESS,
                    payload: res.data
                });
                return true
            } else {
                dispatch({
                    type: CREATE_USER_TRANSACTION_FAIL
                });
                return false
            }

        } catch (err) {

            dispatch({
                type: CREATE_USER_TRANSACTION_FAIL
            });
            return false
        }
    }

const converToComaSeparated = (listOfValues) => {
    if (Array.isArray(listOfValues) && listOfValues.length > 0) {
        return listOfValues.join(",");
    }
    return "";
};

const buildTransactionParams = ({
    selectedCategories,
    selectedAccounts,
    iniDate,
    endDate,
    keyword,
    expenseFilter,
    orderByFilter,
    automated,
    shouldVerify
}) => {

    console.log("building params with, IniDate Received", iniDate)

    const params = [];
    if (selectedCategories && selectedCategories.length > 0) params.push(`categories=${converToComaSeparated(selectedCategories)}`);
    if (selectedAccounts && selectedAccounts.length > 0) params.push(`accounts=${converToComaSeparated(selectedAccounts)}`);
    if (iniDate) params.push(`init_date=${formatToDateFilters(iniDate)}`);
    if (endDate) params.push(`end_date=${formatToDateFilters(endDate)}`);
    if (keyword) params.push(`keyword=${keyword}`);
    if ((expenseFilter === false) || (expenseFilter === true)) params.push(`expense=${expenseFilter}`);
    if (orderByFilter) params.push(`sort_by=${orderByFilter}`);
    if (automated) params.push(`automated=${automated}`);
    if (shouldVerify) params.push(`should_verify=${shouldVerify}`);

    return params.join("&");
};


export const change_transactions_filter = (
    filters
) => async dispatch => {

    const params = buildTransactionParams(filters);
    dispatch({
        type: UPDATE_TRANS_FILTER,
        payload: {
            categorie_ids: filters.selectedCategories,
            accounts_ids: filters.selectedAccounts,
            iniDate: filters.iniDate,
            endDate: filters.endDate,
            keyword: filters.keyword,
            expence: filters.expenseFilter,
            sortby: filters.orderByFilter,
            automated: filters.automated,
            shouldVerify: filters.shouldVerify,
            params: params
        }
    });
    return params;
};


export const get_user_transactions = (
    skip,
    limit,
    params = "",
    windowContext = ""
) => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    let url_base = `${process.env.REACT_APP_API_URL}/transactions/list?skip=${skip}&limit=${limit}`;
    if ((params && params.length > 0) && (windowContext !== "dash")) {
        url_base = `${process.env.REACT_APP_API_URL}/transactions/list?skip=${skip}&limit=${limit}&${params}`
    }

    try {
        const res = await axios.get(url_base, config);

        if (res.status === 200) {
            if (windowContext === "dash") {
                dispatch({
                    type: GET_USER_TRANSACTIONS_DASH_SUCCESS,
                    payload: res.data
                });
            } else if (windowContext === "budgetCategory") {
                dispatch({
                    type: GET_CATEGORY_TRANSACTIONS,
                    payload: res.data
                });
            } else if (windowContext === "accountsAnalysis") {
                dispatch({
                    type: GET_ACCOUNTS_TRANSACTIONS_SUCCESS,
                    payload: res.data
                });
            } else {
                dispatch({
                    type: GET_USER_TRANSACTIONS_SUCCESS,
                    payload: res.data
                });
            }
            return true
        } else {
            if (windowContext === "dash") {
                dispatch({
                    type: GET_USER_TRANSACTIONS_DASH_FAIL
                });
            } else if (windowContext === "budgetCategory") {
                dispatch({
                    type: GET_CATEGORY_TRANSACTIONS_FAIL
                });
            } else if (windowContext === "accountsAnalysis") {
                dispatch({
                    type: GET_ACCOUNTS_TRANSACTIONS_FAIL
                });
            } else {
                dispatch({
                    type: GET_USER_TRANSACTIONS_FAIL
                });

            }
            return false
        }

    } catch (err) {
        if (windowContext === "dash") {
            dispatch({
                type: GET_USER_TRANSACTIONS_DASH_FAIL
            });
        } else {
            dispatch({
                type: GET_USER_TRANSACTIONS_FAIL
            });

        }
        return false
    }
}


export const update_transaction = (
    tran_id,
    category_id,
    account_id,
    description,
    expense,
    amount,
    date,
    checked,
    should_verify,
    fx_rate // opcional: tasa manual hacia la moneda base (string decimal)
) => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };
    //const formattedDate = formatDateTimeWithZone(date);

    const body = JSON.stringify({
        "category_id": parseInt(category_id),
        "account_id": parseInt(account_id),
        "description": description,
        "expense": expense,
        "amount": amount,
        "date": date,
        "checked": true,
        "should_verify": false,
        ...(fx_rate ? { "fx_rate": String(fx_rate) } : {}),
    });

    console.log("updating transaction")
    console.log(body)


    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/transactions/${tran_id}`, body, config);
        if (res.status === 200) {
            dispatch({
                type: UPDATE_USER_TRANSACTION_SUCCESS,
                payload: res.data
            });
            return true
        } else {
            dispatch({
                type: UPDATE_USER_TRANSACTION_FAIL
            });
            return false
        }

    } catch (err) {

        dispatch({
            type: UPDATE_USER_TRANSACTION_FAIL
        });
        return false
    }
}



export const delete_transaction = (id) => async dispatch => {


    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.delete(`${process.env.REACT_APP_API_URL}/transactions/${id}`, config);

        if (res.status === 200) {
            dispatch({
                type: DELETE_USER_TRANSACTION_SUCCESS,
                payload: res.data
            });
            return true
        } else {
            dispatch({
                type: DELETE_USER_TRANSACTION_FAIL
            });
            return false
        }

    } catch (err) {
        dispatch({
            type: DELETE_USER_TRANSACTION_FAIL
        });
        return false
    }
}


/* export const get_user_dash_balances = () => async dispatch => {
    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `JWT ${localStorage.getItem('access')}`
        }
    };

    //backend offline

    dispatch({
        type: GET_USER_BALANCES_SUCCESS,
        payload: mockBalances
    });

} */

export const update_transaction_local = (transactionId, updatedData, windowContext = "") => dispatch => {
    if (windowContext === "dash") {
        dispatch({
            type: UPDATE_USER_TRANSACTION_LOCAL_DASH,
            payload: {
                id: transactionId,
                ...updatedData  // This will spread all the updated transaction data
            }
        });
    } else if (windowContext === "budgetCategory") {
        dispatch({
            type: UPDATE_USER_TRANSACTION_LOCAL_BUDGET,
            payload: {
                id: transactionId,
                ...updatedData
            }
        });
    } else if (windowContext === "account") {
        dispatch({
            type: UPDATE_USER_TRANSACTION_LOCAL_ACCOUNT,
            payload: {
                id: transactionId,
                ...updatedData
            }
        });
    } else {
        dispatch({
            type: UPDATE_USER_TRANSACTION_LOCAL,
            payload: {
                id: transactionId,
                ...updatedData  // This will spread all the updated transaction data
            }
        });

    }

};



export const set_keep_open_first_steps_false = () => dispatch => {
    dispatch({
        type: COLLAPSE_FIRST_STEPS,
    });
};


//banks

export const get_banks = (skip, limit) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/banks/list?skip=${skip}&limit=${limit}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_BANKS_SUCCESS,
                payload: res.data
            });
            return true

        } else {
            dispatch({
                type: GET_BANKS_FAIL
            });
            return false
        }

    } catch (err) {
        dispatch({
            type: GET_BANKS_FAIL
        });
        return false
    }
}


export const create_personal_bank = (
    name,
    email
) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        }
    };

    const body = JSON.stringify({
        name,
        email
    });


    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/banks/create`, body, config);

        if (res.status === 201) {
            dispatch({
                type: CREATE_BANK_SUCCESS,
            });
            return res.data.data.id
        } else {
            dispatch({
                type: CREATE_BANK_FAIL
            });
            return false
        }

    } catch (err) {
        dispatch({
            type: CREATE_BANK_FAIL
        });
        return false
    }
}

export const delete_personal_bank = (id) => async dispatch => {

    const config = {
        headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    };

    try {
        const res = await axios.delete(`${process.env.REACT_APP_API_URL}/banks/${id}`, config);

        if (res.status === 200) {

            return true
        } else {

            return false
        }

    } catch (err) {

        return false
    }
}

export const update_personal_bank = (
    name,
    email,
    id
) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        }
    };

    const body = JSON.stringify({
        name,
        email
    });


    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/banks/${id}`, body, config);

        if (res.status === 200) {

            return res.data.data.id
        } else {

            return false
        }

    } catch (err) {

        return false
    }
}

export const get_official_banks = () => async dispatch => {
    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/banks/official`, config);
        if (res.status === 200) {
            const official_banks = res.data.data.banks.map((bank, index) => ({
                id: -(index + 1),
                name: bank,
                userBank: false,
                isDefault: true,
                is_automated: true
            }))

            dispatch({
                type: GET_OFFICIAL_BANKS_SUCCESS,
                payload: official_banks
            });
            return true
        } else {
            dispatch({
                type: GET_OFFICIAL_BANKS_FAIL
            });
            return false
        }
    } catch (err) {
        dispatch({
            type: GET_OFFICIAL_BANKS_FAIL
        });
        return false
    }
}

