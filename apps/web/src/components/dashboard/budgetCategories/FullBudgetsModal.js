import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Emoji } from 'emoji-picker-react';
import { set_dash_category_activated } from '../../../redux/actions/reports';
import { set_active_report_tab } from '../../../redux/actions/ui';
import { formatMoney, capitalizeWords } from '../../helpers';
import Modal from '../../ui/Modal';
import BudgetProgress, { BudgetStatusLabel, getBudgetStatus, getMonthPace, statusLabel } from '../../ui/BudgetProgress';
import EmptyState from '../../ui/EmptyState';
import { Segmented } from '../../charts/ChartTabs';

const KINDS = [
    { id: 'Expenses', label: 'Gastos' },
    { id: 'Income', label: 'Ingresos' },
];
const SORTS = [
    { id: 'usage', label: '% usado' },
    { id: 'amount', label: 'Monto' },
];

// Filas del reporte del mes (los mismos datos de la lista): monto, presupuesto y % en positivo
export const panoramaRows = (report, sortKey = 'usage') => (report || [])
    .map(r => ({
        ...r,
        amount: Math.abs(Number(r.value || 0)),
        budget: Math.abs(Number(r.budget || 0)),
        usage: Number(r.usage || 0),
    }))
    .filter(r => r.budget > 0 || r.amount > 0)
    // por % de uso (o por monto); las que no tienen presupuesto al final
    .sort((a, b) => ((b.budget > 0) - (a.budget > 0)) || (b[sortKey] - a[sortKey]) || (b.amount - a.amount));

/**
 * Panorama de presupuestos: Gastos e Ingresos del mes con lo gastado/recibido, % y estado.
 * Tocar una categoría cierra y la elige en la vista (cambiando la pestaña si hace falta).
 * Los totales salen del mismo reporte que la cabecera de Presupuestos (sin transferencias entre cuentas).
 */
const FullBudgetsModal = ({
    isOpen, onClose,
    expenses_report, income_report, expenses_report_full, income_report_full,
    active_report_tab, current_Month, current_Year,
    set_dash_category_activated, set_active_report_tab,
}) => {
    const [kind, setKind] = useState('Expenses');
    const [sortKey, setSortKey] = useState('usage');
    // al abrir, empieza en la pestaña activa de la vista
    useEffect(() => { if (isOpen) setKind(active_report_tab === 'Income' ? 'Income' : 'Expenses'); }, [isOpen, active_report_tab]);

    const isIncome = kind === 'Income';
    const pace = getMonthPace(current_Year, current_Month);
    const rows = useMemo(() => panoramaRows(isIncome ? income_report : expenses_report, sortKey),
        [isIncome, income_report, expenses_report, sortKey]);
    const full = isIncome ? income_report_full : expenses_report_full;
    const total = Math.abs(Number(full?.value || 0));
    const totalBudget = Math.abs(Number(full?.budget || 0));
    const totalUsage = totalBudget > 0 ? (total / totalBudget) * 100 : 0;
    const totalStatus = getBudgetStatus(totalUsage, { isIncome, pace: isIncome ? null : pace });

    const pick = (cat) => {
        if ((active_report_tab === 'Income') !== isIncome) set_active_report_tab(kind);
        set_dash_category_activated(cat);
        onClose();
    };

    return (
        <Modal open={isOpen} onClose={onClose} title="Panorama de presupuestos" size="full" bodyClassName="p-0">
            <div className="flex flex-col gap-5 px-5 py-4">
                {/* Gastos | Ingresos y orden */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div role="tablist" aria-label="Ver presupuestos de" className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-900">
                        {KINDS.map(k => {
                            const on = k.id === kind;
                            return (
                                <button key={k.id} type="button" role="tab" aria-selected={on} onClick={() => setKind(k.id)}
                                    className={`h-8 px-4 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${on
                                        ? `bg-white dark:bg-gray-800 shadow-sm ${k.id === 'Expenses' ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`
                                        : 'text-ink-2 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                                    {k.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-2 dark:text-gray-400">Ordenar por</span>
                        <Segmented options={SORTS} value={sortKey} onChange={setSortKey} label="Ordenar por" />
                    </div>
                </div>

                {/* resumen */}
                <section aria-label="Resumen del mes" className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:items-end">
                    <div>
                        <p className="text-xs text-ink-2 dark:text-gray-400">{isIncome ? 'Esperado' : 'Presupuestado'}</p>
                        <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(totalBudget)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-ink-2 dark:text-gray-400">{isIncome ? 'Recibido' : 'Gastado'}</p>
                        <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(total)}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {totalBudget > 0 ? (
                            <>
                                <BudgetStatusLabel status={totalStatus} isIncome={isIncome}>
                                    {`${statusLabel(totalStatus, isIncome)} · ${Math.round(totalUsage)}%`}
                                </BudgetStatusLabel>
                                <BudgetProgress usage={totalUsage} isIncome={isIncome} pace={isIncome ? null : pace} showLabel={false} height="h-2.5" />
                            </>
                        ) : <p className="text-sm text-ink-2 dark:text-gray-400">Sin presupuesto definido</p>}
                    </div>
                </section>

                {/* categorías */}
                {rows.length === 0 ? (
                    <EmptyState title={`Sin presupuestos de ${isIncome ? 'ingresos' : 'gastos'}`}
                        description={`Crea un presupuesto de ${isIncome ? 'ingresos' : 'gastos'} para verlo aquí.`} />
                ) : (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {rows.map(cat => {
                            const status = getBudgetStatus(cat.usage, { isIncome, pace: isIncome ? null : pace });
                            return (
                                <li key={cat.category_id}>
                                    <button type="button" onClick={() => pick(cat)}
                                        className="w-full h-full text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 flex flex-col gap-3 hover:border-topi-500/50 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <span className="w-9 h-9 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                                                {cat.emoji ? <Emoji unified={cat.emoji.toLowerCase()} emojiStyle="apple" size={20} /> : null}
                                            </span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{capitalizeWords(cat.name)}</span>
                                        </span>
                                        <span className="flex items-baseline gap-1 flex-wrap">
                                            <span className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(cat.amount)}</span>
                                            {cat.budget > 0 && <span className="text-xs text-ink-2 dark:text-gray-400">de {formatMoney(cat.budget)}</span>}
                                        </span>
                                        {cat.budget > 0 ? (
                                            <span className="flex flex-col gap-1.5">
                                                <BudgetProgress usage={cat.usage} isIncome={isIncome} pace={isIncome ? null : pace} showLabel={false} height="h-2" />
                                                <BudgetStatusLabel status={status} isIncome={isIncome}>
                                                    {`${statusLabel(status, isIncome)} · ${Math.round(cat.usage)}%`}
                                                </BudgetStatusLabel>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-ink-2 dark:text-gray-400">Sin presupuesto</span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </Modal>
    );
};

const mapStateToProps = state => ({
    expenses_report: state.Reports.expenses_report,
    income_report: state.Reports.income_report,
    expenses_report_full: state.Reports.expenses_report_full,
    income_report_full: state.Reports.income_report_full,
    active_report_tab: state.UI.active_report_tab,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, { set_dash_category_activated, set_active_report_tab })(FullBudgetsModal);
