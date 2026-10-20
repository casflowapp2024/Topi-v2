import { useState } from "react";
import { connect } from 'react-redux';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { change_password } from '../../redux/actions/auth';
import { setAlert } from '../../redux/actions/alert';
import { passwordErrors } from '../../lib/passwordPolicy';

const emptyForm = { current_password: '', password: '', confirm_password: '' };

// Cambiar contraseña: la API cierra las demás sesiones y devuelve tokens nuevos para esta
const ChangePasswordCard = ({ change_password, setAlert }) => {
    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(false);

    const errors = form.password ? passwordErrors(form.password) : [];
    const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();

        if (errors.length > 0) {
            setAlert("La nueva contraseña no cumple con los requisitos", false, "text-white", "bg-red-500", 3000);
            return;
        }
        if (form.password !== form.confirm_password) {
            setAlert("Las contraseñas no coinciden", false, "text-white", "bg-red-500", 3000);
            return;
        }

        setLoading(true);
        const response = await change_password(form.current_password, form.password, form.confirm_password);
        setLoading(false);

        if (response === true) {
            setForm(emptyForm);
            setAlert("Contraseña actualizada", true, "text-white", "bg-green-500", 3000);
        } else if (response[0] === "user is not authorized, incorrect username or password") {
            setAlert("La contraseña actual es incorrecta", false, "text-white", "bg-red-500", 3000);
        } else {
            setAlert("No se pudo cambiar la contraseña", false, "text-white", "bg-red-500", 3000);
        }
    };

    const inputClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#5266EB]/50";

    return (
        <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-4 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-400">
                    <LockClosedIcon className="w-[22px] h-[22px]" />
                </div>
                <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Cambiar contraseña</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Se cerrarán tus otras sesiones</p>
                </div>
            </div>
            <input type="password" name="current_password" placeholder="Contraseña actual" required
                value={form.current_password} onChange={onChange} className={inputClass} autoComplete="current-password" />
            <input type="password" name="password" placeholder="Nueva contraseña" required
                value={form.password} onChange={onChange} className={inputClass} autoComplete="new-password" />
            <ul className="text-xs text-red-500">
                {errors.map(msg => <li key={msg}>{msg}</li>)}
            </ul>
            <input type="password" name="confirm_password" placeholder="Confirma la nueva contraseña" required
                value={form.confirm_password} onChange={onChange} className={inputClass} autoComplete="new-password" />
            <button type="submit" disabled={loading}
                className="bg-[#5266EB] hover:bg-blue-600 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                {loading ? "Guardando..." : "Cambiar contraseña"}
            </button>
        </form>
    );
};

export default connect(null, { change_password, setAlert })(ChangePasswordCard);
