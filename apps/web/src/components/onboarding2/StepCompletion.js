import { useState, useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { ThreeDots } from 'react-loader-spinner';
import { XCircleIcon, CheckCircleIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { formatMoney } from '../helpers'; // Assuming this helper exists and is exported
import { get_user_extra_data } from '../../redux/actions/auth';
import { get_user_transactions } from '../../redux/actions/cashflow';
import { read_email_transactions_trigger } from '../../redux/actions/conexions';
import { setAlert } from '../../redux/actions/alert';
import Alert from '../alert';

const StepCompletion = ({
    onFinish,
    onBack,
    // Redux actions
    read_email_transactions_trigger,
    get_user_transactions,
    setAlert,
    // Redux state
    user_accounts,
    user_transactions,
}) => {
    const [status, setStatus] = useState('idle'); // 'idle', 'processing', 'completed', 'error'
    const loadingMessages = [
        "Iniciando conexión segura...",
        "Buscando nuevas transacciones...",
        "Categorizando tus movimientos...",
        "Casi listo, finalizando detalles..."
    ];
    const [messageIndex, setMessageIndex] = useState(0);
    const [isTimeout, setIsTimeout] = useState(false);

    // 1. Cycle Loading Messages
    useEffect(() => {
        if (status === 'processing') {
            const interval = setInterval(() => {
                setMessageIndex((prev) => (prev < loadingMessages.length - 1 ? prev + 1 : prev));
            }, 10000); // Change every 10 seconds for better feedback
            return () => clearInterval(interval);
        }
    }, [status]);

    // Timeout for polling (1.5 minutes)
    useEffect(() => {
        let timer;
        if (status === 'processing') {
            timer = setTimeout(() => {
                setIsTimeout(true);
            }, 90000); // 1.5 minutes
        } else {
            setIsTimeout(false);
        }
        return () => clearTimeout(timer);
    }, [status]);

    // 2. Poll for Status & Data via get_user_transactions
    useEffect(() => {
        let pollInterval;
        if (status === 'processing' && !isTimeout) {
            pollInterval = setInterval(async () => {
                await get_user_transactions(0, 50);
            }, 4000); // Polling every 4 seconds
        }
        return () => clearInterval(pollInterval);
    }, [status, get_user_transactions, isTimeout]);

    // 3. Observe Completion Status
    useEffect(() => {
        if (status === 'processing' && user_transactions && user_transactions.read_email_onboarding) {
            console.log("Onboarding transactions read completed");
            setStatus('completed');
            setIsTimeout(false);
        }

        if (status === 'error') {
            setAlert("No se pudieron leer las transacciones. Intenta de nuevo.", false, "text-red-500", "bg-red-50");
        }
    }, [user_transactions, status, setAlert]);


    const handleStartProcess = async () => {
        setStatus('processing');
        // Assuming the user just created their first account
        const accountId = user_accounts && user_accounts.items && user_accounts.items.length > 0
            ? user_accounts.items[0].id
            : null;

        if (accountId) {
            const started = await read_email_transactions_trigger(accountId);
            if (!started) {
                setStatus('error');
            }
        };
    };

    return (
        <div className="flex flex-col gap-6 items-center w-full">
            {((user_transactions && user_transactions.read_email_onboarding === false) && status === 'idle') && (
                <button onClick={handleStartProcess}
                    className="my-10 bg-[#5266EB] text-white px-8 py-3 rounded-xl hover:bg-blue-600 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 font-medium text-lg">
                    Leer últimas transacciones
                </button>
            )}

            {status === 'processing' && (user_transactions && user_transactions.read_email_onboarding === false) && (
                <div className="flex flex-col items-center">
                    {isTimeout ? (
                        <div className="flex flex-col items-center gap-4 text-center px-6">
                            <ThreeDots color="#9ca3af" height={40} />
                            <h3 className="text-lg font-bold text-gray-900">Nuestros servidores están ocupados</h3>
                            <p className="text-gray-600">
                                En este momento nuestros servidores están procesando mucha información.
                                <b> Puedes cerrar esta ventana</b>; tus transacciones aparecerán en cualquier momento.
                            </p>
                            <button
                                onClick={onFinish}
                                className="mt-4 bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 shadow-lg transition-all font-medium text-lg w-full sm:w-auto"
                            >
                                Pasos siguientes
                            </button>
                        </div>
                    ) : (
                        <>
                            <ThreeDots color="#5266EB" />
                            <p className="text-lg mt-4 text-gray-600 font-medium animate-pulse">
                                {loadingMessages[messageIndex]}
                            </p>
                            <p className="pt-2 text-sm text-gray-400">Esto puede tomar hasta un minuto. No cierres esta ventana.</p>
                        </>
                    )}
                </div>
            )}

            {(user_transactions && user_transactions.read_email_onboarding) && (
                <div className="animate-fade-in">
                    <div className="w-full flex flex-col items-center animate-fade-in">

                        {(user_transactions && user_transactions.items && user_transactions.items.length > 0) ? (
                            <div className="flex flex-col items-center gap-2 mb-6">
                                <div className="flex items-center gap-2 px-4">
                                    <CheckCircleIcon className="w-8 h-8 text-green-500" />
                                    <h3 className="text-xl font-bold text-gray-900">¡Transacciones encontradas!</h3>
                                </div>
                                <div className="w-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-6 max-h-60 overflow-y-auto">
                                    {user_transactions.items.map((tx, index) => (
                                        <div
                                            key={tx.id}
                                            className={`flex justify-between items-center p-4 ${index !== user_transactions.items.length - 1 ? 'border-b border-gray-200' : ''}`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {tx.expense === false ?
                                                    <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16a34a" class="size-5">
                                                            <path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clip-rule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    :
                                                    <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" class="size-5">
                                                            <path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 0 1 1.06 0l13.72 13.72V8.25a.75.75 0 0 1 1.5 0V19.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1 0-1.5h9.44L3.97 5.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                                                        </svg>
                                                    </div>
                                                }

                                                <div className="flex flex-col">
                                                    <span className="font-medium text-gray-900">{tx.description || tx.name}</span>
                                                    <span className="text-xs text-gray-500">{tx.date}</span>
                                                </div>
                                            </div>

                                            <span className={`font-semibold ${tx.expense !== true ? 'text-green-600' : 'gray-900'}`}>
                                                {formatMoney(tx.amount, tx.currency)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-gray-600 text-center mb-6 text-sm">
                                    Esto es solo el comienzo. <b>Topi</b> seguirá leyendo tus transacciones automáticamente cada hora, generará informes, te ayudará a entender tus finanzas, y lo más importante, <b>te ayudará a cumplir tus metas!</b>
                                </p>

                            </div>
                        ) : (
                            <>
                                <h3 className="text-xl font-bold text-gray-900 my-4">¡Proceso completado!</h3>
                                <div className="flex flex-col items-center gap-2 mb-6 justify-center">
                                    <XCircleIcon className="w-10 h-10 text-red-500" />
                                    <h3 className="w-2/3 text-center text-md font-bold text-gray-900">¡No hay transacciones correspondientes a la información de tu cuenta!</h3>
                                </div>
                            </>
                        )}

                        <button
                            onClick={onFinish}
                            className="bg-green-600 text-white px-8 py-3 rounded-xl hover:bg-green-700 shadow-lg hover:shadow-xl transition-all font-medium text-lg w-full sm:w-auto"
                        >
                            Pasos siguientes
                        </button>

                    </div>
                </div>
            )}


        </div>

    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    user_transactions: state.CashFlow.user_transactions,
});

export default connect(mapStateToProps, {
    read_email_transactions_trigger,
    get_user_transactions,
    setAlert
})(StepCompletion);
