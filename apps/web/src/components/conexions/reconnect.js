/**
 * Reconectar una conexión de correo en un toque (plan/27 §D): abre el OAuth del proveedor en una ventana y
 * espera el código que manda GlinkOauthPopupSuccess. La API reautoriza la misma conexión (mismo id, mismas
 * cuentas ligadas), limpia el error y pide la lectura prioritaria: el front no borra nada.
 */

const POPUP = 'TopiReconnect';

const popupFeatures = () => {
    const width = 500;
    const height = 640;
    const left = Math.max(0, (window.screen.width / 2) - (width / 2));
    const top = Math.max(0, (window.screen.height / 2) - (height / 2));
    return `width=${width},height=${height},top=${top},left=${left}`;
};

/**
 * Abre la ventana del proveedor. Debe llamarse en el mismo clic (si no, el navegador la bloquea), por eso la
 * URL se pide antes. Devuelve una promesa con el código o un error: 'blocked' | 'closed' | 'denied'.
 */
export const openOAuthPopup = (url, { timeoutMs = 10 * 60 * 1000 } = {}) => new Promise((resolve, reject) => {
    const popup = window.open(url, POPUP, popupFeatures());
    if (!popup) {
        reject(new Error('blocked'));
        return;
    }

    let done = false;
    const finish = (fn, value) => {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        clearInterval(watch);
        clearTimeout(timer);
        fn(value);
    };

    // solo mensajes de nuestra propia página de retorno
    function onMessage(event) {
        if (event.origin !== window.location.origin || !event.data) return;
        if (event.data.code) finish(resolve, event.data.code);
        else if (event.data.error) finish(reject, new Error('denied'));
    }
    window.addEventListener('message', onMessage);

    const watch = setInterval(() => {
        if (popup.closed) finish(reject, new Error('closed'));
    }, 500);
    const timer = setTimeout(() => finish(reject, new Error('closed')), timeoutMs);
});

// Dominios de Microsoft: para estos correos Outlook va primero (no gasta cupos de Google, ver plan/27 §A)
const MICROSOFT_DOMAINS = ['outlook.', 'hotmail.', 'live.', 'msn.'];

export const suggestedProvider = (address) => {
    const domain = String(address || '').toLowerCase().split('@')[1] || '';
    return MICROSOFT_DOMAINS.some(prefix => domain.startsWith(prefix)) ? 'outlook' : 'gmail';
};

export const providerLabel = (provider) => (provider === 'outlook' ? 'Outlook' : provider === 'gmail' ? 'Gmail' : 'tu correo');

// "Ahora no": el banner de una conexión caída se oculta 24 h, nunca para siempre
const HIDE_KEY = 'topi.connectionDownHidden';
export const HIDE_MS = 24 * 60 * 60 * 1000;

const readHidden = () => {
    try { return JSON.parse(localStorage.getItem(HIDE_KEY) || '{}') || {}; } catch { return {}; }
};

export const isHidden = (emailId, now = Date.now()) => {
    const until = readHidden()[emailId];
    return typeof until === 'number' && now < until;
};

export const hideFor24h = (emailId, now = Date.now()) => {
    const hidden = readHidden();
    Object.keys(hidden).forEach((key) => { if (hidden[key] <= now) delete hidden[key]; });
    hidden[emailId] = now + HIDE_MS;
    try { localStorage.setItem(HIDE_KEY, JSON.stringify(hidden)); } catch { /* sin storage: solo se oculta ahora */ }
};
