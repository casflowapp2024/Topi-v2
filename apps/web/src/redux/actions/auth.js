import { m } from 'framer-motion';
import {
    SET_USER_FOUND,
    REVOMVE_USER_FOUND,
    SIGNUP_SUCCESS,
    SIGNUP_FAIL,
    LOGIN_SUCCESS,
    LOGIN_FAIL,
    LOGIN_GMAIL_SUCCESS,
    LOGIN_GMAIL_FAIL,
    ACTIVATION_SUCCESS,
    ACTIVATION_FAIL,
    SET_AUTH_LOADING,
    REMOVE_AUTH_LOADING,
    USER_LOADED_SUCCESS,
    USER_LOADED_FAIL,
    GET_USER_EXTRA_SUCESS,
    GET_USER_EXTRA_FAIL,
    AUTHENTICATED_SUCCESS,
    AUTHENTICATED_FAIL,
    REFRESH_SUCCESS,
    REFRESH_FAIL,
    REQUEST_CODE_RESET_PASSWORD_SUCCESS,
    REQUEST_CODE_RESET_PASSWORD_FAIL,
    RESET_PASSWORD_SUCCESS,
    RESET_PASSWORD_FAIL,
    RESET_PASSWORD_CONFIRM_SUCCESS,
    RESET_PASSWORD_CONFIRM_FAIL,
    LOGOUT
} from './types'

//import { setAlert } from './alert';

import axios from 'axios'



export const signup = (name, last_name, email, password, confirm_password) => async dispatch => {


    const config = {
        headers: {
            'Content-Type': 'application/json',
        }
    };

    const body = JSON.stringify({
        name,
        last_name,
        email,
        password,
        confirm_password
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/signup`, body, config);
        if (res.status === 201) {
            dispatch({
                type: SIGNUP_SUCCESS,
                payload: res.data
            });

            return true
        } else {
            dispatch({
                type: SIGNUP_FAIL
            });

            return res.data.messages
        }

    } catch (err) {
        dispatch({
            type: SIGNUP_FAIL
        });

        return err.response.data.messages
    }
};

export const load_user = () => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/users/`, config);
        if (res.status === 200) {
            dispatch({
                type: USER_LOADED_SUCCESS,
                payload: res.data
            });
            dispatch(get_user_extra_data());
            return true
        } else {
            dispatch({
                type: USER_LOADED_FAIL
            });
            return false
        }
    }
    catch (err) {
        dispatch({
            type: USER_LOADED_FAIL
        });
        return false
    }


}

export const get_user_extra_data = () => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });
    console.log("getting user extra data")
    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };
    try {

        const res = await axios.get(`${process.env.REACT_APP_API_URL}/user-extra`, config);
        if (res.status === 200) {
            dispatch({
                type: GET_USER_EXTRA_SUCESS,
                payload: res.data,
            });
            dispatch({
                type: SET_USER_FOUND,
            });
            dispatch({
                type: REMOVE_AUTH_LOADING,
            });
            return true
        } else {
            dispatch({
                type: GET_USER_EXTRA_FAIL
            });
            dispatch({
                type: REMOVE_AUTH_LOADING,
            });
        }
        return false
    } catch (err) {
        dispatch({
            type: GET_USER_EXTRA_FAIL,
        });
        dispatch({
            type: REMOVE_AUTH_LOADING,
        });
        return false
    }
};

export const add_user_extra_data = (utc_offset, whatsapp) => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
        }
    };

    const body = JSON.stringify({
        utc_offset,
        whatsapp,
        config: "{}"
    });


    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/user-extra/create`, body, config);
        if (res.status === 200) {

            return true
        } else {

        }
        return false
    } catch (err) {

        return false
    }
};

export const update_user_extra_data = (
    utc_offset,
    whatsapp,
    onboarding_completed,
    birthday,
    local_currency,
    language
) => async (dispatch, getState) => {

    const state = getState();
    const user_extra = state.Auth.user_extra_data || {};

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    const body = JSON.stringify({
        utc_offset,
        whatsapp,
        onboarding_completed,
        birthday,
        local_currency,
        language,
        config: user_extra.config
    });

    console.log(body)

    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/user-extra`, body, config);
        console.log(res.data)
        if (res.status === 200) {

            return true
        } else {

        }
        return false
    } catch (err) {

        return false
    }
};

