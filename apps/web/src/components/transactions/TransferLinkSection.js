import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/solid';
import { setAlert } from '../../redux/actions/alert';
import { get_net_worth, fetch_fx_rate } from '../../redux/actions/fx';
import { link_transfer, unlink_transfer, fetch_transfer_candidates } from '../../redux/actions/transfers';
import InputMoneyInt2Decs from '../InputMoneyInt2Decs';
import Button from '../ui/Button';
import { formatMoney, formatedCurrToNumber, isOpenAccount } from '../helpers';

const fieldClass = 'bg-gray-50 p-2 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white';

const toNumber = (value) => (typeof value === 'number' ? value : Number(formatedCurrToNumber(String(value ?? ''))));
const shortDate = (date) => moment(date).format('DD-MM-YYYY');

// Marca una transacción como una pata de una transferencia entre cuentas propias: la liga con un
// movimiento que ya existe (las candidatas que propone la API) o crea el que falta en otra cuenta.
// Ligada, deja de contar como ingreso o gasto; la categoría y el presupuesto siguen viéndola.
const TransferLinkSection = ({ detailInfo, setDetailInfo, onChanged, user_accounts, setAlert, get_net_worth }) => {
    const accounts = useMemo(() => user_accounts?.items || [], [user_accounts]);
    const [open, setOpen] = useState(false);
    const [candidates, setCandidates] = useState(null); // null = cargando
    const [choice, setChoice] = useState('');          // "tx:<id>" o "account"
    const [accountId, setAccountId] = useState('');
    const [amount, setAmount] = useState(null);        // monto de la otra pata entre monedas
    const [rate, setRate] = useState(null);
    const [saving, setSaving] = useState(false);

    const id = detailInfo?.id;
    const linked = Boolean(detailInfo?.transfer_group_id);
    const currency = detailInfo?.currency || 'COP';
    const others = accounts.filter(a => isOpenAccount(a) && String(a.id) !== String(detailInfo?.account?.id));
    const target = others.find(a => String(a.id) === String(accountId));
    const targetCurrency = target?.currency || 'COP';
    const crossCurrency = Boolean(target) && targetCurrency !== currency;

    useEffect(() => { setOpen(false); setChoice(''); setAccountId(''); setAmount(null); }, [id]);

    // candidatas de esta transacción (la API devuelve las de todo el usuario)
    useEffect(() => {
        let active = true;
        if (!open || linked) return undefined;
        setCandidates(null);
        fetch_transfer_candidates().then(list => {
            if (!active) return;
            const mine = (list || []).filter(c => c.out_transaction_id === id || c.in_transaction_id === id);
            setCandidates(mine);
            setChoice(mine.length ? `tx:${detailInfo.expense ? mine[0].in_transaction_id : mine[0].out_transaction_id}` : 'account');
        });
        return () => { active = false; };
    }, [open, linked, id]); // eslint-disable-line react-hooks/exhaustive-deps

    // tasa del día de la transacción para prellenar el monto en la otra moneda
    useEffect(() => {
        let active = true;
        setRate(null);
        setAmount(null);
        if (crossCurrency) {
            fetch_fx_rate(currency, targetCurrency, moment(detailInfo.date).format('YYYY-MM-DD'))
                .then(q => { if (active) setRate(q?.rate ? Number(q.rate) : null); });
        }
        return () => { active = false; };
    }, [crossCurrency, currency, targetCurrency, detailInfo?.date]);

    if (!detailInfo) return null;

    const prefilled = rate ? Math.round(Number(detailInfo.amount) * rate * 100) / 100 : 0;
    const counterpartAmount = amount === null ? prefilled : toNumber(amount);
    const accountName = (accountIdValue) => {
        const a = accounts.find(x => String(x.id) === String(accountIdValue));
        return a ? `${a.name} ••${a.last_four_digits}` : 'otra cuenta';
    };
    const valid = choice.startsWith('tx:') || (choice === 'account' && target && (!crossCurrency || counterpartAmount > 0));

    const unlink = async () => {
        setSaving(true);
        const result = await unlink_transfer(detailInfo.transfer_group_id);
        setSaving(false);
        if (!result.ok) {
            setAlert('No se pudo desligar la transferencia, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setDetailInfo({ ...detailInfo, transfer_group_id: null });
        setAlert('Listo: vuelve a contar como ingreso o gasto.', true, '', '', 2500);
        onChanged && onChanged();
        get_net_worth();
    };

    const link = async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        const request = choice.startsWith('tx:')
            ? { counterpartTransactionId: choice.slice(3) }
            : { counterpartAccountId: target.id, counterpartAmount: crossCurrency ? counterpartAmount : undefined };
        const result = await link_transfer(id, request);
        setSaving(false);
        if (!result.ok) {
            const msg = result.status === 409
                ? 'Ese movimiento ya es parte de otra transferencia.'
                : 'No se pudo ligar la transferencia, intenta de nuevo.';
            setAlert(msg, false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setDetailInfo({ ...detailInfo, transfer_group_id: result.data.transfer_group_id });
        setOpen(false);
        setAlert('Transferencia ligada: ya no cuenta como ingreso ni gasto.', true, '', '', 3000);
        onChanged && onChanged();
        get_net_worth();
    };

    if (linked) {
        return (
            <section aria-label="Transferencia" className="mt-4 rounded-xl border border-topi-100 bg-topi-50/60 dark:border-gray-700 dark:bg-gray-800 p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-2 text-gray-700 dark:text-gray-200">
                        <ArrowsRightLeftIcon className="mt-0.5 w-4 h-4 shrink-0 text-topi-500" aria-hidden="true" />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">Transferencia entre tus cuentas</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                No cuenta como ingreso ni como gasto. Sigue en el presupuesto de su categoría.
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={unlink} loading={saving}>Desligar</Button>
                </div>
            </section>
        );
    }

    if (!open) {
        return (
            <div className="mt-4">
                <Button variant="ghost" size="sm" icon={ArrowsRightLeftIcon} onClick={() => setOpen(true)}>
                    Es una transferencia entre mis cuentas
                </Button>
            </div>
        );
    }

    return (
        <form onSubmit={link} aria-label="Ligar transferencia" className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-3">
            <p className="font-medium text-gray-900 dark:text-white">¿Cuál es el otro movimiento de esta transferencia?</p>

            {candidates === null ? (
                <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">Buscando el otro movimiento…</p>
            ) : (
                <fieldset className="space-y-2">
                    <legend className="sr-only">Otro movimiento de la transferencia</legend>
                    {candidates.map(c => {
                        const otherId = detailInfo.expense ? c.in_transaction_id : c.out_transaction_id;
                        const otherAccount = detailInfo.expense ? c.in_account_id : c.out_account_id;
                        const otherAmount = detailInfo.expense ? c.in_amount : c.out_amount;
                        const otherCurrency = detailInfo.expense ? c.in_currency : c.out_currency;
                        const otherDate = detailInfo.expense ? c.in_date : c.out_date;
                        const otherDescription = detailInfo.expense ? c.in_description : c.out_description;
                        return (
                            <label key={otherId} className="flex items-start gap-2 cursor-pointer text-gray-700 dark:text-gray-200">
                                <input type="radio" name="transferCounterpart" className="mt-1"
                                    checked={choice === `tx:${otherId}`} onChange={() => setChoice(`tx:${otherId}`)} />
                                <span>
                                    {detailInfo.expense ? '+' : '-'}{formatMoney(otherAmount, otherCurrency)} en {accountName(otherAccount)} · {shortDate(otherDate)}
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">{otherDescription}</span>
                                </span>
                            </label>
                        );
                    })}
                    <label className="flex items-start gap-2 cursor-pointer text-gray-700 dark:text-gray-200">
                        <input type="radio" name="transferCounterpart" className="mt-1"
                            checked={choice === 'account'} onChange={() => setChoice('account')} />
                        <span>{candidates.length ? 'No está: crear el movimiento en otra cuenta' : 'Crear el movimiento en otra cuenta'}</span>
                    </label>
                </fieldset>
            )}

            {choice === 'account' && (
                <div className="space-y-2">
                    <label htmlFor="transferLinkAccount" className="block text-xs text-gray-600 dark:text-gray-300">
                        Cuenta donde {detailInfo.expense ? 'llegó' : 'salió'} el dinero
                    </label>
                    <select id="transferLinkAccount" value={accountId} onChange={e => setAccountId(e.target.value)} className={fieldClass}>
                        <option value="">Elige una cuenta</option>
                        {others.map(a => <option key={a.id} value={a.id}>{a.name} ••{a.last_four_digits} · {a.currency || 'COP'}</option>)}
                    </select>
                    {crossCurrency && (
                        <div>
                            <span className="block text-xs text-gray-600 dark:text-gray-300 mb-1">
                                Monto en {targetCurrency}{rate ? ' (prellenado con la tasa del día)' : ''}
                            </span>
                            <InputMoneyInt2Decs name="counterpartAmount" id="transferLinkAmount" currency={targetCurrency}
                                ariaLabel={`Monto en ${targetCurrency}`}
                                number={amount === null ? prefilled : amount}
                                onChangeCreate={e => { if (toNumber(e.target.value) !== prefilled) setAmount(e.target.value); }} />
                        </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Se crea {detailInfo.expense ? 'la entrada' : 'la salida'} con la misma fecha, descripción y categoría.
                    </p>
                </div>
            )}

            <div className="flex justify-end gap-2">
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" size="sm" disabled={!valid} loading={saving} icon={ArrowsRightLeftIcon}>Ligar</Button>
            </div>
        </form>
    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
});

export default connect(mapStateToProps, { setAlert, get_net_worth })(TransferLinkSection);
