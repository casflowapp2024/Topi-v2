import { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { CreditCardIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/20/solid';
import { setAlert } from '../../../redux/actions/alert';
import { get_net_worth } from '../../../redux/actions/fx';
import { fetch_credit_cards, save_credit_card } from '../../../redux/actions/creditCards';
import InputMoneyInt2Decs from '../../InputMoneyInt2Decs';
import Button from '../../ui/Button';
import { formatMoney, formatedCurrToNumber, getBaseCurrency } from '../../helpers';

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

// Resumen de una tarjeta de crédito (reemplaza al resumen de la cuenta): deuda, cupo disponible,
// el último corte con lo que falta pagar y la fecha límite, y lo comprado en el periodo elegido.
// Los pagos son transferencias desde otra cuenta: no cuentan como ingreso.
const CreditCardPanel = ({ account, data, setAlert, net_worth, get_net_worth }) => {
    const currency = account?.currency || 'COP';
    const [card, setCard] = useState(null);       // estado de hoy (null = cargando)
    const [form, setForm] = useState(null);       // null = cerrado
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!account?.id) return;
        const list = await fetch_credit_cards();
        setCard((list || []).find(c => c.account_id === account.id) || {});
    }, [account?.id]);

    useEffect(() => { setForm(null); setCard(null); load(); }, [load]);
    // El saldo de la cuenta (para mostrar un saldo a favor) sale del patrimonio de hoy
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
    const inFavor = debt === 0 && nwBalance > 0 ? nwBalance : 0; // pagaste más de lo que debías
    const limit = card?.credit_limit != null ? Number(card.credit_limit) : null;
    const used = limit ? Math.min(100, Math.round((debt / limit) * 100)) : null;
    const pending = card?.pending_statement != null ? Number(card.pending_statement) : null;
    const today = moment().startOf('day');
    const overdue = pending > 0 && card?.due_date && moment(card.due_date).isBefore(today);
    // el resumen del periodo viene en la moneda base; los pagos (transferencias) no son ingresos y no salen ahí
    const purchases = Math.abs(Number(data?.expenses?.value ?? 0));

    return (
        <section aria-label="Tarjeta de crédito" className="p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-md font-bold text-gray-800 dark:text-gray-100">
                    <CreditCardIcon className="w-4 h-4 text-topi-500" aria-hidden="true" />
                    Resumen de la tarjeta
                </h2>
                {!form && <Button size="sm" variant="secondary" onClick={openForm} disabled={card === null}>Configurar</Button>}
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

            {card === null ? (
                <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">Cargando…</p>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        {inFavor > 0 ? (
                            <Box label="Saldo a favor" hint="Pagaste más de lo que debías: se descuenta de tus próximas compras.">
                                <span className="text-money-in dark:text-money-in-dark">{formatMoney(inFavor, currency)}</span>
                            </Box>
                        ) : (
                            <Box label="Deuda hoy" hint={debt === 0 ? 'No debes nada en esta tarjeta.' : undefined}>
                                <span className={debt > 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-white'}>{formatMoney(debt, currency)}</span>
                            </Box>
                        )}
                        <Box label="Disponible" hint={limit != null ? `De un cupo de ${formatMoney(limit, currency)}` : 'Configura el cupo para verlo'}>
                            <span className="text-gray-900 dark:text-white">{card.available != null ? formatMoney(card.available, currency) : '—'}</span>
                            {used !== null && (
                                <span className="mt-1.5 block h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-600" title={`${used}% del cupo usado`}>
                                    <span className={`block h-full rounded-full ${used >= 90 ? 'bg-red-500' : 'bg-topi-500'}`} style={{ width: `${used}%` }} />
                                </span>
                            )}
                        </Box>
                    </div>

                    {card.last_statement ? (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Último corte: {fmtDate(card.last_statement)} · Próximo: {fmtDate(card.next_statement)}
                            </p>
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-gray-700 dark:text-gray-200">
                                <span>Saldo al corte: <b>{formatMoney(card.statement_debt, currency)}</b></span>
                                <span>Pagado desde el corte: <b>{formatMoney(card.paid_since_statement, currency)}</b></span>
                            </div>
                            {pending > 0 ? (
                                <p className={`flex gap-2 rounded-lg p-2 ${overdue ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                                    <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                                    <span>
                                        Falta pagar <b>{formatMoney(pending, currency)}</b> del corte
                                        {card.due_date ? (overdue ? ` (la fecha límite fue el ${fmtDate(card.due_date)})` : ` antes del ${fmtDate(card.due_date)}`) : ''}.
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
                            Configura el día de corte y el de pago para ver cuánto te falta pagar y hasta cuándo.
                        </p>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Compras y cargos en el periodo elegido: {formatMoney(purchases, getBaseCurrency())}.
                    </p>
                </div>
            )}
        </section>
    );
};

export default connect(state => ({ net_worth: state.Fx.net_worth }), { setAlert, get_net_worth })(CreditCardPanel);
