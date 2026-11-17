// Señal de "cambiaron tus datos" entre tarjetas del Inicio (plan/30, bloque 2). Cada tarjeta pide sus datos por su
// cuenta; con esta señal no tienen que conocerse entre sí: quien cambia algo avisa y quien muestra algo escucha.
//
// Tipos: 'transactions' (llegaron movimientos leídos del correo), 'review' (se resolvió algo de Por revisar o se
// editó un movimiento), 'budget' (presupuestos o categorías), 'account' (se creó o editó una cuenta) y
// 'connection' (se conectó o reconectó un correo).
import axios from 'axios';

const EVENT = 'topi:data-changed';

export const emitDataChanged = (kind) => {
    try {
        window.dispatchEvent(new CustomEvent(EVENT, { detail: { kind } }));
    } catch (_) { /* sin window (pruebas de node): nada que avisar */ }
};

/** Suscribe `fn(kind)` y devuelve la función para desuscribir (útil como cleanup de useEffect). */
export const onDataChanged = (fn) => {
    const handler = (e) => fn(e?.detail?.kind);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
};

// Qué tipo de cambio es una petición que salió bien. Solo escrituras; la ruta sin la URL base ni la query.
const RULES = [
    [/^\/accounts\/create$|^\/accounts\/\d+$/, 'account'],
    [/^\/email\/register$/, 'connection'],
    [/^\/categories\/(create|\d+)(\/budgets(\/[^/]+)?)?$/, 'budget'],
    [/^\/transactions\//, 'review'],
];

export const kindOfRequest = (method, url) => {
    if (!method || !url || method.toLowerCase() === 'get') return null;
    let path = String(url);
    const base = process.env.REACT_APP_API_URL || '';
    if (base && path.startsWith(base)) path = path.slice(base.length);
    path = path.split('?')[0];
    const rule = RULES.find(([re]) => re.test(path));
    return rule ? rule[1] : null;
};

/** Avisa de cada escritura que salió bien (2xx). Se instala una vez, junto al interceptor de sesión. */
export const setupDataEvents = () => {
    axios.interceptors.response.use((response) => {
        const kind = kindOfRequest(response?.config?.method, response?.config?.url);
        if (kind) emitDataChanged(kind);
        return response;
    });
};
