import { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { fetch_notification_prefs, save_notification_prefs } from '../../redux/actions/notifications';
import { setAlert } from '../../redux/actions/alert';

const OPTIONS = [
    {
        key: 'email_monthly_summary',
        title: 'Resumen mensual',
        text: 'El día 1 de cada mes: ingresos, gastos, ahorro y dónde más gastaste el mes anterior.',
    },
    {
        key: 'email_connection_alerts',
        title: 'Avisos de conexiones',
        text: 'Si Topi deja de poder leer uno de tus correos, te avisamos para que lo reconectes (máximo uno por semana).',
    },
];

const Toggle = ({ checked, disabled, onChange, label }) => (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 disabled:opacity-60 ${checked ? 'bg-[#5266EB]' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
);

/**
 * Ajustes > Correos. El resumen mensual está apagado hasta que el usuario lo active.
 * Los correos de seguridad (códigos para la contraseña y para confirmar el correo) siempre llegan.
 */
const EmailPrefsSetts = ({ user, setAlert }) => {
    const [prefs, setPrefs] = useState(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        fetch_notification_prefs().then(data => {
            if (!alive) return;
            if (data) setPrefs(data); else setFailed(true);
        });
        return () => { alive = false; };
    }, []);

    const toggle = async (key) => {
        const previous = prefs;
        const next = { ...prefs, [key]: !prefs[key] };
        setPrefs(next);
        setSaving(true);
        const saved = await save_notification_prefs(next);
        setSaving(false);
        if (saved) {
            setPrefs(saved);
        } else {
            setPrefs(previous);
            setAlert('No pudimos guardar tus preferencias. Inténtalo de nuevo', false, 'text-white', 'bg-red-500', 3000);
        }
    };

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-400">
                        <EnvelopeIcon className="w-[22px] h-[22px]" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Correos de Topi</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Se envían a {user?.email || 'tu correo'}</p>
                    </div>
                </div>

                {failed && <p className="text-sm text-red-600 dark:text-red-400">No pudimos cargar tus preferencias.</p>}
                {!prefs && !failed && <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>}

                {prefs &&
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                        {OPTIONS.map(opt => (
                            <li key={opt.key} className="flex items-start justify-between gap-4 py-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{opt.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{opt.text}</p>
                                </div>
                                <Toggle checked={!!prefs[opt.key]} disabled={saving} label={opt.title} onChange={() => toggle(opt.key)} />
                            </li>
                        ))}
                    </ul>
                }
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
                Los correos de seguridad (códigos para cambiar la contraseña o confirmar tu correo) siempre te llegan.
            </p>
        </div>
    );
};

const mapStateToProps = state => ({
    user: state.Auth.user,
});

export default connect(mapStateToProps, { setAlert })(EmailPrefsSetts);
