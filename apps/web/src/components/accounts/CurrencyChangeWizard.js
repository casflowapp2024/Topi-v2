import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, ArrowPathIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/solid';
import moment from 'moment-timezone';
import { connect } from 'react-redux';
import { get_user_accounts, create_f_account } from '../../redux/actions/cashflow';
import { get_net_worth, fetch_fx_rate, create_transfer } from '../../redux/actions/fx';
import { setAlert } from '../../redux/actions/alert';
import { change_account_currency, undo_currency_change, close_account } from '../../redux/actions/currency';
import Button from '../ui/Button';
import InputMoneyInt2Decs from '../InputMoneyInt2Decs';
import { formatMoney, formatedCurrToNumber, getBaseCurrency, getCurrency, currencyOptions, isCreditAccount } from '../helpers';

const fieldClass = 'bg-gray-50 p-2 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white';
const labelClass = 'block mb-1 text-sm font-medium text-gray-900 dark:text-white';
const toNumber = (value) => (typeof value === 'number' ? value : Number(formatedCurrToNumber(String(value ?? ''))));

const MODES = (from, to) => [
    {
        id: 'convert',
        title: `Los montos están en ${from}: convertirlos a ${to}`,
        detail: `Cada movimiento se convierte con la tasa de su fecha. Tus reportes en ${getBaseCurrency()} no cambian.`,
    },
    {
        id: 'relabel',
        title: `Los montos ya estaban en ${to}: solo corregir la moneda`,
        detail: 'Los números quedan iguales y se recalcula su valor en tu moneda principal: los reportes del pasado cambian.',
    },
    {
        id: 'close',
        title: `La cuenta cambió: cerrar esta y abrir una nueva en ${to}`,
        detail: 'Esta cuenta queda cerrada con su historia y el saldo pasa a la nueva con una transferencia.',
    },
];

