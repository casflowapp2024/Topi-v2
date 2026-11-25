import { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/20/solid';
import { get_automated_emails, link_emails_ask_url, register_email_conexion } from '../../redux/actions/conexions';
import Button from '../ui/Button';
import GoogleUnverifiedHint from '../conexions/GoogleUnverifiedHint';
import { openOAuthPopup, providerLabel, isHidden, hideFor24h } from '../conexions/reconnect';

const FAILED = {
    blocked: 'Tu navegador bloqueó la ventana de permiso. Permite las ventanas emergentes de Topi e inténtalo otra vez.',
    closed: 'Cerraste la ventana antes de dar el permiso. Puedes intentarlo cuando quieras.',
    denied: 'No se dio el permiso, así que Topi sigue sin leer este correo.',
    register: 'No pudimos reconectar el correo. Inténtalo otra vez en un momento.',
};

/**
 * Banner persistente en todas las vistas mientras haya una conexión caída (plan/27 §D): "Topi dejó de leer
 * <proveedor>" + Reconectar en un toque (abre el permiso del proveedor directo). "Ahora no" lo oculta 24 h.
 * El texto no culpa al usuario: los permisos de correo vencen solos.
 */
export const ConnectionDownBanner = ({ emails, get_automated_emails, link_emails_ask_url, register_email_conexion }) => {
    const [, setTick] = useState(0); // re-render after "Ahora no"
    const [url, setUrl] = useState(null);
    const [status, setStatus] = useState('idle'); // idle | waiting | saving | done | error
    const [failure, setFailure] = useState(null);

    const broken = (emails || []).filter(email => !!email.error && !isHidden(email.id));
    const current = broken[0];
    const provider = current?.provider;
    const currentId = current?.id;

    // la URL se pide antes: la ventana tiene que abrirse en el mismo clic
    useEffect(() => {
        let alive = true;
        setUrl(null);
        if (provider) {
            // reconectar la misma conexión no gasta cupo de Google: la API la deja pasar aunque no haya cupos
            link_emails_ask_url(provider, currentId).then((u) => { if (alive && u) setUrl(u); });
        }
        return () => { alive = false; };
    }, [provider, currentId, link_emails_ask_url]);

    if (status === 'done') {
        return (
            <div role="status" className="bg-green-50 dark:bg-green-950/40 border-b border-green-200 dark:border-green-900 text-sm text-gray-800 dark:text-gray-100">
                <div className="max-w-screen-xl mx-auto px-4 py-2 flex items-center gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                    <span className="flex-1">Listo: Topi volvió a leer tu correo. Los movimientos de estos días llegan en unos minutos.</span>
                    <button type="button" onClick={() => setStatus('idle')} className="text-xs font-medium underline">Cerrar</button>
                </div>
            </div>
        );
    }
    if (!current) return null;

    const onReconnect = async () => {
        if (!url) return;
        setFailure(null);
        setStatus('waiting');
        let code;
        try {
            code = await openOAuthPopup(url);
        } catch (err) {
            setFailure(FAILED[err.message] || FAILED.register);
            setStatus('error');
            return;
        }
        setStatus('saving');
        const ok = await register_email_conexion(current.email, code, current.provider);
        await get_automated_emails(0, 20);
        if (ok) {
            setStatus('done');
        } else {
            setFailure(FAILED.register);
            setStatus('error');
        }
    };

    const onLater = () => {
        hideFor24h(current.id);
        setTick(t => t + 1);
    };

    const label = providerLabel(current.provider);
    const others = broken.length - 1;

    return (
        <div role="alert" className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900 text-sm text-gray-800 dark:text-gray-100">
            <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="min-w-0">
                        <p className="font-semibold">Topi dejó de leer {label}</p>
                        <p className="text-gray-700 dark:text-gray-300 break-words">
                            El permiso para leer <span className="font-medium">{current.email}</span> dejó de funcionar; a veces
                            pasa solo. Reconéctalo para seguir recibiendo tus movimientos sin digitarlos
                            {others > 0 ? ` (y ${others} correo${others > 1 ? 's' : ''} más)` : ''}.
                        </p>
                        {current.provider === 'gmail' && <GoogleUnverifiedHint className="mt-1.5" />}
                        {failure && <p className="mt-1.5 text-status-crit dark:text-red-300">{failure}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 pl-7 lg:pl-0">
                    <Button size="sm" onClick={onReconnect} loading={status === 'waiting' || status === 'saving'} disabled={!url}>
                        {status === 'waiting' ? 'Esperando el permiso…' : status === 'saving' ? 'Reconectando…' : 'Reconectar'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onLater}>Ahora no</Button>
                </div>
            </div>
        </div>
    );
};

const mapStateToProps = state => ({
    emails: state.Conexions.automated_emails?.emails,
});

export default connect(mapStateToProps, { get_automated_emails, link_emails_ask_url, register_email_conexion })(ConnectionDownBanner);
