import axios from 'axios';
import { LOGIN_SUCCESS } from '../redux/actions/types';
import { logout } from '../redux/actions/auth';

// Endpoints de auth: un 401 aquí es un error de credenciales, no una sesión vencida
const AUTH_PATHS = [
    '/users/login',
    '/users/signup',
    '/users/set-initial-password',
    '/users/refresh',
    '/users/logout',
    '/users/password',
];

const isAuthRequest = (url = '') => AUTH_PATHS.some(path => url.includes(path));

// un único refresh en vuelo aunque fallen varias peticiones a la vez
let refreshing = null;

const refreshSession = async (store) => {
    const refresh_token = localStorage.getItem('refresh_token');
    if (!refresh_token) {
        throw new Error('no refresh token');
    }

    // axios sin interceptores para no entrar en bucle
    const res = await axios.create().post(
        `${process.env.REACT_APP_API_URL}/users/refresh`,
        { refresh_token },
        { headers: { 'Content-Type': 'application/json' } }
    );

    store.dispatch({ type: LOGIN_SUCCESS, payload: res.data });

    return res.data.data.access_token;
};

/**
 * Ante un 401 intenta /users/refresh una vez y reintenta la petición con el token nuevo.
 * Si el refresh falla, cierra la sesión.
 */
export const setupAuthInterceptor = (store) => {
    axios.interceptors.response.use(
        response => response,
        async (error) => {
            const original = error.config;
            const status = error.response?.status;

            if (status !== 401 || !original || original._retried || isAuthRequest(original.url)) {
                return Promise.reject(error);
            }

            original._retried = true;

            try {
                refreshing = refreshing || refreshSession(store);
                const accessToken = await refreshing;
                original.headers = { ...original.headers, Authorization: `Bearer ${accessToken}` };
                return axios(original);
            } catch (refreshError) {
                store.dispatch(logout());
                return Promise.reject(error);
            } finally {
                refreshing = null;
            }
        }
    );
};
