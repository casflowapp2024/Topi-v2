import { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { ArrowPathIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/react/20/solid';
import { get_user_accounts } from '../../redux/actions/cashflow';
import { get_net_worth } from '../../redux/actions/fx';
import { setAlert } from '../../redux/actions/alert';
import { fetch_currency_changes, undo_currency_change, close_account, reopen_account } from '../../redux/actions/currency';
import Button from '../ui/Button';
import CurrencyChangeWizard from './CurrencyChangeWizard';

// Herramientas de una cuenta en su edición: cambiar la moneda (con movimientos), deshacer el último
// cambio y cerrar o reabrir la cuenta.
const AccountCurrencyTools = ({ account, setDetailInfo, onCurrencyChanged, get_user_accounts, get_net_worth, setAlert }) => {
    const [openWizard, setOpenWizard] = useState(false);
    const [lastChange, setLastChange] = useState(null);
    const [busy, setBusy] = useState(false);
    const closed = Boolean(account?.closed_at);

    const loadChanges = useCallback(async () => {
        if (!account?.id) return;
        const result = await fetch_currency_changes(account.id);
        setLastChange(result.ok ? (result.data || []).find(c => !c.undone_at) || null : null);
    }, [account?.id]);

    useEffect(() => { loadChanges(); }, [loadChanges]);

    if (!account) return null;

    const undo = async () => {
        setBusy(true);
        const result = await undo_currency_change(account.id, lastChange.id);
        setBusy(false);
        if (!result.ok) {
            setAlert(result.status === 409 ? 'Ya no se puede deshacer: la cuenta tuvo movimientos después del cambio.' : 'No se pudo deshacer, intenta de nuevo.',
                false, 'text-white', 'bg-red-500', 5000);
            return;
        }
        setAlert(`La cuenta volvió a ${lastChange.old_currency}.`, true, '', '', 3000);
        setDetailInfo && setDetailInfo(prev => ({ ...prev, currency: lastChange.old_currency }));
        onCurrencyChanged && onCurrencyChanged(lastChange.old_currency);
        get_user_accounts(0, 20);
        get_net_worth();
        loadChanges();
    };

    const toggleClosed = async () => {
        setBusy(true);
        const result = closed ? await reopen_account(account.id) : await close_account(account.id);
        setBusy(false);
        if (!result.ok) {
            setAlert('No se pudo actualizar la cuenta, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setDetailInfo && setDetailInfo(prev => ({ ...prev, closed_at: result.data?.closed_at ?? null }));
        setAlert(closed ? 'Cuenta reabierta.' : 'Cuenta cerrada: conserva su historia y ya no se ofrece para movimientos nuevos.',
            true, '', '', 3500);
        get_user_accounts(0, 20);
        get_net_worth();
    };

    return (
        <section aria-label="Moneda y estado de la cuenta" className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
                {account.has_transactions && !closed && (
                    <Button variant="secondary" size="sm" icon={ArrowPathIcon} onClick={() => setOpenWizard(true)}>Cambiar moneda…</Button>
                )}
                <Button variant="secondary" size="sm" icon={closed ? LockOpenIcon : LockClosedIcon} onClick={toggleClosed} loading={busy}>
                    {closed ? 'Reabrir cuenta' : 'Cerrar cuenta'}
                </Button>
            </div>
            {closed && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Cerrada el {moment(account.closed_at).format('DD-MM-YYYY')}: conserva su historia, pero no se ofrece para movimientos nuevos.
                </p>
            )}
            {lastChange && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    Último cambio de moneda: {lastChange.old_currency} → {lastChange.new_currency}{' '}
                    ({lastChange.mode === 'convert' ? 'conversión' : 'solo la moneda'}, {moment(lastChange.created_at).format('DD-MM-YYYY')})
                    <button type="button" onClick={undo} disabled={busy} className="font-medium text-topi-600 dark:text-indigo-300 hover:underline">
                        Deshacer
                    </button>
                </p>
            )}
            <CurrencyChangeWizard open={openWizard} account={account}
                onClose={() => { setOpenWizard(false); loadChanges(); }}
                onChanged={(currency) => {
                    loadChanges();
                    setDetailInfo && setDetailInfo(prev => ({ ...prev, currency }));
                    onCurrencyChanged && onCurrencyChanged(currency);
                }} />
        </section>
    );
};

export default connect(null, { get_user_accounts, get_net_worth, setAlert })(AccountCurrencyTools);
