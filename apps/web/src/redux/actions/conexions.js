import axios from 'axios';
import {
    GET_AUTOMATED_EMAILS_SUCCESS,
    GET_AUTOMATED_EMAILS_FAIL

} from './types';


export const link_emails_ask_url = (provider) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    const url = `${process.env.REACT_APP_API_URL}/email/auth-url?provider=${provider}`

    try {
        const res = await axios.get(url, config);
        console.log(res.data)
        if (res.status === 200) {
            return res.data.data.url
        } else {
            return false;
        }

    } catch (err) {
        return false;
    }
}

export const get_automated_emails = (skip, limit) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };
    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/email/list?skip=${skip}&limit=${limit}`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_AUTOMATED_EMAILS_SUCCESS,
                payload: res.data
            });
            return res.data.data.emails;

        } else {
            dispatch({
                type: GET_AUTOMATED_EMAILS_FAIL
            });
            return false;

        }

    } catch (err) {
        dispatch({
            type: GET_AUTOMATED_EMAILS_FAIL
        });
        return false;
    }
}


export const register_email_conexion = (email, code, provider) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };


    const body = {
        email: email,
        provider: provider
    }

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/email/register?code=${code}`, body, config);
        if (res.status === 200) {
            return true

        } else {
            return false;
        }

    } catch (err) {
        return false;
    }
}


export const delete_automated_email = (email) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    console.log(config)
    console.log(email)



    try {
        const res = await axios.delete(`${process.env.REACT_APP_API_URL}/email/${email}`, config);

        console.log(res)
        if (res.status === 200) {
            return true

        } else {
            return false;
        }

    } catch (err) {
        return false;
    }
}


// acc_id: un id o una lista de ids de cuentas
export const read_email_transactions_trigger = (acc_id) => async dispatch => {
    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    const body = {
        "account_ids": Array.isArray(acc_id) ? acc_id : [acc_id]
    }

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/email/read`, body, config);
        if (res.status === 200) {
            return true
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}


export const onboarding_reset_read_email = () => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };
    console.log(localStorage.getItem('user_extra_data.user_id'))
    const body = {
        "user_id": localStorage.getItem('user_extra_data.user_id')
    }

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/email/reset`, body, config);
        return res.data
    } catch (err) {
        return false;
    }
}