// Cambiar la moneda de una cuenta que ya tiene movimientos. Muestra la vista previa (lo mismo que
// pasaría al aplicar) antes de confirmar y permite deshacer al terminar.
const CurrencyChangeWizard = ({ open, onClose, account, net_worth, user_categories, onChanged,
    get_user_accounts, create_f_account, get_net_worth, setAlert }) => {
    const from = account?.currency || 'COP';
    const base = getBaseCurrency();
    const [currency, setCurrency] = useState('USD');
    const [mode, setMode] = useState('convert');
    const [step, setStep] = useState('choose'); // choose | preview | done
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [applied, setApplied] = useState(null);
    // cerrar y abrir
    const [newName, setNewName] = useState('');
    const [received, setReceived] = useState(null);
    const [rate, setRate] = useState(null);

    const balance = Number(net_worth?.accounts?.find(a => a.account_id === account?.id)?.balance ?? 0);

    useEffect(() => {
        if (!open) return;
        setCurrency(from === 'USD' ? 'COP' : 'USD');
        setMode('convert');
        setStep('choose');
        setPreview(null);
        setApplied(null);
        setReceived(null);
        get_net_worth();
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { setNewName(account ? `${account.name} ${currency}` : ''); setReceived(null); }, [account, currency]);

    useEffect(() => {
        let active = true;
        setRate(null);
        if (open && mode === 'close') {
            fetch_fx_rate(from, currency).then(q => { if (active) setRate(q?.rate ? Number(q.rate) : null); });
        }
        return () => { active = false; };
    }, [open, mode, from, currency]);

    if (!account) return null;
    // el equivalente va en positivo: con una deuda (tarjeta) es lo que pasa a deber la cuenta nueva
    const prefilled = rate ? Math.round(Math.abs(balance) * rate * 100) / 100 : 0;
    const amountReceived = received === null ? prefilled : toNumber(received);

    // currency: la moneda con la que quedó la cuenta
    const finish = (currency) => {
        get_user_accounts(0, 20);
        get_net_worth();
        onChanged && onChanged(currency);
    };

    const loadPreview = async () => {
        setBusy(true);
        const result = await change_account_currency(account.id, { currency, mode });
        setBusy(false);
        if (!result.ok) {
            setAlert('No se pudo calcular el cambio, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setPreview(result.data);
        setStep('preview');
    };

    const apply = async () => {
        setBusy(true);
        const result = await change_account_currency(account.id, { currency, mode, apply: true });
        setBusy(false);
        if (!result.ok) {
            const msg = result.status === 409
                ? `Faltan tasas ${from}→${currency} para algunas fechas; espera a que se carguen o corrige solo la moneda.`
                : 'No se pudo cambiar la moneda, intenta de nuevo.';
            setAlert(msg, false, 'text-white', 'bg-red-500', 5000);
            return;
        }
        setApplied(result.data);
        setStep('done');
        finish(currency);
    };

    const undo = async () => {
        setBusy(true);
        const result = await undo_currency_change(account.id, applied.change_id);
        setBusy(false);
        if (!result.ok) {
            setAlert(result.status === 409 ? 'Ya no se puede deshacer: la cuenta tuvo cambios después.' : 'No se pudo deshacer, intenta de nuevo.',
                false, 'text-white', 'bg-red-500', 5000);
            return;
        }
        setAlert(`Listo: la cuenta volvió a ${from}.`, true, '', '', 3000);
        finish(from);
        onClose();
    };

    // Cerrar y abrir: crear la cuenta nueva, pasar el saldo y cerrar esta
    const closeAndOpen = async () => {
        if (!newName.trim()) return;
        setBusy(true);
        const credit = isCreditAccount(account);
        const created = await create_f_account(newName.trim(), account.last_four_digits, account.type.id, account.bank.id,
            0, null, currency);
        if (created !== 201) {
            setBusy(false);
            setAlert(created === 409 ? 'Ya existe una cuenta con ese nombre y esos dígitos.' : 'No se pudo crear la cuenta nueva.',
                false, 'text-white', 'bg-red-500', 5000);
            return;
        }
        const accounts = await get_user_accounts(0, 50);
        const fresh = (Array.isArray(accounts) ? accounts : []).find(a => a.name === newName.trim()
            && a.last_four_digits === account.last_four_digits && a.currency === currency && a.id !== account.id);
        if (fresh && balance !== 0 && amountReceived > 0) {
            // saldo positivo: sale de esta y entra a la nueva; deuda (tarjeta): al revés
            const positive = balance > 0;
            const transfer = await create_transfer({
                fromAccountId: positive ? account.id : fresh.id,
                toAccountId: positive ? fresh.id : account.id,
                amountSent: positive ? Math.abs(balance) : Math.abs(amountReceived),
                amountReceived: positive ? Math.abs(amountReceived) : Math.abs(balance),
                date: moment().format('YYYY-MM-DD HH:mm:ss ZZ'),
                categoryId: (user_categories?.items || []).find(c => Number(c.id) > 0 && /transferencia/i.test(c.name || ''))?.id
                    ?? (user_categories?.items || []).find(c => Number(c.id) > 0)?.id,
                description: `Cambio de moneda a ${currency}`,
            });
            if (!transfer.ok) {
                setBusy(false);
                setAlert('Se creó la cuenta nueva, pero no se pudo pasar el saldo. Hazlo con «Transferir» y cierra esta cuenta.',
                    false, 'text-white', 'bg-red-500', 7000);
                finish(from);
                return;
            }
        }
        const closed = await close_account(account.id);
        setBusy(false);
        if (!closed.ok) {
            setAlert('La cuenta nueva quedó lista, pero esta no se pudo cerrar. Intenta cerrarla desde editar.', false, 'text-white', 'bg-red-500', 6000);
        } else {
            setAlert(`Listo: ${credit ? 'la tarjeta' : 'la cuenta'} nueva en ${currency} quedó abierta y esta, cerrada.`, true, '', '', 4000);
        }
        finish(from);
        onClose();
    };

    // sin todas las tasas la API no calcula el "después" (null)
    const canCompute = preview && preview.balance_after != null && preview.flows_base_after != null;
    const flowsChange = canCompute ? Number(preview.flows_base_after) - Number(preview.flows_base_before) : 0;

    return (
        <Dialog open={open} onClose={busy ? () => {} : onClose} className="relative z-50 font-Inter">
            {/* se abre encima de la edición de la cuenta: el fondo la oscurece y difumina del todo */}
            <div className="fixed inset-0 bg-black/70 backdrop-blur-md" aria-hidden="true" />
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                    <DialogPanel className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#151C2C] p-5 shadow-2xl ring-1 ring-black/5 dark:ring-white/15 text-left">
                        <div className="flex items-center justify-between mb-3">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                                <ArrowPathIcon className="w-5 h-5 text-topi-500" aria-hidden="true" />
                                Cambiar la moneda de {account.name}
                            </DialogTitle>
                            <button type="button" onClick={onClose} disabled={busy} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                                <span className="sr-only">Cerrar</span>
                            </button>
                        </div>

                        {step === 'choose' && (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="newCurrency" className={labelClass}>Moneda nueva (hoy: {from})</label>
                                    <select id="newCurrency" value={currency} onChange={e => setCurrency(e.target.value)} className={fieldClass}>
                                        {currencyOptions().filter(c => c.code !== from).map(c => (
                                            <option key={c.code} value={c.code}>{c.code} · {c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <fieldset className="space-y-2">
                                    <legend className={labelClass}>¿Qué pasó con esta cuenta?</legend>
                                    {MODES(from, currency).map(m => (
                                        <label key={m.id} className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${mode === m.id ? 'border-topi-500 bg-topi-50/60 dark:bg-gray-800' : 'border-gray-200 dark:border-gray-700'}`}>
                                            <input type="radio" name="currencyMode" className="mt-1" checked={mode === m.id} onChange={() => setMode(m.id)} />
                                            <span>
                                                <span className="block text-sm font-medium text-gray-900 dark:text-white">{m.title}</span>
                                                <span className="block text-xs text-gray-500 dark:text-gray-400">{m.detail}</span>
                                            </span>
                                        </label>
                                    ))}
                                </fieldset>

                                {mode === 'close' && (
                                    <div className="space-y-3 rounded-xl bg-slate-50 dark:bg-gray-800 p-3">
                                        <div>
                                            <label htmlFor="newAccountName" className={labelClass}>Nombre de la cuenta nueva</label>
                                            <input id="newAccountName" type="text" maxLength={255} value={newName}
                                                onChange={e => setNewName(e.target.value)} className={fieldClass} />
                                        </div>
                                        <p className="text-sm text-gray-700 dark:text-gray-200">
                                            {balance < 0 ? 'Deuda de hoy' : 'Saldo de hoy'}: <b>{formatMoney(Math.abs(balance), from)}</b>
                                        </p>
                                        {balance !== 0 && (
                                            <div>
                                                <span className={labelClass}>Equivale en {currency} a{rate ? ' (tasa de hoy)' : ''}</span>
                                                <InputMoneyInt2Decs name="received" id="closeReceived" currency={currency}
                                                    ariaLabel={`Saldo en ${currency}`}
                                                    number={received === null ? prefilled : received}
                                                    onChangeCreate={e => { if (toNumber(e.target.value) !== prefilled) setReceived(e.target.value); }} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex justify-end gap-2">
                                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                                    {mode === 'close'
                                        ? <Button onClick={closeAndOpen} loading={busy} disabled={!newName.trim() || (balance !== 0 && !(amountReceived > 0))}>Cerrar y abrir</Button>
                                        : <Button onClick={loadPreview} loading={busy}>Ver qué va a cambiar</Button>}
                                </div>
                            </div>
                        )}

                        {step === 'preview' && preview && (
                            <div className="space-y-4">
                                <dl className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-xl bg-slate-50 dark:bg-gray-800 p-3">
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">Movimientos</dt>
                                        <dd className="font-semibold text-gray-900 dark:text-white">{preview.transactions}</dd>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 dark:bg-gray-800 p-3">
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">Saldo</dt>
                                        <dd className="font-semibold text-gray-900 dark:text-white flex flex-wrap gap-x-1">
                                            <span>{formatMoney(preview.balance_before, from)}</span>
                                            {canCompute && <span>→ {formatMoney(preview.balance_after, currency)}</span>}
                                        </dd>
                                    </div>
                                    <div className="col-span-2 rounded-xl bg-slate-50 dark:bg-gray-800 p-3">
                                        <dt className="text-xs text-gray-500 dark:text-gray-400">Lo que esta cuenta suma en tus reportes ({base})</dt>
                                        <dd className="font-semibold text-gray-900 dark:text-white">
                                            {!canCompute
                                                ? formatMoney(preview.flows_base_before, base)
                                                : flowsChange === 0
                                                    ? `No cambia: ${formatMoney(preview.flows_base_before, base)}`
                                                    : `${formatMoney(preview.flows_base_before, base)} → ${formatMoney(preview.flows_base_after, base)}`}
                                        </dd>
                                    </div>
                                </dl>
                                {preview.missing_rates > 0 && (
                                    <p className={`flex gap-2 text-sm rounded-xl p-3 ${mode === 'convert' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                                        <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                        {mode === 'convert'
                                            ? `Faltan tasas ${from}→${currency} para convertir ${preview.missing_rates === 1 ? '1 monto' : `${preview.missing_rates} montos`} (movimientos, saldo inicial o valoraciones): no se puede convertir todavía. Las tasas se cargan solas cada día; si el aviso sigue, usa «solo corregir la moneda».`
                                            : `${preview.missing_rates === 1 ? '1 movimiento queda' : `${preview.missing_rates} movimientos quedan`} sin valor en ${base} hasta que llegue su tasa.`}
                                    </p>
                                )}
                                {preview.replaced_rates > 0 && (
                                    <p className="flex gap-2 text-sm rounded-xl p-3 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                        <ExclamationTriangleIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
                                        {preview.replaced_rates === 1 ? '1 tasa editada a mano o de transferencia se reemplaza' : `${preview.replaced_rates} tasas editadas a mano o de transferencias se reemplazan`} por la del mercado.
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400">Puedes deshacerlo mientras no agregues ni edites movimientos de esta cuenta.</p>
                                <div className="flex justify-end gap-2">
                                    <Button variant="secondary" onClick={() => setStep('choose')} disabled={busy}>Atrás</Button>
                                    <Button onClick={apply} loading={busy} disabled={mode === 'convert' && preview.missing_rates > 0}>
                                        Cambiar a {currency}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 'done' && applied && (
                            <div className="space-y-4">
                                <p className="flex gap-2 text-sm text-gray-700 dark:text-gray-200">
                                    <CheckCircleIcon className="w-5 h-5 shrink-0 text-money-in dark:text-money-in-dark" aria-hidden="true" />
                                    La cuenta ahora es en {getCurrency(currency).name} ({currency}). Saldo: {formatMoney(applied.balance_after, currency)}.
                                </p>
                                <div className="flex justify-end gap-2">
                                    <Button variant="secondary" onClick={undo} loading={busy}>Deshacer</Button>
                                    <Button onClick={onClose} disabled={busy}>Listo</Button>
                                </div>
                            </div>
                        )}
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
};

const mapStateToProps = state => ({
    net_worth: state.Fx?.net_worth,
    user_categories: state.CashFlow.user_categories,
});

export default connect(mapStateToProps, { get_user_accounts, create_f_account, get_net_worth, setAlert })(CurrencyChangeWizard);
