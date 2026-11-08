import axios from 'axios';
import { setupAuthInterceptor, whenRefreshIdle } from './authInterceptor';
import { LOGIN_SUCCESS, LOGOUT } from '../redux/actions/types';

// CRA/jest no transforma el build ESM de axios: se usa su build CommonJS real (no un mock)
jest.mock('axios', () => jest.requireActual('axios/dist/node/axios.cjs'));

const API = 'http://api.test';

// Adaptador falso: el servidor acepta solo el access token `valid` y rota el refresh token una vez.
let server;
const respond = (config, status, data) => {
    const response = { status, data, headers: {}, config, statusText: String(status) };
    if (status >= 400) {
        const err = new Error(`status ${status}`);
        err.config = config;
        err.response = response;
        return Promise.reject(err);
    }
    return Promise.resolve(response);
};

const adapter = async (config) => {
    const auth = typeof config.headers?.get === 'function'
        ? config.headers.get('Authorization')
        : config.headers?.Authorization;
    if (config.url.endsWith('/users/refresh')) {
        server.refreshCalls += 1;
        const { refresh_token } = JSON.parse(config.data);
        if (refresh_token !== server.refresh) return respond(config, 401, { messages: ['unauthorized'] });
        server.refresh = `r${server.refreshCalls}`;
        server.access = `a${server.refreshCalls}`;
        await new Promise(r => setTimeout(r, 5));
        return respond(config, 200, { data: { access_token: server.access, refresh_token: server.refresh } });
    }
    if (config.url.endsWith('/users/logout')) return respond(config, 200, {});
    if (auth !== `Bearer ${server.access}`) return respond(config, 401, { messages: ['unauthorized'] });
    return respond(config, 200, { ok: true });
};

const makeStore = () => {
    const state = { Auth: { isAuthenticated: true } };
    const actions = [];
    const store = {
        getState: () => state,
        dispatch: (action) => {
            if (typeof action === 'function') return action(store.dispatch, store.getState);
            actions.push(action);
            if (action.type === LOGIN_SUCCESS) {
                localStorage.setItem('token', action.payload.data.access_token);
                localStorage.setItem('refresh_token', action.payload.data.refresh_token);
            }
            if (action.type === LOGOUT) state.Auth.isAuthenticated = false;
            return action;
        },
    };
    return { store, actions };
};

const get = () => axios.get(`${API}/accounts`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
});

let ctx;
let interceptorId;

beforeAll(() => {
    process.env.REACT_APP_API_URL = API;
    axios.defaults.adapter = adapter;
});

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'expired');
    localStorage.setItem('refresh_token', 'r0');
    server = { access: 'a0', refresh: 'r0', refreshCalls: 0 };
    ctx = makeStore();
    const before = axios.interceptors.response.handlers.length;
    setupAuthInterceptor(ctx.store);
    interceptorId = before;
});

afterEach(() => {
    axios.interceptors.response.eject(interceptorId);
});

test('varias peticiones con el token vencido comparten un solo refresh', async () => {
    const results = await Promise.all([get(), get(), get(), get()]);
    expect(results.every(r => r.status === 200)).toBe(true);
    expect(server.refreshCalls).toBe(1);
    expect(localStorage.getItem('refresh_token')).toBe('r1');
});

test('si otra pestaña ya renovó, reintenta con su token sin otro refresh', async () => {
    const pending = get(); // sale con 'expired'
    // otra pestaña renueva antes de que llegue el 401
    server.access = 'a9';
    server.refresh = 'r9';
    localStorage.setItem('token', 'a9');
    localStorage.setItem('refresh_token', 'r9');
    const res = await pending;
    expect(res.status).toBe(200);
    expect(server.refreshCalls).toBe(0);
});

test('con Web Locks: si otra pestaña renovó mientras esperábamos el lock, no se repite el refresh', async () => {
    const lockNames = [];
    Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: {
            // la otra pestaña tiene el lock: renueva (r0 → r5) y lo suelta
            request: async (name, callback) => {
                lockNames.push(name);
                server.access = 'a5';
                server.refresh = 'r5';
                localStorage.setItem('token', 'a5');
                localStorage.setItem('refresh_token', 'r5');
                return callback();
            },
        },
    });
    try {
        const res = await get();
        expect(res.status).toBe(200);
        expect(lockNames).toEqual(['topi-auth-refresh']);
        expect(server.refreshCalls).toBe(0); // el r0 nunca se reusa
        expect(ctx.actions.some(a => a.type === LOGOUT)).toBe(false);
    } finally {
        delete navigator.locks;
    }
});

test('si el refresh falla, cierra la sesión una vez y marcada como vencida', async () => {
    server.refresh = 'otro'; // el r0 ya no vale (revocado)
    const results = await Promise.allSettled([get(), get(), get()]);
    expect(results.every(r => r.status === 'rejected')).toBe(true);
    const logouts = ctx.actions.filter(a => a.type === LOGOUT);
    expect(logouts).toHaveLength(1);
    expect(logouts[0].payload).toEqual({ expired: true });
});

test('whenRefreshIdle espera al refresh en vuelo', async () => {
    const pending = get();
    await new Promise(r => setTimeout(r, 0));
    let idle = false;
    const waiting = whenRefreshIdle().then(() => { idle = true; });
    expect(idle).toBe(false);
    await pending;
    await waiting;
    expect(idle).toBe(true);
    expect(localStorage.getItem('refresh_token')).toBe('r1');
});
