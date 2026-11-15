import { useState } from 'react';
import { BuildingLibraryIcon } from '@heroicons/react/20/solid';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { requestBankSample } from '../../../apiCalls/reading';

/**
 * "Todavía no vemos movimientos de tu banco" (plan/27 §C): una conexión sana con cuentas ligadas y 0 movimientos
 * tras 48 h. Muestra los bancos que Topi lee y, si el equipo configuró un buzón, pide reenviar un correo de
 * ejemplo. Ese correo llega al buzón del equipo, nunca a la app.
 */
const UnsupportedBankNotice = ({ connection, supportedBanks = [], samplesAddress = '' }) => {
    const [shown, setShown] = useState(null); // dirección revelada tras pedirla
    const [copied, setCopied] = useState(false);

    if (!connection) return null;
    const unsupported = (connection.banks || []).filter(b => !b.supported);
    const bank = unsupported[0] || (connection.banks || [])[0];

    const reveal = async () => {
        try {
            const address = await requestBankSample(bank?.id);
            setShown(address || samplesAddress);
        } catch {
            setShown(samplesAddress);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(shown);
            setCopied(true);
        } catch { /* sin portapapeles: la dirección queda visible */ }
    };

    return (
        <Card role="status" className="border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-3">
                <BuildingLibraryIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">Todavía no vemos movimientos de tu banco</h2>
                    <p>
                        {unsupported.length > 0
                            ? <>Topi aún no sabe leer las notificaciones de <strong>{unsupported.map(b => b.name).join(', ')}</strong>.</>
                            : 'Tu correo está conectado, pero en dos días no encontramos notificaciones que sepamos leer.'}
                        {' '}Hoy leemos: {supportedBanks.join(', ')}.
                    </p>
                    <p>
                        Revisa que tu banco te envíe las notificaciones a este correo
                        y que la cuenta en Topi tenga el banco correcto.
                    </p>
                    {samplesAddress && !shown && (
                        <div>
                            <Button size="sm" variant="secondary" onClick={reveal}>Ayudar a agregar mi banco</Button>
                        </div>
                    )}
                    {shown && (
                        <div className="flex flex-col gap-1.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3">
                            <p>
                                Reenvía un correo de notificación de tu banco (por ejemplo, el aviso de una compra) a:
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <code className="font-semibold text-gray-900 dark:text-white break-all">{shown}</code>
                                <Button size="sm" variant="ghost" onClick={copy}>{copied ? 'Copiado' : 'Copiar'}</Button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Solo lo usamos para aprender a leer tu banco y luego lo borramos. No queda guardado en Topi.
                                Si quieres, tapa los números de cuenta antes de reenviarlo.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default UnsupportedBankNotice;
