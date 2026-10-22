import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
import { get_automated_emails, delete_automated_email } from '../../redux/actions/conexions';
import { setAlert } from '../../redux/actions/alert';
//components
import LinkTransEmailForm from './LinkTransEmailForm';
import { emailsAutomationErrors } from '../errosMaping';
import { brokenEmails, linkEmailAndReadNow, snoozeConnectEmail } from './emailConnection';
import { ThreeDots } from 'react-loader-spinner';
import { CheckCircleIcon, EnvelopeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

// Pantalla a la que llega, al iniciar sesión, quien no tiene ninguna conexión de correo utilizable.
const ConnectEmail = ({
    //actions
    get_automated_emails,
    delete_automated_email,
    linkEmailAndReadNow,
    setAlert,
    //state
    automated_emails,
}) => {

    const navigate = useNavigate();
    // 'form' | 'linking' | 'read' | 'no_accounts' | 'error'
    const [status, setStatus] = useState('form');
    const [reconnect, setReconnect] = useState(null); // {email, provider} a precargar en el formulario
    const [removing, setRemoving] = useState(null);

    const broken = brokenEmails(automated_emails);

    const handleLater = () => {
        snoozeConnectEmail();
        navigate('/dashboard');
    };

    const handleLinked = async (emailAddress) => {
        setStatus('linking');
        setStatus(await linkEmailAndReadNow(emailAddress));
    };

    // El refresh token viejo no sirve: se elimina la conexión y se vuelve a autorizar.
    const handleReconnect = async (email) => {
        setRemoving(email.id);
        const deleted = await delete_automated_email(email.id);
        await get_automated_emails(0, 20);
        setRemoving(null);
        if (deleted === true) {
            setReconnect({ email: email.email, provider: email.provider });
        } else {
            setAlert('Algo salió mal, intenta de nuevo', true, 'text-white', 'bg-red-500', 3000);
        }
    };

    const errorText = (code) => {
        const info = emailsAutomationErrors[code];
        return (info && info.exp) || 'La conexión dejó de funcionar.';
    };

    return (
        <div className="w-full flex justify-center px-2 py-4 md:py-8" data-testid="connect-email">
            <div className="w-full max-w-2xl bg-white dark:bg-[#151C2C] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8 flex flex-col gap-4">

                <div className="flex flex-row items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#5266EB]/10 flex items-center justify-center shrink-0">
                        <EnvelopeIcon className="w-6 h-6 text-[#5266EB]" />
                    </div>
                    <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                        {broken.length > 0 ? 'Reconecta tu correo' : 'Conecta tu correo'}
                    </h1>
                </div>

                {status === 'form' && (
                    <>
                        <p className="text-sm text-gray-500 dark:text-gray-300 text-justify">
                            Topi lee los correos de notificación de tu banco para registrar tus transacciones automáticamente.
                            Conecta el correo donde los recibes y leeremos tus últimas transacciones ahora mismo.
                        </p>

                        {broken.length > 0 && !reconnect && (
                            <div className="flex flex-col gap-2">
                                {broken.map(email => (
                                    <div key={email.id} className="flex flex-col md:flex-row md:items-center gap-2 justify-between rounded-xl border border-yellow-300 bg-yellow-50 p-3">
                                        <div className="flex flex-row gap-2 items-start">
                                            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 shrink-0" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-900">Tu conexión con {email.email} dejó de funcionar</span>
                                                <span className="text-xs text-gray-600">{errorText(email.error)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleReconnect(email)}
                                            disabled={removing !== null}
                                            className="w-full md:w-max shrink-0 bg-[#5266EB] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-60"
                                        >
                                            {removing === email.id ? 'Desconectando…' : 'Reconectar'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <LinkTransEmailForm
                            key={reconnect ? reconnect.email : 'new'}
                            closedForm={null}
                            onCloseForm={null}
                            onSelectValue={null}
                            contextWindow="onboarding"
                            onLinked={handleLinked}
                            initialEmail={reconnect ? reconnect.email : ""}
                            initialProvider={reconnect ? reconnect.provider : null}
                        />

                        <div className="flex justify-end">
                            <button
                                onClick={handleLater}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-300 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                Hacerlo más tarde
                            </button>
                        </div>
                    </>
                )}

                {status === 'linking' && (
                    <div className="flex flex-col items-center py-6">
                        <ThreeDots color="#5266EB" height={40} />
                        <p className="text-sm text-gray-500 dark:text-gray-300">Preparando la lectura de tus transacciones…</p>
                    </div>
                )}

                {status !== 'form' && status !== 'linking' && (
                    <div className="flex flex-col items-center text-center gap-3 py-4">
                        {status === 'read' && (
                            <>
                                <CheckCircleIcon className="w-14 h-14 text-green-500" />
                                <p className="text-lg font-medium text-gray-900 dark:text-white">¡Correo conectado!</p>
                                <p className="text-sm text-gray-500 dark:text-gray-300">
                                    Estamos leyendo tus últimas transacciones; aparecerán en unos minutos. Después Topi las leerá automáticamente cada hora.
                                </p>
                            </>
                        )}
                        {status === 'no_accounts' && (
                            <>
                                <CheckCircleIcon className="w-14 h-14 text-green-500" />
                                <p className="text-lg font-medium text-gray-900 dark:text-white">¡Correo conectado!</p>
                                <p className="text-sm text-gray-500 dark:text-gray-300">
                                    Para leer tus transacciones, crea la cuenta bancaria que te notifica a este correo.
                                </p>
                                <Link to="/dashboard/accounts" className="bg-[#5266EB] text-white text-sm font-medium px-6 py-2 rounded-xl hover:bg-blue-600 transition-colors">
                                    Crear cuenta
                                </Link>
                            </>
                        )}
                        {status === 'error' && (
                            <>
                                <ExclamationTriangleIcon className="w-14 h-14 text-yellow-500" />
                                <p className="text-sm text-gray-500 dark:text-gray-300">
                                    El correo quedó conectado, pero no pudimos iniciar la lectura ahora. Topi la hará automáticamente en la próxima hora.
                                </p>
                            </>
                        )}
                        <Link to="/dashboard" className="text-sm font-medium text-[#5266EB] hover:underline">
                            Ir al inicio
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

const mapStateToProps = state => ({
    automated_emails: state.Conexions.automated_emails.emails,
});

export default connect(mapStateToProps, {
    get_automated_emails,
    delete_automated_email,
    linkEmailAndReadNow,
    setAlert,
})(ConnectEmail);
