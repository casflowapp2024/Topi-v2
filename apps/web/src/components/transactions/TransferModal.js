import { useEffect, useMemo, useState } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/20/solid';
import moment from 'moment-timezone';
//redux
import { connect } from 'react-redux';
import { get_user_transactions } from '../../redux/actions/cashflow';
import { get_net_worth, fetch_fx_rate, create_transfer } from '../../redux/actions/fx';
import { setAlert } from '../../redux/actions/alert';
//components
import InputMoneyInt2Decs from '../InputMoneyInt2Decs';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import Field, { Input, Select } from '../ui/Field';
import { formatMoney, formatedCurrToNumber, getCurrency, isOpenAccount } from '../helpers';


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

    const canTransfer = accounts.length >= 2;
    return (
        <Modal open={open} onClose={onClose} title="Transferir entre cuentas"
            description="Se crean dos movimientos ligados; no cuentan como ingreso ni como gasto."
            size="lg"
            footer={canTransfer ? <>
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button type="submit" form="transfer-form" disabled={!valid} loading={saving} icon={ArrowsRightLeftIcon}>Transferir</Button>
            </> : null}>
            {!canTransfer ? (
                <p className="text-sm text-gray-600 dark:text-gray-300">Necesitas al menos dos cuentas para transferir.</p>
            ) : (
                <form id="transfer-form" onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Desde" id="transferFrom">
                        <Select value={form.fromId} onChange={e => set({ fromId: e.target.value, receivedTouched: false })}>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ••{a.last_four_digits} · {a.currency || 'COP'}</option>)}
                        </Select>
                    </Field>
                    <Field label="Hacia" id="transferTo">
                        <Select value={form.toId} onChange={e => set({ toId: e.target.value, receivedTouched: false })}>
                            {accounts.map(a => <option key={a.id} value={a.id} disabled={String(a.id) === String(form.fromId)}>
                                {a.name} ••{a.last_four_digits} · {a.currency || 'COP'}</option>)}
                        </Select>
                    </Field>

                    <div className={`flex flex-col gap-1.5 ${crossCurrency ? '' : 'sm:col-span-2'}`}>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{crossCurrency ? 'Monto enviado' : 'Monto'}</span>
                        <InputMoneyInt2Decs name="sent" id="transferSent" currency={fromCur}
                            ariaLabel={crossCurrency ? 'Monto enviado' : 'Monto'}
                            number={form.sent}
                            onChangeCreate={e => set({ sent: e.target.value })} />
                    </div>
                    {crossCurrency && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Monto recibido</span>
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
                        <div className="sm:col-span-2 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300" aria-live="polite">
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

                    <Field label="Fecha" id="transferDate">
                        <Input type="date" value={form.date} max={moment().format('YYYY-MM-DD')}
                            onChange={e => set({ date: e.target.value })} required />
                    </Field>
                    <Field label="Categoría" id="transferCategory">
                        <Select value={form.categoryId} onChange={e => set({ categoryId: e.target.value })}>
                            {categories.map(c => <option key={c.id} value={c.id}>{emojiChar(c.emoji)} {c.name}</option>)}
                        </Select>
                    </Field>
                    <Field label="Descripción (opcional)" id="transferDescription" className="sm:col-span-2">
                        <Input type="text" maxLength={255} value={form.description}
                            placeholder="Transferencia" onChange={e => set({ description: e.target.value })} />
                    </Field>
                </form>
            )}
        </Modal>
    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    user_categories: state.CashFlow.user_categories,
    default_limit: state.CashFlow.user_transactions.default_limit,
});

export default connect(mapStateToProps, { get_user_transactions, get_net_worth, setAlert })(TransferModal);
