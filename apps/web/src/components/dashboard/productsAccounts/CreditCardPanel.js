import { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { CreditCardIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/20/solid';
import { setAlert } from '../../../redux/actions/alert';
import { get_net_worth } from '../../../redux/actions/fx';
import { fetch_credit_cards, save_credit_card } from '../../../redux/actions/creditCards';
import InputMoneyInt2Decs from '../../InputMoneyInt2Decs';
import Button from '../../ui/Button';
import CardReconcile from './CardReconcile';
import { set_dash_account_activated } from '../../../redux/actions/reports';
import { formatMoney, formatedCurrToNumber } from '../../helpers';

const fieldClass = 'bg-gray-50 p-2 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white';
const labelClass = 'block mb-1 text-xs font-medium text-gray-600 dark:text-gray-300';
const fmtDate = (d) => moment(d).format('DD-MM-YYYY');

const Box = ({ label, children, hint, className = '' }) => (
    <div className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 ${className}`}>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <div className="mt-1 text-lg font-bold">{children}</div>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
);

// Resumen de una tarjeta de crédito (reemplaza al resumen de la cuenta): deuda estimada, consumos de
// este corte y el último corte con su fecha límite.
// Los pagos son transferencias desde otra cuenta: no cuentan como ingreso.
const CreditCardPanel = ({ account, data, setAlert, net_worth, get_net_worth, set_dash_account_activated }) => {
    const [reconcile, setReconcile] = useState(false);
    const currency = account?.currency || 'COP';
    const [card, setCard] = useState(null);       // estado de hoy (null = cargando)
    const [form, setForm] = useState(null);       // null = cerrado
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!account?.id) return;
        const list = await fetch_credit_cards();
        setCard((list || []).find(c => c.account_id === account.id) || {});
    }, [account?.id]);

    useEffect(() => { setForm(null); setReconcile(false); setCard(null); load(); }, [load]);
    // El saldo de la cuenta (para detectar cargos sin registrar) sale del patrimonio de hoy
    useEffect(() => { get_net_worth(); }, [get_net_worth, data]);
    // el saldo cambia con cada movimiento del periodo: se recalcula cuando cambia el resumen
    useEffect(() => { load(); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!account) return null;

    const openForm = () => setForm({
        creditLimit: card?.credit_limit != null ? Number(card.credit_limit) : 0,
        statementDay: card?.statement_day ?? '',
        dueDay: card?.due_day ?? '',
        interestRateEA: card?.interest_rate_ea ?? '',
    });

    const save = async (e) => {
        e.preventDefault();
        setSaving(true);
        const limit = Number(formatedCurrToNumber(String(form.creditLimit ?? '')));
        const result = await save_credit_card(account.id, {
            creditLimit: limit > 0 ? limit : null,
            statementDay: form.statementDay,
            dueDay: form.dueDay,
            interestRateEA: String(form.interestRateEA).replace(',', '.'),
        });
        setSaving(false);
        if (!result.ok) {
            setAlert('Revisa los datos: días entre 1 y 31, cupo y tasa de cero o más.', false, 'text-white', 'bg-red-500', 5000);
            return;
        }
        setForm(null);
        setAlert('Tarjeta actualizada.', true, '', '', 2500);
        load();
    };

    const debt = Number(card?.debt ?? 0);
    const nwBalance = Number((net_worth?.accounts || []).find(a => a.account_id === account.id)?.balance ?? 0);
    // Saldo positivo en una tarjeta: casi siempre son cargos que no llegaron por correo
    // (intereses, cuota de manejo): se pagaron pero no se registraron como gasto.
    const unrecorded = debt === 0 && nwBalance > 0 ? nwBalance : 0;
    const afterReconcile = () => { setReconcile(false); load(); get_net_worth(); set_dash_account_activated({ ...account }); };
    const pending = card?.pending_statement != null ? Number(card.pending_statement) : null;
    const today = moment().startOf('day');
    const overdue = pending > 0 && card?.due_date && moment(card.due_date).isBefore(today);

    return (
        <section aria-label="Tarjeta de crédito" className="p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-md font-bold text-gray-800 dark:text-gray-100">
                    <CreditCardIcon className="w-4 h-4 text-topi-500" aria-hidden="true" />
                    Resumen de la tarjeta
                </h2>
                {!form && !reconcile && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setReconcile(true)} disabled={card === null}
                            title="Compara con la deuda que muestra tu banco y registra lo que falte">Ajustar saldo</Button>
                        <Button size="sm" variant="secondary" onClick={openForm} disabled={card === null}>Configurar</Button>
                    </div>
                )}
            </div>

            {form && (
                <form onSubmit={save} className="mb-4 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="col-span-2">
                        <span className={labelClass}>Cupo ({currency})</span>
                        <InputMoneyInt2Decs name="creditLimit" id="creditLimit" currency={currency} ariaLabel="Cupo de la tarjeta"
                            number={form.creditLimit} onChangeCreate={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
                    </div>
                    <div>
                        <label htmlFor="statementDay" className={labelClass}>Día de corte</label>
                        <input id="statementDay" type="number" inputMode="numeric" min="1" max="31" value={form.statementDay}
                            onChange={e => setForm({ ...form, statementDay: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                        <label htmlFor="dueDay" className={labelClass}>Día límite de pago</label>
                        <input id="dueDay" type="number" inputMode="numeric" min="1" max="31" value={form.dueDay}
                            onChange={e => setForm({ ...form, dueDay: e.target.value })} className={fieldClass} />
                    </div>
                    <div className="col-span-2">
                        <label htmlFor="interestRate" className={labelClass}>Tasa de interés efectiva anual (%) — opcional</label>
                        <input id="interestRate" type="text" inputMode="decimal" value={form.interestRateEA}
                            onChange={e => setForm({ ...form, interestRateEA: e.target.value })} className={`${fieldClass} sm:w-40`} placeholder="28,5" />
                    </div>
                    <p className="col-span-2 text-xs text-gray-500 dark:text-gray-400">
                        Los encuentras en tu extracto. Para los intereses y la cuota de manejo usa las categorías «Intereses» y «Comisiones».
                    </p>
                    <div className="col-span-2 flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancelar</Button>
                        <Button type="submit" size="sm" loading={saving}>Guardar</Button>
                    </div>
                </form>
            )}

            {reconcile && (
                <div className="mb-4">
                    <CardReconcile account={account} balance={nwBalance} card={card}
                        onDone={afterReconcile} onCancel={() => setReconcile(false)} />
                </div>
            )}

            {card === null ? (
                <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">Cargando…</p>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {unrecorded > 0 ? (
                            <Box label="Pagado de más" className="ring-1 ring-status-warn/60 bg-status-warn-soft dark:bg-amber-500/10">
                                <span className="text-status-warn-text dark:text-amber-300">{formatMoney(unrecorded, currency)}</span>
                                <span className="block mt-1 text-xs font-normal text-gray-700 dark:text-gray-300">
                                    Suelen ser intereses o cuota de manejo sin registrar.{' '}
                                    {!reconcile && <button type="button" onClick={() => setReconcile(true)} className="font-semibold text-topi-600 dark:text-indigo-300 underline-offset-2 hover:underline">Ajustar</button>}
                                </span>
                            </Box>
                        ) : (
                            <Box label={card.last_statement ? 'Deuda estimada' : 'Deuda hoy'}
                                hint={card.last_statement ? 'Aproximada: tu banco tiene la cifra exacta.' : (debt === 0 ? 'No debes nada en esta tarjeta.' : undefined)}>
                                <span className={debt > 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-white'}>{formatMoney(debt, currency)}</span>
                            </Box>
                        )}
                        {card.last_statement && (
                            <Box label="Consumos de este corte" hint={`Hasta el ${fmtDate(card.next_statement)}`}>
                                <span className="text-gray-900 dark:text-white">{formatMoney(card.purchases_since, currency)}</span>
                            </Box>
                        )}
                    </div>

                    {card.last_statement ? (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Último corte: {fmtDate(card.last_statement)} · Próximo: {fmtDate(card.next_statement)}
                            </p>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-700 dark:text-gray-200">
                                <span>Compras del corte: <b>{formatMoney(card.statement_debt, currency)}</b></span>
                                <span>Pagado desde el corte: <b>{formatMoney(card.paid_since_statement, currency)}</b></span>
                            </div>
                            {pending > 0 ? (
                                <p className={`flex gap-2 rounded-lg p-2 ${overdue ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                                    <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                    <span>
                                        Este corte suma <b>≈ {formatMoney(pending, currency)}</b>
                                        {card.due_date ? (overdue ? ` y no vemos un pago (la fecha límite fue el ${fmtDate(card.due_date)})` : `: págalo antes del ${fmtDate(card.due_date)}`) : ''}. Tu banco tiene el valor exacto.
                                    </span>
                                </p>
                            ) : (
                                <p className="flex gap-2 rounded-lg p-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                    <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                    Corte pagado.
                                </p>
                            )}
                            {card.installment_purchases > 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Tienes {card.installment_purchases === 1 ? '1 compra' : `${card.installment_purchases} compras`} a cuotas: el banco te cobra solo la cuota de cada mes, así que tu extracto puede pedir menos que esto.
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-3 text-sm text-gray-600 dark:text-gray-300">
                            Configura el día de corte y el de pago para ver tus compras por corte y hasta cuándo pagar.
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default connect(state => ({ net_worth: state.Fx.net_worth }), { setAlert, get_net_worth, set_dash_account_activated })(CreditCardPanel);
