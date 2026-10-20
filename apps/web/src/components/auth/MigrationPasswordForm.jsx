import { useState } from "react";
import { connect } from 'react-redux';
import { ThreeDots } from 'react-loader-spinner';
import { set_initial_password } from '../../redux/actions/auth';
import { setAlert } from '../../redux/actions/alert';
import { passwordErrors } from '../../lib/passwordPolicy';

/**
 * Se muestra cuando el login responde "user needs to reset the password":
 * la cuenta existe pero no tiene contraseña (usuarios migrados o reseteados por el admin).
 */
const MigrationPasswordForm = ({ email, onCancel, set_initial_password, setAlert }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const errors = password ? passwordErrors(password) : [];

    const onSubmit = async (e) => {
        e.preventDefault();

        if (errors.length > 0) {
            setAlert('La contraseña no cumple con los requisitos', false, 'text-red-600', 'bg-gray-200', 3500);
            return;
        }
        if (password !== confirmPassword) {
            setAlert('Las contraseñas no coinciden', false, 'text-red-600', 'bg-gray-200', 3500);
            return;
        }

        setLoading(true);
        const response = await set_initial_password(email, password, confirmPassword);
        setLoading(false);

        if (response === true) {
            setAlert('Contraseña creada, ¡bienvenido de nuevo!', true, 'text-white', 'bg-green-500', 3000);
        } else if (response[0] === 'limit exceeded, too many requests') {
            setAlert('Demasiados intentos, espera un minuto e inténtalo de nuevo', false, 'text-red-600', 'bg-gray-200', 3500);
        } else {
            setAlert('No pudimos crear la contraseña. Si el problema sigue, escribe a cashflowapp2024@gmail.com', false, 'text-red-600', 'bg-gray-200', 5000);
        }
    };

    const inputClass = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white";

    return (
        <form className="space-y-5" onSubmit={onSubmit}>
            <div className="rounded-lg bg-blue-50 dark:bg-gray-700 p-4 text-sm text-gray-800 dark:text-gray-100">
                <p className="font-semibold mb-1">Actualizamos Topi.</p>
                <p>Migramos la plataforma y por seguridad debes crear una nueva contraseña.</p>
                <p className="mt-2">Si antes entrabas con Google, crea aquí una contraseña para tu correo.</p>
            </div>

            <div>
                <label htmlFor="migration-email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email</label>
                <input type="email" id="migration-email" value={email} disabled className={inputClass + " opacity-70"} />
            </div>
            <div>
                <label htmlFor="new-password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nueva contraseña</label>
                <input type="password" id="new-password" name="password" placeholder="••••••••" required
                    value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
                <ul className="mt-2 text-xs text-red-500">
                    {errors.map(msg => <li key={msg}>{msg}</li>)}
                </ul>
            </div>
            <div>
                <label htmlFor="confirm-new-password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Confirma la contraseña</label>
                <input type="password" id="confirm-new-password" name="confirm_password" placeholder="••••••••" required
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
            </div>

            {loading ?
                <div className="w-full text-white bg-blue-700 rounded-lg text-sm px-5 py-2.5">
                    <div className='flex justify-center items-center'>
                        <ThreeDots height="20" width="20" color="white" ariaLabel="loading" />
                    </div>
                </div>
                :
                <button type="submit"
                    className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">
                    Crear contraseña y entrar
                </button>
            }
            <button type="button" onClick={onCancel} className="w-full text-sm text-blue-700 hover:underline dark:text-blue-500">
                Volver al inicio de sesión
            </button>
        </form>
    );
};

export default connect(null, { set_initial_password, setAlert })(MigrationPasswordForm);
