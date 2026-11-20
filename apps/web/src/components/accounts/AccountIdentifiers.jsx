import { useEffect, useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid';
import { add_account_identifier, delete_account_identifier, fetch_account_identifiers } from '../../redux/actions/accountIdentifiers';
import { isInvestmentAccount, isValidAccountDigits } from '../helpers';
import Field, { Input } from '../ui/Field';
import Button from '../ui/Button';

const SOURCE_LABEL = { user: 'lo agregaste tú', learned: 'aprendido de tus correcciones' };

/**
 * "Números reconocidos" de una cuenta (plan/32): los dígitos con los que Topi asigna los correos del banco a esta
 * cuenta. Se pueden agregar (tarjeta adicional o renovada) y quitar (uno aprendido por error). No aplica a
 * inversiones. onChanged avisa para recargar las cuentas (el número escrito puede cambiar).
 */
const AccountIdentifiers = ({ account, onChanged }) => {
    const [items, setItems] = useState(null);
    const [adding, setAdding] = useState(false);
    const [digits, setDigits] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const accountId = account?.id;
    const investment = isInvestmentAccount(account);
    useEffect(() => {
        let active = true;
        setItems(null);
        if (accountId && !investment) {
            fetch_account_identifiers(accountId).then(list => { if (active) setItems(list || []); });
        }
        return () => { active = false; };
    }, [accountId, investment]);

    if (!account || investment || items === null) return null;

    const reload = async () => {
        setItems((await fetch_account_identifiers(accountId)) || []);
        if (onChanged) onChanged();
    };

    const add = async (e) => {
        e.preventDefault();
        const value = digits.trim();
        if (!value || !isValidAccountDigits(value)) {
            setError('Escribe 4 números.');
            return;
        }
        setBusy(true);
        const result = await add_account_identifier(accountId, value);
        setBusy(false);
        if (!result.ok) {
            setError(result.status === 409 ? 'Esos dígitos ya son de otra cuenta de este banco.' : 'No se pudo agregar. Intenta de nuevo.');
            return;
        }
        setDigits('');
        setError('');
        setAdding(false);
        reload();
    };

    const remove = async (identifier) => {
        setBusy(true);
        await delete_account_identifier(accountId, identifier.id);
        setBusy(false);
        reload();
    };

    const cancel = () => {
        setAdding(false);
        setDigits('');
        setError('');
    };

    return (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3 flex flex-col gap-2" aria-labelledby="identifiers-title">
            <div className="flex items-center justify-between gap-2">
                <h3 id="identifiers-title" className="text-sm font-semibold text-gray-900 dark:text-gray-100">Números reconocidos</h3>
                {!adding && (
                    <button type="button" onClick={() => setAdding(true)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-topi-600 dark:text-topi-200 hover:underline">
                        <PlusIcon className="w-4 h-4" aria-hidden="true" /> Agregar
                    </button>
                )}
            </div>
            {items.length === 0 ? (
                <p className="text-xs text-ink-2 dark:text-gray-400">
                    Aún ninguno. Si los correos del banco traen los últimos 4 dígitos, Topi los aprende cuando pasas
                    un movimiento a esta cuenta.
                </p>
            ) : (
                <ul className="flex flex-col gap-1">
                    {items.map(identifier => (
                        <li key={identifier.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-gray-800 dark:text-gray-200">
                                <span className="font-medium tabular-nums">••{identifier.digits}</span>
                                <span className="text-xs text-ink-2 dark:text-gray-400"> · {SOURCE_LABEL[identifier.source] || identifier.source}</span>
                            </span>
                            <button type="button" onClick={() => remove(identifier)} disabled={busy}
                                aria-label={`Quitar ••${identifier.digits}`}
                                className="p-1 rounded-lg text-ink-2 hover:text-status-crit-text hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50">
                                <XMarkIcon className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {adding && (
                <form onSubmit={add} noValidate className="flex flex-wrap items-end gap-2">
                    <Field label="Últimos 4 dígitos" id="newIdentifier" error={error} className="flex-1 min-w-[8rem]">
                        <Input type="text" inputMode="numeric" maxLength={4} value={digits} placeholder="1234" autoFocus
                            onChange={e => { setDigits(e.target.value.replace(/\D/g, '')); setError(''); }} />
                    </Field>
                    <Button type="submit" loading={busy}>Agregar</Button>
                    <Button variant="ghost" onClick={cancel}>Cancelar</Button>
                </form>
            )}
        </section>
    );
};

export default AccountIdentifiers;
