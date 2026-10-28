import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import moment from 'moment-timezone';
//redux
import { connect } from 'react-redux';
import { get_user_transactions } from '../../redux/actions/cashflow';
import { get_net_worth, fetch_fx_rate, create_transfer } from '../../redux/actions/fx';
import { setAlert } from '../../redux/actions/alert';
//components
import InputMoneyInt2Decs from '../InputMoneyInt2Decs';
import Button from '../ui/Button';
import { formatMoney, formatedCurrToNumber, getCurrency, isOpenAccount } from '../helpers';

const fieldClass = 'bg-gray-50 p-2 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white';
const labelClass = 'block mb-1 text-sm font-medium text-gray-900 dark:text-white';

const toNumber = (value) => {
    if (typeof value === 'number') return value;
    return Number(formatedCurrToNumber(String(value ?? '')));
};

// Las categorías guardan el emoji como código unificado ("1f4e6"); en un <option> va el carácter
const emojiChar = (unified) => {
    if (!/^[0-9a-f]+(-[0-9a-f]+)*$/i.test(unified || '')) return unified || '';
    try { return String.fromCodePoint(...unified.split('-').map(h => parseInt(h, 16))); } catch { return ''; }
};

// Tasa legible: en la dirección en que es mayor que 1 (1 US$ = $ 3.157,94 y no 1 $ = US$ 0,0003)
const rateLabel = (rate, fromCur, toCur) => (rate >= 1
    ? `1 ${getCurrency(fromCur).symbol} = ${formatMoney(rate, toCur, { decimals: 2 })}`
    : `1 ${getCurrency(toCur).symbol} = ${formatMoney(1 / rate, fromCur, { decimals: 2 })}`);

// Solo categorías ya creadas (las sugeridas sin crear tienen id negativo)
const createdCategories = (categories) => (categories || []).filter(c => Number(c.id) > 0);

// Categoría por defecto: una que se llame "Transferencia(s)", si no "Otros", si no la primera de gasto
const defaultCategoryId = (categories) => {
    const items = createdCategories(categories);
    const byName = (re) => items.find(c => re.test(c.name || ''));
    return (byName(/transferencia/i) || byName(/^otros$/i) || items.find(c => !c.income) || items[0])?.id ?? '';
};

