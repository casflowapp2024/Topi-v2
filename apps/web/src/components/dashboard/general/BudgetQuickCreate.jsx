import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Emoji } from 'emoji-picker-react';
import { PlusIcon } from '@heroicons/react/20/solid';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import DropDownEmoji from '../../expensePlan/DropDownEmoji';
import { create_category, get_user_categories, set_category_budget } from '../../../redux/actions/cashflow';
import { get_expenses_report, get_financial_report, get_history_dash } from '../../../redux/actions/reports';
import { setAlert } from '../../../redux/actions/alert';
import { capitalizeWords, formatMoney, formatMoneyInput, formatedCurrToNumber } from '../../helpers';

const money = (raw) => parseFloat(formatedCurrToNumber(raw)) || 0;

/**
 * "Pon tu primer presupuesto" sin salir del Inicio (plan/31, bloque C). Se elige una categoría de gasto (primero
 * las que ya tienen gasto este mes, con cuánto) o se crea una nueva con su ícono, y se pone cuánto gastar al mes.
 * Al guardar, la señal 'budget' (interceptor de axios) actualiza el checklist; aquí se piden de nuevo las cifras
 * del mes para Presupuestos y "Hoy puedes gastar".
 */
export const BudgetQuickCreate = ({
    open, onClose,
    expenses_report, current_Month, current_Year,
    create_category, set_category_budget, get_user_categories,
    get_expenses_report, get_financial_report, get_history_dash, setAlert,
}) => {
    const [mode, setMode] = useState('pick'); // pick | new
    const [categoryId, setCategoryId] = useState(null);
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('');
    const [amount, setAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setMode('pick'); setCategoryId(null); setName(''); setEmoji(''); setAmount(''); setError('');
    }, [open]);

    // las de gasto, primero las que más gasto tienen este mes
    const categories = useMemo(() => (expenses_report || [])
        .map(c => ({ ...c, spent: Math.abs(Number(c.value) || 0), budgetNow: Math.abs(Number(c.budget) || 0) }))
        .sort((a, b) => b.spent - a.spent), [expenses_report]);
    const selected = categories.find(c => c.category_id === categoryId);
    const value = money(amount);
    const canSave = value > 0 && (mode === 'new' ? name.trim() !== '' : !!selected);

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        setError('');
        const result = mode === 'new'
            ? await create_category(name.trim(), value, emoji, false)
            : await set_category_budget(selected.category_id, value);
        setSaving(false);
        if (!result || result.res === false) {
            setError('No pudimos guardar el presupuesto. Inténtalo de nuevo.');
            return;
        }
        const month = String(current_Month).padStart(2, '0');
        get_user_categories(0, 50);
        get_expenses_report(`${current_Year}-${month}-01`);
        get_history_dash(`${current_Year}-${month}`);
        get_financial_report(current_Month, current_Year);
        setAlert('Presupuesto creado', true, 'text-white', 'bg-green-500', 3000);
        onClose();
    };

    const footer = (
        <>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={!canSave || saving}>{saving ? 'Guardando…' : 'Crear presupuesto'}</Button>
        </>
    );

    return (
        <Modal open={open} onClose={onClose} title="Pon tu primer presupuesto" size="md" footer={footer}
            description="Elige en qué quieres cuidar tu gasto y cuánto quieres gastar al mes.">
            <div className="flex flex-col gap-4">
                {mode === 'pick' ? (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Categoría</p>
                        <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto" role="listbox" aria-label="Categorías">
                            {categories.map(c => (
                                <li key={c.category_id}>
                                    <button type="button" role="option" aria-selected={c.category_id === categoryId}
                                        onClick={() => setCategoryId(c.category_id)}
                                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${c.category_id === categoryId
                                            ? 'border-topi-500 bg-topi-50 dark:bg-gray-700'
                                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                        {c.emoji ? <Emoji unified={c.emoji.toLowerCase()} emojiStyle="apple" size={20} /> : <span className="w-5" />}
                                        <span className="flex-1 min-w-0 truncate font-medium text-gray-900 dark:text-white">{capitalizeWords(c.name)}</span>
                                        <span className="text-xs text-ink-2 dark:text-gray-400 shrink-0">
                                            {c.spent > 0 ? `Gastaste ${formatMoney(c.spent)}` : 'Sin gasto este mes'}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <button type="button" onClick={() => setMode('new')}
                            className="inline-flex items-center gap-1 text-sm font-medium text-topi-600 dark:text-topi-200 hover:underline w-max">
                            <PlusIcon className="w-4 h-4" aria-hidden="true" /> Nueva categoría
                        </button>
                    </div>
                ) : (
                    <div className="flex items-end gap-3">
                        <div className="w-24 shrink-0">
                            <DropDownEmoji selectedEmoji={emoji} setSelectedEmoji={setEmoji} />
                        </div>
                        <label className="flex-1 flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nombre de la categoría
                            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ej. Mercado"
                                className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-topi-500" />
                            <button type="button" onClick={() => setMode('pick')} className="text-xs font-normal text-topi-600 dark:text-topi-200 hover:underline w-max">
                                Elegir una que ya tengo
                            </button>
                        </label>
                    </div>
                )}

                <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    ¿Cuánto quieres gastar al mes?
                    <input inputMode="numeric" value={amount} placeholder="$0"
                        onChange={(e) => setAmount(formatMoneyInput(formatedCurrToNumber(e.target.value)))}
                        className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-base text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-topi-500" />
                    {mode === 'pick' && selected?.spent > 0 && (
                        <span className="text-xs font-normal text-ink-2 dark:text-gray-400">Este mes llevas {formatMoney(selected.spent)} en {capitalizeWords(selected.name)}.</span>
                    )}
                </label>
                {error && <p role="alert" className="text-sm text-status-crit-text">{error}</p>}
            </div>
        </Modal>
    );
};

const mapStateToProps = (state) => ({
    expenses_report: state.Reports.expenses_report,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, {
    create_category, set_category_budget, get_user_categories,
    get_expenses_report, get_financial_report, get_history_dash, setAlert,
})(BudgetQuickCreate);
