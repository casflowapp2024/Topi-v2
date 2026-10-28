/**
 * Conexión de correo al iniciar sesión: cuándo una conexión es utilizable, cuándo llevar al usuario
 * a conectar una y la orquestación "vincular a las cuentas + leer ahora" después del OAuth.
 */
import { get_user_accounts, update_account } from "../../redux/actions/cashflow";
import { isCreditAccount } from "../helpers";
import { get_automated_emails, read_email_transactions_trigger } from "../../redux/actions/conexions";

const SNOOZE_KEY = 'connectEmailSnoozedUntil';
const PROMPTED_KEY = 'connectEmailPrompted';
const SNOOZE_MS = 86400000; // 24 h, igual que onboardingLastClosed

// El worker marca `error` solo con fallos de credenciales; lo transitorio no cuenta.
export const isUsableEmail = (email) => !!email && email.active === true && !email.error;

export const hasUsableEmail = (emails) => (emails || []).some(isUsableEmail);

export const brokenEmails = (emails) => (emails || []).filter(email => !!email.error);

// localStorage/sessionStorage pueden fallar (modo privado): sin ellos se pregunta en cada carga.
const safeGet = (storage, key) => {
    try { return storage.getItem(key); } catch (e) { return null; }
};
const safeSet = (storage, key, value) => {
    try { storage.setItem(key, value); } catch (e) { /* sin almacenamiento */ }
};

export const isConnectEmailSnoozed = () => {
    const until = parseInt(safeGet(localStorage, SNOOZE_KEY) || '0', 10);
    return Date.now() < until;
};

export const snoozeConnectEmail = () => {
    safeSet(localStorage, SNOOZE_KEY, (Date.now() + SNOOZE_MS).toString());
};

// Solo se pregunta una vez por sesión del navegador (al iniciar sesión / abrir la app) y usuario.
export const wasPromptedThisSession = (userKey) => safeGet(sessionStorage, PROMPTED_KEY) === String(userKey);

export const markPromptedThisSession = (userKey) => {
    safeSet(sessionStorage, PROMPTED_KEY, String(userKey));
};

/**
 * Qué hacer al cargar la app: 'none' | 'onboarding' (abrir el onboarding en "Conecta tu email")
 * | 'connect' (ir a /dashboard/connect-email). El onboarding ya tiene vincular correo, crear la
 * cuenta y "Leer últimas transacciones"; si el usuario ya tiene correos (en error) va a reconectar.
 */
export const connectEmailAction = (emails, onboardingCompleted) => {
    if (hasUsableEmail(emails)) return 'none';
    if (onboardingCompleted === false && (emails || []).length === 0) return 'onboarding';
    if (isConnectEmailSnoozed()) return 'none';
    return 'connect';
};

/**
 * Después de registrar `emailAddress`: vincula el correo a las cuentas que no tengan una conexión
 * utilizable y pide la lectura inmediata (POST /email/read, priority=1) de las cuentas ligadas a él.
 * Devuelve 'read' | 'no_accounts' | 'error'.
 */
export const linkEmailAndReadNow = (emailAddress) => async (dispatch, getState) => {
    try {
        await dispatch(get_automated_emails(0, 20));
        const emails = getState().Conexions.automated_emails?.emails || [];
        const newEmail = emails.find(email => email.email === emailAddress);
        if (!newEmail) return 'error';

        await dispatch(get_user_accounts(0, 100));
        const accounts = getState().CashFlow.user_accounts?.items || [];
        if (accounts.length === 0) return 'no_accounts';

        const linkedIds = [];
        for (const account of accounts) {
            if (account.email?.id === newEmail.id) {
                linkedIds.push(account.id);
                continue;
            }
            if (account.email?.id && isUsableEmail(account.email)) continue;

            // update_account vuelve a invertir el signo de las tarjetas de crédito (clase credit)
            const amount = isCreditAccount(account) ? -account.initial_balance : account.initial_balance;
            const status = await dispatch(update_account(
                account.id,
                account.name,
                account.type.id,
                account.last_four_digits,
                account.bank.id,
                amount,
                newEmail.id
            ));
            if (status === 200) linkedIds.push(account.id);
        }

        dispatch(get_user_accounts(0, 20));
        if (linkedIds.length === 0) return 'no_accounts';

        const started = await dispatch(read_email_transactions_trigger(linkedIds));
        return started ? 'read' : 'error';
    } catch (error) {
        console.error("Failed to link email and read now:", error);
        return 'error';
    }
};
