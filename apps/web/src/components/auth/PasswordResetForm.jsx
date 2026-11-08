import { useEffect, useState } from "react";
import { connect } from 'react-redux';
import { ThreeDots } from 'react-loader-spinner';
import { request_password_code, reset_password } from '../../redux/actions/auth';
import { setAlert } from '../../redux/actions/alert';
import { passwordErrors } from '../../lib/passwordPolicy';

// segundos antes de poder pedir otro código
const RESEND_SECONDS = 60;

// mensajes de la API (contrato: textos exactos de core/domain/error.go)
const API = {
    wrongCode: 'invalid verification code provided',
    expiredCode: 'confirmation code has expired',
    limit: 'limit exceeded, too many requests',
    policy: 'password doesnt meet the requirements',
};

const errorAlert = (msg, setAlert) => setAlert(msg, false, 'text-red-600', 'bg-gray-200', 4000);

/**
 * Recuperar o crear la contraseña con un código de 6 dígitos enviado al correo (vence en 10 minutos).
 * - En "¿Olvidaste tu contraseña?" el usuario escribe su correo.
 * - En el login de una cuenta sin contraseña (usuarios migrados) llega con `email` fijo y `migration`.
 */
const PasswordResetForm = ({ email: initialEmail = '', migration = false, onCancel, onDone, request_password_code, reset_password, setAlert }) => {
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState(initialEmail);
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const errors = password ? passwordErrors(password) : [];

    const sendCode = async (e) => {
        e?.preventDefault();
        if (!email) return;

        setLoading(true);
        const response = await request_password_code(email.trim());
        setLoading(false);

        if (response === true) {
            setStep('code');
            setCode('');
            setCooldown(RESEND_SECONDS);
        } else if (response[0] === API.limit) {
            errorAlert('Ya pediste varios códigos. Espera unos minutos e inténtalo de nuevo', setAlert);
        } else {
            errorAlert('No pudimos enviar el código en este momento. Inténtalo de nuevo', setAlert);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();

        if (!/^\d{6}$/.test(code)) {
            errorAlert('El código tiene 6 dígitos', setAlert);
            return;
        }
        if (errors.length > 0) {
            errorAlert('La contraseña no cumple con los requisitos', setAlert);
            return;
        }
        if (password !== confirmPassword) {
            errorAlert('Las contraseñas no coinciden', setAlert);
            return;
        }

        setLoading(true);
        const response = await reset_password(email.trim(), code, password, confirmPassword);
        setLoading(false);

        if (response === true) {
            setAlert(migration ? 'Contraseña creada, ¡bienvenido de nuevo!' : 'Contraseña actualizada', true, 'text-white', 'bg-green-500', 3000);
            onDone?.();
        } else if (response[0] === API.wrongCode) {
            errorAlert('El código no es correcto. Revisa el último correo que te enviamos', setAlert);
        } else if (response[0] === API.expiredCode) {
            errorAlert('El código venció o tuvo demasiados intentos. Pide uno nuevo', setAlert);
            setCode('');
            setCooldown(0);
        } else if (response[0] === API.limit) {
            errorAlert('Demasiados intentos, espera un minuto e inténtalo de nuevo', setAlert);
        } else if (response[0] === API.policy) {
            errorAlert('La contraseña no cumple con los requisitos', setAlert);
        } else {
            errorAlert('No pudimos cambiar la contraseña. Si el problema sigue, escribe a cashflowapp2024@gmail.com', setAlert);
        }
    };

    const inputClass = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white";
    const primaryClass = "w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center";

    const submitButton = (label) => loading ?
        <div className="w-full text-white bg-blue-700 rounded-lg text-sm px-5 py-2.5">
            <div className='flex justify-center items-center'>
                <ThreeDots height="20" width="20" color="white" ariaLabel="loading" />
            </div>
        </div>
        :
        <button type="submit" className={primaryClass}>{label}</button>;

    const cancel = onCancel &&
        <button type="button" onClick={onCancel} className="w-full text-sm text-blue-700 hover:underline dark:text-blue-500">
            Volver al inicio de sesión
        </button>;

    if (step === 'email') {
        return (
            <form className="space-y-5" onSubmit={sendCode}>
                {migration ?
                    <div className="rounded-lg bg-blue-50 dark:bg-gray-700 p-4 text-sm text-gray-800 dark:text-gray-100">
                        <p className="font-semibold mb-1">Actualizamos Topi.</p>
                        <p>Por seguridad debes crear una contraseña nueva. Te enviaremos un código a tu correo para confirmar que eres tú.</p>
                        <p className="mt-2">Si antes entrabas con Google, crea aquí una contraseña para tu correo.</p>
                    </div>
                    :
                    <>
                        <h5 className="text-xl font-medium text-gray-900 dark:text-white">¿Olvidaste tu contraseña?</h5>
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            Escribe el correo de tu cuenta y te enviaremos un código para crear una contraseña nueva.
                        </p>
                    </>
                }
                <div>
                    <label htmlFor="reset-email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email</label>
                    <input type="email" id="reset-email" name="email" placeholder="nombre@email.com" required
                        value={email} onChange={e => setEmail(e.target.value)} disabled={migration && !!initialEmail}
                        className={inputClass + (migration && initialEmail ? " opacity-70" : "")} />
                </div>
                {submitButton('Enviarme un código')}
                {cancel}
            </form>
        );
    }

    return (
        <form className="space-y-5" onSubmit={onSubmit}>
            <div className="text-sm text-gray-700 dark:text-gray-200">
                <p>Si <span className="font-semibold">{email.trim()}</span> tiene una cuenta en Topi, le enviamos un código de 6 dígitos. Vence en 10 minutos.</p>
                <p className="mt-1 text-gray-500 dark:text-gray-400">¿No llega? Revisa la carpeta de spam.</p>
            </div>
            <div>
                <label htmlFor="reset-code" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Código</label>
                <input type="text" id="reset-code" name="code" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={6} placeholder="123456" required
                    value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className={inputClass + " tracking-[0.4em] text-center text-lg font-semibold"} />
            </div>
            <div>
                <label htmlFor="new-password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nueva contraseña</label>
                <input type="password" id="new-password" name="password" placeholder="••••••••" required autoComplete="new-password"
                    value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
                <ul className="mt-2 text-xs text-red-500">
                    {errors.map(msg => <li key={msg}>{msg}</li>)}
                </ul>
            </div>
            <div>
                <label htmlFor="confirm-new-password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Confirma la contraseña</label>
                <input type="password" id="confirm-new-password" name="confirm_password" placeholder="••••••••" required autoComplete="new-password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>

            {submitButton(migration ? 'Crear contraseña y entrar' : 'Cambiar contraseña y entrar')}

            <div className="flex justify-between text-sm">
                {migration && initialEmail ? <span /> :
                    <button type="button" onClick={() => setStep('email')} className="text-blue-700 hover:underline dark:text-blue-500">
                        Cambiar correo
                    </button>
                }
                <button type="button" onClick={sendCode} disabled={cooldown > 0 || loading}
                    className="text-blue-700 hover:underline disabled:text-gray-400 disabled:no-underline dark:text-blue-500">
                    {cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'}
                </button>
            </div>
            {cancel}
        </form>
    );
};

export default connect(null, { request_password_code, reset_password, setAlert })(PasswordResetForm);