export const update_user_config = (
    config_data
) => async (dispatch, getState) => {

    const state = getState();
    const user_extra = state.Auth.user_extra_data || {};

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    const body = JSON.stringify({
        config: config_data,
        onboarding_completed: user_extra.onboarding_completed,
        utc_offset: user_extra.utc_offset,
        whatsapp: user_extra.whatsapp,
        birthday: user_extra.birthday,
        local_currency: user_extra.local_currency,
        language: user_extra.language
    });

    console.log("updating config", body)

    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/user-extra`, body, config);
        console.log(res.data)
        if (res.status === 200) {

            return true
        } else {

        }
        return false
    } catch (err) {

        return false
    }
};



export const login = (email, password) => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({
        email,
        password
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/login`, body, config);
        console.log(res)
        if (res.status === 200) {
            console.log(res.data)
            dispatch({
                type: LOGIN_SUCCESS,
                payload: res.data
            });
            dispatch({
                type: REMOVE_AUTH_LOADING
            });
            return true
        } else {
            dispatch({
                type: LOGIN_FAIL
            });
            dispatch({
                type: REMOVE_AUTH_LOADING
            });
            return res.data.messages
        }
    }
    catch (err) {
        dispatch({
            type: LOGIN_FAIL
        });
        dispatch({
            type: REMOVE_AUTH_LOADING
        });
        return err.response.data.messages
    }
}

export const login_with_code = (code) => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    //console.log("making login code:", code)
    const body = JSON.stringify({
        code,
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/login`, body, config);
        //console.log(res.status)
        //console.log(res)
        if (res.status === 200) {
            console.log(res.data)
            dispatch({
                type: LOGIN_GMAIL_SUCCESS,
                payload: res.data
            });
            //dispatch(load_user());
            dispatch({
                type: REMOVE_AUTH_LOADING
            });
            return true
            //dispatch(setAlert('Inicio de sesión con éxito', 'green'));
        } else {
            dispatch({
                type: LOGIN_GMAIL_FAIL
            });
            dispatch({
                type: REMOVE_AUTH_LOADING
            });
            //dispatch(setAlert('Error al iniciar sesion.', 'red'));
            return false
        }
    }
    catch (err) {
        dispatch({
            type: LOGIN_FAIL
        });
        dispatch({
            type: REMOVE_AUTH_LOADING
        });
        //dispatch(setAlert('Error al iniciar sesion.', 'red'));
        return false
    }
}

export const register_url_google_login = () => async dispatch => {

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };
    try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/users/social-auth-url`, config);
        console.log(res.data)
        if (res.status === 200) {
            console.log("url", res.data.data.url)
            return res.data.data.url
        } else {
            return false;
        }

    } catch (err) {
        return false;
    }
}

export const activate = (code, email) => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({
        code, email
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/confirm`, body, config);
        console.log(res.status)
        console.log(res)
        if ((res.status === 204) || (res.status === 200)) {
            dispatch({
                type: ACTIVATION_SUCCESS
            });
            return true
            //dispatch(setAlert('Cuenta activada correctamente', 'green'));
        } else {
            dispatch({
                type: ACTIVATION_FAIL
            });
            dispatch({
                type: REMOVE_AUTH_LOADING
            });
            return false
            //dispatch(setAlert('Error activando cuenta', 'red'));
        }
    }
    catch (err) {
        dispatch({
            type: ACTIVATION_FAIL
        });
        dispatch({
            type: REMOVE_AUTH_LOADING
        });
        return false
        //dispatch(setAlert('Error al conectar con el servidor, intenta mas tarde.', 'red'));
    }
};

export const resend_activate_code = (email) => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({
        email
    });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/resend-confirmation`, body, config);
        console.log(res.status)
        console.log(res)
        if ((res.status === 204) || (res.status === 200)) {

            return true
            //dispatch(setAlert('Cuenta activada correctamente', 'green'));
        } else {

            return false
            //dispatch(setAlert('Error activando cuenta', 'red'));
        }
    }
    catch (err) {

        return false
        //dispatch(setAlert('Error al conectar con el servidor, intenta mas tarde.', 'red'));
    }
};

export const request_code_reset_password = (email) => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({ email });

    console.log("asking for code")

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/forgot-password`, body, config);
        console.log(res.status)
        console.log(res.data)

        if (res.status === 200) {

            return true

        } else {

            return false
        }
    }
    catch (err) {

        console.log("asking fail")
        return false
    }
}

export const reset_password = (email, password, confirm_password, code) => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({
        email,
        password,
        confirm_password,
        code
    });

    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/users/forgot-password/confirm`, body, config);

        if (res.status === 200) {

            return true

        } else {

            return false
        }
    }
    catch (err) {

        return false

    }
}

export const logout = () => dispatch => {
    dispatch({
        type: LOGOUT,

    });
    dispatch({
        type: REVOMVE_USER_FOUND,

    });

    //dispatch(setAlert('Se ha cerrado sesión exitosamente', 'green'));
}

export const request_init_categories = () => async dispatch => {
    dispatch({
        type: SET_AUTH_LOADING
    });

    const body = JSON.stringify({

    });

    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
        }
    };

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/init/resources`, body, config);

        console.log("creating categories")
        console.log(res.status)
        console.log(res.data)

        if (res.status === 200) {

            return true

        } else {

            return false
        }
    }
    catch (err) {

        console.log("asking fail")
        return false
    }
}

