import axios from 'axios';
import { LOGIN_SUCCESS } from '../redux/actions/types';
import { logout } from '../redux/actions/auth';

// Endpoints de auth: un 401 aquí es un error de credenciales, no una sesión vencida
const AUTH_PATHS = [
    '/users/login',
    '/users/signup',
    '/users/refresh',
    '/users/logout',
    '/users/password',
];

// Nombre del Web Lock compartido por todas las pestañas y la PWA del mismo origen
const REFRESH_LOCK = 'topi-auth-refresh';

const isAuthRequest = (url = '') => AUTH_PATHS.some(path => url.includes(path));

const bearer = (token) => `Bearer ${token}`;

// axios 1.x guarda los headers en AxiosHeaders (con get); en tests pueden venir como objeto plano
const authHeaderOf = (config) => {
    const headers = config?.headers;
    if (!headers) return undefined;
    if (typeof headers.get === 'function') return headers.get('Authorization');
    return headers.Authorization || headers.authorization;
};

// un único refresh en vuelo por pestaña aunque fallen varias peticiones a la vez
let refreshing = null;

/**
 * Renueva la sesión. La API rota el refresh token y trata el reuso como robo (revoca todas las
 * sesiones), así que dos renovaciones con el mismo token —dos pestañas, o la PWA y una pestaña,
 * que despiertan a la vez con el access token vencido— cierran la sesión en todas. Por eso:
 *  - el POST va dentro de un Web Lock: entre pestañas solo una renueva a la vez;
 *  - dentro del lock se vuelve a leer localStorage: si otra pestaña ya renovó, se usa su token.
 */
const refreshSession = async (store) => {
    // el refresh token con el que esta pestaña vio la sesión vencida
    const staleRefresh = localStorage.getItem('refresh_token');

    const doRefresh = async () => {
        const refresh_token = localStorage.getItem('refresh_token');
        if (!refresh_token) {
            throw new Error('no refresh token');
        }

        if (refresh_token !== staleRefresh) {
            // otra pestaña renovó mientras esperábamos el lock: su token ya es el bueno
            const access_token = localStorage.getItem('token');
            store.dispatch({ type: LOGIN_SUCCESS, payload: { data: { access_token, refresh_token } } });
            return access_token;
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

    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request(REFRESH_LOCK, doRefresh);
    }
    return doRefresh();
};

/**
 * Promesa que se resuelve cuando no hay un refresh en vuelo en esta pestaña. El service worker la
 * espera antes de recargar: una recarga a mitad del POST deja la rotación hecha en la API sin
 * guardar el token nuevo, y el siguiente intento con el viejo cuenta como reuso.
 */
export const whenRefreshIdle = () => (refreshing ? refreshing.catch(() => undefined) : Promise.resolve());

/**
 * Ante un 401 intenta /users/refresh una vez y reintenta la petición con el token nuevo.
 * Si el refresh falla, cierra la sesión (marcada como vencida para que el Layout lleve al login).
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

            const retryWith = (accessToken) => {
                original.headers = { ...original.headers, Authorization: bearer(accessToken) };
                return axios(original);
            };

            // La petición salió con un token que ya no es el actual (otra pestaña o un refresh de
            // esta ya renovó): basta reintentarla, sin gastar otra rotación.
            const current = localStorage.getItem('token');
            const used = authHeaderOf(original);
            if (current && used && used !== bearer(current)) {
                return retryWith(current);
            }

            let accessToken;
            try {
                if (!refreshing) {
                    refreshing = refreshSession(store).finally(() => { refreshing = null; });
                }
                accessToken = await refreshing;
            } catch (refreshError) {
                // solo la primera petición que falle cierra la sesión
                if (store.getState().Auth?.isAuthenticated !== false) {
                    store.dispatch(logout({ expired: true }));
                }
                return Promise.reject(error);
            }
            return retryWith(accessToken);
        }
    );
};
