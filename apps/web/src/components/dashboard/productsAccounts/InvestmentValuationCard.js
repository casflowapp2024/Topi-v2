import { useCallback, useEffect, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { ArrowTrendingUpIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/20/solid';
import { get_accounts_status_by_period, get_history_accounts_by_month } from '../../../redux/actions/reports';
import { get_net_worth } from '../../../redux/actions/fx';
import { setAlert } from '../../../redux/actions/alert';
import { fetch_valuations, save_valuation, delete_valuation, fetch_investments } from '../../../redux/actions/valuations';
import InputMoneyInt2Decs from '../../InputMoneyInt2Decs';
import Button from '../../ui/Button';
import { formatMoney, formatedCurrToNumber, accountReportGroup } from '../../helpers';

const fieldClass = 'bg-gray-50 p-2 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white';
const labelClass = 'block mb-1 text-xs font-medium text-gray-600 dark:text-gray-300';

const toNumber = (value) => (typeof value === 'number' ? value : Number(formatedCurrToNumber(String(value ?? ''))));
const signClass = (n) => (n > 0 ? 'text-money-in dark:text-money-in-dark' : n < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-gray-900 dark:text-white');
const signed = (n, currency) => `${n > 0 ? '+' : ''}${formatMoney(n, currency)}`;

const ERRORS = {
    'the valuation date is before the account was created': 'La fecha es anterior a la creación de la cuenta: el saldo inicial es su valor ese día.',
    'only investment accounts have valuations': 'Solo las cuentas de inversión tienen valoraciones.',
};

const Stat = ({ label, children, hint }) => (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-1 text-lg font-bold">{children}</p>
        {hint && <p className="text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
);

// Valor de una cuenta de inversión: valoraciones ("el día X valía Y"), aportes y ganancia del
// periodo elegido en el tablero de cuentas. Actualizar el valor no crea ingresos ni gastos.
const InvestmentValuationCard = ({ account, iniDate, endDate, current_Month, current_Year,
    get_accounts_status_by_period, get_history_accounts_by_month, get_net_worth, setAlert }) => {
    const currency = account?.currency || 'COP';
    const [performance, setPerformance] = useState(null);
    const [valuations, setValuations] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [form, setForm] = useState(null); // null = cerrado; { date, value, note }
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        if (!account?.id) return;
        const [perf, list] = await Promise.all([
            fetch_investments(iniDate, endDate),
            fetch_valuations(account.id),
        ]);
        setPerformance(perf?.accounts?.find(a => a.account_id === account.id) || null);
        setValuations(list || []);
    }, [account?.id, iniDate, endDate]);

    useEffect(() => { setForm(null); setShowAll(false); load(); }, [load]);

    // el saldo, el resumen y la gráfica de la cuenta dependen de las valoraciones
    const refreshAccount = () => {
        load();
        get_net_worth();
        if (iniDate && endDate) get_accounts_status_by_period(iniDate, endDate, accountReportGroup(account), [account.id]);
        const month = endDate ? endDate.substring(0, 7) : `${current_Year}-${String(current_Month).padStart(2, '0')}`;
        get_history_accounts_by_month(month, account.id);
    };

    const openForm = (valuation) => setForm(valuation
        ? { date: valuation.date, value: Number(valuation.value), note: valuation.note || '' }
        : { date: moment().format('YYYY-MM-DD'), value: performance ? Number(performance.value_end) : 0, note: '' });

    const save = async (e) => {
        e.preventDefault();
        const value = toNumber(form.value);
        if (!form.date || !(value >= 0)) return;
        setSaving(true);
        const result = await save_valuation(account.id, { date: form.date, value, note: form.note.trim() });
        setSaving(false);
        if (!result.ok) {
            const msg = ERRORS[result.messages?.[0]] || 'No se pudo guardar el valor, intenta de nuevo.';
            setAlert(msg, false, 'text-white', 'bg-red-500', 5000);
            return;
        }
        setForm(null);
        setAlert('Valor actualizado. No cuenta como ingreso ni gasto.', true, '', '', 3000);
        refreshAccount();
    };

    const remove = async (valuation) => {
        const result = await delete_valuation(account.id, valuation.id);
        if (!result.ok) {
            setAlert('No se pudo borrar la valoración, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        refreshAccount();
    };

    if (!account) return null;
    const gain = performance ? Number(performance.gain) : 0;
    const totalGain = performance ? Number(performance.market_gain_total) : 0;
    const shown = showAll ? (valuations || []) : (valuations || []).slice(0, 4);

    return (
        <section aria-label="Valor de la inversión" className="p-4 bg-white dark:bg-gray-800 transition-colors duration-300 rounded-xl shadow-md">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="flex items-center gap-2 text-md font-bold text-gray-800 dark:text-gray-100">
                    <ArrowTrendingUpIcon className="w-4 h-4 text-topi-500" aria-hidden="true" />
                    Valor de la inversión
                </h2>
                {!form && <Button size="sm" onClick={() => openForm(null)}>Actualizar valor</Button>}
            </div>

            {form && (
                <form onSubmit={save} className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                    <div>
                        <label htmlFor="valuationDate" className={labelClass}>Fecha</label>
                        <input id="valuationDate" type="date" value={form.date} max={moment().format('YYYY-MM-DD')} required
                            onChange={e => setForm({ ...form, date: e.target.value })} className={fieldClass} />
                    </div>
                    <div>
                        <span className={labelClass}>Valor ese día ({currency})</span>
                        <InputMoneyInt2Decs name="valuationValue" id="valuationValue" currency={currency}
                            ariaLabel={`Valor de la inversión en ${currency}`}
                            number={form.value} onChangeCreate={e => setForm(f => ({ ...f, value: e.target.value }))} />
                    </div>
                    <div className="sm:col-span-2">
                        <label htmlFor="valuationNote" className={labelClass}>Nota (opcional)</label>
                        <input id="valuationNote" type="text" maxLength={255} value={form.note} placeholder="Extracto de octubre"
                            onChange={e => setForm({ ...form, note: e.target.value })} className={fieldClass} />
                    </div>
                    <p className="sm:col-span-2 text-xs text-gray-500 dark:text-gray-400">
                        Escribe lo que dice tu extracto. Si ya había un valor ese día, se reemplaza.
                    </p>
                    <div className="sm:col-span-2 flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setForm(null)}>Cancelar</Button>
                        <Button type="submit" size="sm" loading={saving}>Guardar</Button>
                    </div>
                </form>
            )}

            {performance === null ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {valuations === null ? 'Cargando…' : 'Sin datos para este periodo.'}
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <Stat label="Valor al cierre" hint={performance.last_valuation_date
                        ? `Última valoración: ${moment(performance.last_valuation_date).format('DD-MM-YYYY')}`
                        : 'Sin valoraciones: saldo según movimientos'}>
                        <span className="text-gray-900 dark:text-white">{formatMoney(performance.value_end, currency)}</span>
                    </Stat>
                    <Stat label="Aportes netos del periodo">
                        <span className="text-gray-900 dark:text-white">{signed(Number(performance.contributions), currency)}</span>
                    </Stat>
                    <Stat label="Ganancia del periodo" hint={performance.gain_percent && gain !== 0 ? `${gain > 0 ? '+' : ''}${Number(performance.gain_percent).toLocaleString('es-CO')} %` : null}>
                        <span className={signClass(gain)}>{signed(gain, currency)}</span>
                    </Stat>
                    <Stat label="Ganancia total" hint={`Aportado: ${formatMoney(performance.contributions_total, currency)}`}>
                        <span className={signClass(totalGain)}>{signed(totalGain, currency)}</span>
                    </Stat>
                </div>
            )}

            {valuations && valuations.length > 0 && (
                <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">Valoraciones</h3>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
                        {shown.map(v => (
                            <li key={v.id} className="py-2 flex items-center justify-between gap-2">
                                <span className="text-gray-600 dark:text-gray-300 w-24 shrink-0">{moment(v.date).format('DD-MM-YYYY')}</span>
                                <span className="flex-1 min-w-0 truncate text-xs text-gray-500 dark:text-gray-400">{v.note}</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{formatMoney(v.value, currency)}</span>
                                <button type="button" onClick={() => openForm(v)} title="Editar" className="p-1 rounded text-gray-400 hover:text-topi-500">
                                    <PencilSquareIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Editar la valoración del {v.date}</span>
                                </button>
                                <button type="button" onClick={() => remove(v)} title="Borrar" className="p-1 rounded text-gray-400 hover:text-red-500">
                                    <TrashIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Borrar la valoración del {v.date}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {valuations.length > 4 && (
                        <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 text-xs font-medium text-topi-600 dark:text-indigo-300">
                            {showAll ? 'Ver menos' : `Ver las ${valuations.length}`}
                        </button>
                    )}
                </div>
            )}
        </section>
    );
};

const mapStateToProps = state => ({
    iniDate: state.Reports.iniDate_account_dash,
    endDate: state.Reports.endDate_account_dash,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, {
    get_accounts_status_by_period, get_history_accounts_by_month, get_net_worth, setAlert,
})(InvestmentValuationCard);
