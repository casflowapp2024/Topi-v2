import { useState } from 'react';
import { connect } from 'react-redux';
import { verify_email, resend_verification } from '../../redux/actions/auth';

const DISMISS_KEY = 'topi.verifyEmailDismissed';

const readDismissed = () => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

const MESSAGES = {
    'invalid verification code provided': 'El código no es correcto',
    'confirmation code has expired': 'El código venció. Pide uno nuevo',
    'limit exceeded, too many requests': 'Demasiados intentos. Espera unos minutos',
};

/**
 * Aviso para confirmar el correo de las cuentas nuevas (el código llega al registrarse).
 * No bloquea nada: se puede cerrar por esta sesión. Las cuentas existentes ya están verificadas.
 */
const VerifyEmailBanner = ({ user, verify_email, resend_verification }) => {
    const [dismissed, setDismissed] = useState(readDismissed);
    const [code, setCode] = useState('');
    const [status, setStatus] = useState(null); // { ok, text }
    const [loading, setLoading] = useState(false);

    if (!user || user.email_verified !== false || dismissed) return null;

    const dismiss = () => {
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* sin storage: solo se oculta ahora */ }
        setDismissed(true);
    };

    const onVerify = async (e) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(code)) {
            setStatus({ ok: false, text: 'El código tiene 6 dígitos' });
            return;
        }
        setLoading(true);
        const response = await verify_email(code);
        setLoading(false);
        if (response !== true) {
            setStatus({ ok: false, text: MESSAGES[response[0]] || 'No pudimos confirmar el correo. Inténtalo de nuevo' });
        }
    };

    const onResend = async () => {
        setLoading(true);
        const response = await resend_verification();
        setLoading(false);
        setStatus(response === true
            ? { ok: true, text: 'Te enviamos un código nuevo' }
            : { ok: false, text: MESSAGES[response[0]] || 'No pudimos enviar el código' });
        setCode('');
    };

    return (
        <div role="status" className="bg-blue-50 dark:bg-slate-800 border-b border-blue-100 dark:border-slate-700 text-sm text-gray-800 dark:text-gray-100">
            <form onSubmit={onVerify} className="max-w-screen-xl mx-auto px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex-1 min-w-[12rem]">
                    <span className="font-semibold">Confirma tu correo.</span>{' '}
                    Escribe el código que enviamos a <span className="font-medium">{user.email}</span>.
                </span>
                <input
                    aria-label="Código de verificación" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                    placeholder="123456" value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-28 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-center tracking-widest"
                />
                <button type="submit" disabled={loading}
                    className="rounded-lg bg-[#5266EB] px-3 py-1 font-medium text-white hover:bg-blue-700 disabled:opacity-60">
                    Confirmar
                </button>
                <button type="button" onClick={onResend} disabled={loading} className="text-[#5266EB] hover:underline disabled:opacity-60">
                    Reenviar código
                </button>
                <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                    ✕
                </button>
                {status &&
                    <span className={`basis-full text-xs ${status.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {status.text}
                    </span>
                }
            </form>
        </div>
    );
};

const mapStateToProps = state => ({
    user: state.Auth.user,
});

export default connect(mapStateToProps, { verify_email, resend_verification })(VerifyEmailBanner);
