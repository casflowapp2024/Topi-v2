import { useState } from 'react';
import { BuildingLibraryIcon } from '@heroicons/react/20/solid';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { updateBankSender } from '../../../apiCalls/reading';

// dominio de una dirección: "no-reply@arqfinance.com" → "arqfinance.com"
export const senderDomain = (address) => {
    const at = String(address || '').trim().lastIndexOf('@');
    return at > 0 ? address.trim().slice(at + 1).toLowerCase() : '';
};

const VALID = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/**
 * Banco del que Topi no está anotando movimientos (plan/30, bloque 4). Lo decide la primera lectura:
 * - no_emails: no llegó ningún correo de su remitente → se pregunta desde qué correo escribe el banco y, tras
 *   confirmar el dominio, se guarda y se vuelve a leer. Topi lee solo ese remitente.
 * - unreadable: llegaron correos pero ninguno se pudo leer → se dice tal cual; no se pide nada.
 * Sin lista de bancos ni reenvío de ejemplos.
 */
const UnsupportedBankNotice = ({ bank, save = updateBankSender, onSaved }) => {
    const [sender, setSender] = useState('');
    const [step, setStep] = useState('ask'); // ask | confirm | saving | done | error
    if (!bank) return null;

    const domain = senderDomain(sender);
    const valid = VALID.test(sender.trim());

    const confirm = async () => {
        setStep('saving');
        try {
            await save(bank, sender.trim(), bank.account_ids || []);
            setStep('done');
            if (onSaved) onSaved();
        } catch (_) {
            setStep('error');
        }
    };

    if (bank.reading === 'unreadable') {
        return (
            <Card role="status" className="border-amber-200 dark:border-amber-900">
                <div className="flex items-start gap-3">
                    <BuildingLibraryIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300">
                        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Aún no sabemos leer los correos de {bank.name}</h2>
                        <p>
                            Encontramos {bank.found} correo{bank.found === 1 ? '' : 's'} de tu banco, pero todavía no sabemos
                            leerlos. Los anotaremos solos cuando aprendamos; mientras, puedes registrar tus movimientos a mano.
                        </p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card role="status" className="border-amber-200 dark:border-amber-900">
            <div className="flex items-start gap-3">
                <BuildingLibraryIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1 flex flex-col gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">No encontramos correos de {bank.name}</h2>
                    {step === 'done' ? (
                        <p role="status">Listo. Estamos leyendo los correos de <strong>@{domain}</strong>; en un momento verás aquí tus movimientos.</p>
                    ) : (
                        <>
                            <p>
                                {bank.sender
                                    ? <>Buscamos correos de <strong className="break-all">{bank.sender}</strong> y no llegó ninguno reciente. </>
                                    : null}
                                ¿Desde qué correo te escribe tu banco?
                            </p>
                            {step === 'ask' || step === 'error' ? (
                                <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) setStep('confirm'); }}>
                                    <label className="sr-only" htmlFor={`sender-${bank.id}`}>Correo del que te escribe tu banco</label>
                                    <input id={`sender-${bank.id}`} type="email" inputMode="email" autoComplete="off" value={sender}
                                        onChange={(e) => { setSender(e.target.value); if (step === 'error') setStep('ask'); }}
                                        placeholder="notificaciones@tubanco.com"
                                        className="flex-1 min-w-0 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-topi-500" />
                                    <Button size="sm" type="submit" disabled={!valid}>Continuar</Button>
                                </form>
                            ) : (
                                <div className="flex flex-col gap-2 rounded-xl bg-gray-50 dark:bg-gray-900/50 p-3">
                                    <p>Topi leerá solo los correos de <strong>@{domain}</strong> en tu correo conectado.</p>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={confirm} disabled={step === 'saving'}>{step === 'saving' ? 'Guardando…' : 'Confirmar'}</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setStep('ask')} disabled={step === 'saving'}>Cambiar</Button>
                                    </div>
                                </div>
                            )}
                            {step === 'error' && <p className="text-xs text-status-crit-text">No pudimos guardarlo. Inténtalo de nuevo.</p>}
                            <p className="text-xs text-ink-2 dark:text-gray-400">
                                Abre una notificación de tu banco (por ejemplo, el aviso de una compra) y copia el correo del remitente.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default UnsupportedBankNotice;
