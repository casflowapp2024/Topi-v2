import {
    SET_USER_FOUND,
    REVOMVE_USER_FOUND,
    SIGNUP_FAIL,
    LOGIN_SUCCESS,
    LOGIN_FAIL,
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
            // la API ya no verifica el correo: el signup devuelve los tokens (login automático)
            dispatch({
                type: LOGIN_SUCCESS,
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

        return err.response?.data?.messages || ['network error']
    }
};

export const load_user = () => async dispatch => {

    // sin sesión no hay a quién cargar: evita un GET /users/ con "Bearer null" (401) en la landing
    if (!localStorage.getItem('token')) {
        dispatch({
            type: USER_LOADED_FAIL
        });
        return false
    }

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


    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/user-extra`, body, config);
        if (res.status === 200) {

            return true
        } else {

        }
        return false
    } catch (err) {

        return false
    }
};



// Cambia el tema al instante (optimista) y lo guarda en el perfil; si falla, lo revierte.
export const toggle_dark_mode = () => async (dispatch, getState) => {
    const prev = getState().Auth.user_extra_data;
    if (!prev) return false;
    const nextConfig = { ...(prev.config || {}), dark_mode: !prev.config?.dark_mode };
    dispatch({ type: GET_USER_EXTRA_SUCESS, payload: { data: { ...prev, config: nextConfig } } });
    const ok = await dispatch(update_user_config(nextConfig));
    if (!ok) {
        dispatch({ type: GET_USER_EXTRA_SUCESS, payload: { data: prev } });
    }
    return ok;
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
        return err.response?.data?.messages || ['network error']
    }
}

// Usuarios sin contraseña (migrados o reseteados por el admin): crean la contraseña desde el login
export const set_initial_password = (email, password, confirm_password) => async dispatch => {
    const config = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({ email, password, confirm_password });

    try {
        const res = await axios.post(`${process.env.REACT_APP_API_URL}/users/set-initial-password`, body, config);
        if (res.status === 200) {
            dispatch({
                type: LOGIN_SUCCESS,
                payload: res.data
            });
            return true
        }
        return res.data.messages
    } catch (err) {
        return err.response?.data?.messages || ['network error']
    }
}

// Cambiar contraseña (Ajustes > Perfil). La API cierra las demás sesiones y devuelve tokens nuevos.
export const change_password = (current_password, password, confirm_password) => async dispatch => {
    const config = {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({ current_password, password, confirm_password });

    try {
        const res = await axios.put(`${process.env.REACT_APP_API_URL}/users/password`, body, config);
        if (res.status === 200) {
            dispatch({
                type: LOGIN_SUCCESS,
                payload: res.data
            });
            return true
        }
        return res.data.messages
    } catch (err) {
        return err.response?.data?.messages || ['network error']
    }
}

export const logout = () => dispatch => {
    // revoca el refresh token en la API (best effort, no bloquea el logout local)
    const refresh_token = localStorage.getItem('refresh_token');
    if (refresh_token) {
        axios.post(`${process.env.REACT_APP_API_URL}/users/logout`, { refresh_token })
            .catch(() => { });
    }

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