// Transferencia entre dos cuentas propias, en la misma o en distinta moneda. Entre monedas pide lo
// que salió y lo que llegó (prellenado con la tasa de hoy) y muestra la tasa efectiva frente a la de mercado.
const TransferModal = ({ open, onClose, user_accounts, user_categories, default_limit, get_user_transactions, get_net_worth, setAlert }) => {
    const accounts = useMemo(() => (user_accounts?.items || []).filter(isOpenAccount), [user_accounts]);
    const categories = createdCategories(user_categories?.items);

    const empty = () => ({
        fromId: accounts[0]?.id ?? '',
        toId: accounts[1]?.id ?? '',
        sent: 0,
        received: 0,
        receivedTouched: false,
        date: moment().format('YYYY-MM-DD'),
        categoryId: defaultCategoryId(categories),
        description: '',
    });
    const [form, setForm] = useState(empty);
    const [marketRate, setMarketRate] = useState(null); // 1 origen = ? destino (hoy), null si no hay
    const [saving, setSaving] = useState(false);

    useEffect(() => { if (open) setForm(empty()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const from = accounts.find(a => String(a.id) === String(form.fromId));
    const to = accounts.find(a => String(a.id) === String(form.toId));
    const fromCur = from?.currency || 'COP';
    const toCur = to?.currency || 'COP';
    const crossCurrency = fromCur !== toCur;

    // tasa de mercado del día elegido entre las dos monedas
    useEffect(() => {
        let active = true;
        setMarketRate(null);
        if (open && crossCurrency) {
            fetch_fx_rate(fromCur, toCur, form.date).then(q => { if (active) setMarketRate(q?.rate ? Number(q.rate) : null); });
        }
        return () => { active = false; };
    }, [open, fromCur, toCur, crossCurrency, form.date]);

    const sent = toNumber(form.sent);
    // misma moneda: llega lo mismo que sale; entre monedas, lo que el usuario escriba o la tasa de mercado
    const prefilled = crossCurrency && marketRate ? Math.round(sent * marketRate * 100) / 100 : sent;
    const received = crossCurrency ? (form.receivedTouched ? toNumber(form.received) : prefilled) : sent;
    const effectiveRate = sent > 0 && received > 0 ? received / sent : null;
    const spread = effectiveRate && marketRate ? (effectiveRate / marketRate - 1) * 100 : null;

    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));
    const valid = from && to && from.id !== to.id && sent > 0 && received > 0 && form.categoryId;

    const submit = async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        const isToday = form.date === moment().format('YYYY-MM-DD');
        const when = isToday ? moment() : moment(`${form.date} 12:00`, 'YYYY-MM-DD HH:mm');
        const result = await create_transfer({
            fromAccountId: from.id,
            toAccountId: to.id,
            amountSent: sent,
            amountReceived: received,
            date: when.format('YYYY-MM-DD HH:mm:ss ZZ'),
            categoryId: form.categoryId,
            description: form.description.trim(),
        });
        setSaving(false);
        if (!result.ok) {
            const msg = result.status === 400 ? 'Revisa las cuentas y los montos de la transferencia.' : 'La transferencia no se guardó, intenta de nuevo.';
            setAlert(msg, false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setAlert('Transferencia registrada.', true, '', '', 2500);
        get_user_transactions(0, default_limit);
        get_net_worth();
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} className="relative z-40 font-Inter">
            <div className="fixed inset-0 bg-gray-900/50" aria-hidden="true" />
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                    <DialogPanel className="w-full max-w-md rounded-3xl bg-white dark:bg-[#151C2C] p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                                <ArrowsRightLeftIcon className="w-5 h-5 text-topi-500" aria-hidden="true" />
                                Transferir entre cuentas
                            </DialogTitle>
                            <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                                <span className="sr-only">Cerrar</span>
                            </button>
                        </div>

                        {accounts.length < 2 ? (
                            <p className="text-sm text-gray-600 dark:text-gray-300">Necesitas al menos dos cuentas para transferir.</p>
                        ) : (
                            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="transferFrom" className={labelClass}>Desde</label>
                                    <select id="transferFrom" value={form.fromId} className={fieldClass}
                                        onChange={e => set({ fromId: e.target.value, receivedTouched: false })}>
                                        {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ••{a.last_four_digits} · {a.currency || 'COP'}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="transferTo" className={labelClass}>Hacia</label>
                                    <select id="transferTo" value={form.toId} className={fieldClass}
                                        onChange={e => set({ toId: e.target.value, receivedTouched: false })}>
                                        {accounts.map(a => <option key={a.id} value={a.id} disabled={String(a.id) === String(form.fromId)}>
                                            {a.name} ••{a.last_four_digits} · {a.currency || 'COP'}</option>)}
                                    </select>
                                </div>

                                <div className={crossCurrency ? '' : 'sm:col-span-2'}>
                                    <span className={labelClass}>{crossCurrency ? 'Monto enviado' : 'Monto'}</span>
                                    <InputMoneyInt2Decs name="sent" id="transferSent" currency={fromCur}
                                        ariaLabel={crossCurrency ? 'Monto enviado' : 'Monto'}
                                        number={form.sent}
                                        onChangeCreate={e => set({ sent: e.target.value })} />
                                </div>
                                {crossCurrency && (
                                    <div>
                                        <span className={labelClass}>Monto recibido</span>
                                        <InputMoneyInt2Decs name="received" id="transferReceived" currency={toCur}
                                            ariaLabel="Monto recibido"
                                            number={form.receivedTouched ? form.received : prefilled}
                                            onChangeCreate={e => {
                                                // el input avisa también al montarse: solo cuenta si cambió el valor
                                                if (toNumber(e.target.value) !== prefilled) set({ received: e.target.value, receivedTouched: true });
                                            }} />
                                    </div>
                                )}

                                {crossCurrency && (
                                    <div className="sm:col-span-2 rounded-xl bg-slate-50 dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
                                        {effectiveRate ? (
                                            <p>Tasa efectiva: <b className="text-gray-900 dark:text-white">{rateLabel(effectiveRate, fromCur, toCur)}</b></p>
                                        ) : <p>Escribe los montos para ver la tasa efectiva.</p>}
                                        {marketRate ? (
                                            <p>Tasa de mercado del día: {rateLabel(marketRate, fromCur, toCur)}
                                                {spread !== null && Math.abs(spread) >= 0.01 && (
                                                    <> · <span className={spread < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}>
                                                        {spread > 0 ? '+' : ''}{spread.toFixed(2).replace('.', ',')} %</span></>
                                                )}
                                            </p>
                                        ) : <p>Aún no hay tasa de mercado {fromCur}→{toCur} para esa fecha.</p>}
                                    </div>
                                )}

                                <div>
                                    <label htmlFor="transferDate" className={labelClass}>Fecha</label>
                                    <input id="transferDate" type="date" value={form.date} max={moment().format('YYYY-MM-DD')}
                                        onChange={e => set({ date: e.target.value })} className={fieldClass} required />
                                </div>
                                <div>
                                    <label htmlFor="transferCategory" className={labelClass}>Categoría</label>
                                    <select id="transferCategory" value={form.categoryId} className={fieldClass}
                                        onChange={e => set({ categoryId: e.target.value })}>
                                        {categories.map(c => <option key={c.id} value={c.id}>{emojiChar(c.emoji)} {c.name}</option>)}
                                    </select>
                                </div>
                                <div className="sm:col-span-2">
                                    <label htmlFor="transferDescription" className={labelClass}>Descripción (opcional)</label>
                                    <input id="transferDescription" type="text" maxLength={255} value={form.description}
                                        placeholder="Transferencia" onChange={e => set({ description: e.target.value })} className={fieldClass} />
                                </div>

                                <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
                                    Se crean dos movimientos ligados (una salida y una entrada); no cuentan como ingreso ni como gasto.
                                </p>
                                <div className="sm:col-span-2 flex justify-end gap-2">
                                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                                    <Button type="submit" disabled={!valid} loading={saving} icon={ArrowsRightLeftIcon}>Transferir</Button>
                                </div>
                            </form>
                        )}
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    user_categories: state.CashFlow.user_categories,
    default_limit: state.CashFlow.user_transactions.default_limit,
});

export default connect(mapStateToProps, { get_user_transactions, get_net_worth, setAlert })(TransferModal);
