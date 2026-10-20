import {
    SET_USER_FOUND,
    REVOMVE_USER_FOUND,
    SET_AUTH_LOADING,
    REMOVE_AUTH_LOADING,
    SIGNUP_SUCCESS,
    SIGNUP_FAIL,
    LOGIN_SUCCESS,
    LOGIN_FAIL,
    ACTIVATION_SUCCESS,
    ACTIVATION_FAIL,
    USER_LOADED_SUCCESS,
    USER_LOADED_FAIL,
    GET_USER_EXTRA_SUCESS,
    GET_USER_EXTRA_FAIL,
    AUTHENTICATED_SUCCESS,
    AUTHENTICATED_FAIL,
    REFRESH_SUCCESS,
    REFRESH_FAIL,
    RESET_PASSWORD_SUCCESS,
    RESET_PASSWORD_FAIL,
    RESET_PASSWORD_CONFIRM_SUCCESS,
    RESET_PASSWORD_CONFIRM_FAIL,
    LOGOUT
} from '../actions/types'


const initialState = {
    user_found: false,
    loading_user_data: true,
    token: localStorage.getItem('token'),
    isAuthenticated: null,
    user: null,
    user_extra_data: null,
    login_type: null
}

export default function Auth(state = initialState, action) {
    const { type, payload } = action;

    switch(type) {
        case SET_USER_FOUND:
            return {
                ...state,
                user_found: true
            }
        case REVOMVE_USER_FOUND:
            return {
                ...state,
                user_found: false
            }
        case SET_AUTH_LOADING:
            return {
                ...state,
                loading_user_data: true
            }
        case REMOVE_AUTH_LOADING:
            return {
                ...state,
                loading_user_data: false
            }
        case USER_LOADED_SUCCESS:
            return {
                ...state,
                user: payload.data,
                isAuthenticated: true
            }
        case USER_LOADED_FAIL:
            return {
                ...state,
                user: null
            }
        case GET_USER_EXTRA_SUCESS:
            return {
                ...state,
                user_extra_data: payload.data,
            }
        case GET_USER_EXTRA_FAIL:
            return {
                ...state,
                user_extra_data: null
            }
        case AUTHENTICATED_SUCCESS:
            return {
                ...state,
                isAuthenticated: true
            }
        case AUTHENTICATED_FAIL:
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            return {
                ...state,
                isAuthenticated: false,
                access: null,
                refresh: null
            }
        case LOGIN_SUCCESS:
            localStorage.setItem('token', payload.data.access_token);
            if (payload.data.refresh_token) {
                localStorage.setItem('refresh_token', payload.data.refresh_token);
            }
            return {
                ...state,
                isAuthenticated: true,
                token: localStorage.getItem('token'),
                login_type: 'normal',
            }
        
        case ACTIVATION_SUCCESS:
        case ACTIVATION_FAIL:
        case RESET_PASSWORD_SUCCESS:
        case RESET_PASSWORD_FAIL:
        case RESET_PASSWORD_CONFIRM_SUCCESS:
        case RESET_PASSWORD_CONFIRM_FAIL:
            return{
                ...state
            }

        case REFRESH_SUCCESS:
            //localStorage.setItem('token', payload.data.token);
            return {
                ...state,
                access: localStorage.getItem('token')
            }

        case SIGNUP_SUCCESS:
        case SIGNUP_FAIL:
        case LOGIN_FAIL:
        case REFRESH_FAIL:
        case LOGOUT:
            localStorage.removeItem('token')
            localStorage.removeItem('refresh_token')
            return {
                ...state,
                token :null,
                isAuthenticated: false,
                user: null,
                login_type: null
            }
        default:
            return state
    }
}