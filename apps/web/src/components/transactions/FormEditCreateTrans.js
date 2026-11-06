import { useMemo, useState } from 'react'
import { connect } from 'react-redux';
import { Emoji } from "emoji-picker-react";
import { MinusCircleIcon, PlusCircleIcon, EllipsisHorizontalIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import { getBaseCurrency, parseDatetimetoDateStrFormat, parseDatetoDatetimeBrow, isOpenAccount, isCreditAccount, capitalizeWords } from "../../components/helpers";
import InputMoneyInt2Decs from '../InputMoneyInt2Decs';
import { SingleDateSelector } from '../ui/SingleDateSelector.tsx';
import Field, { Input, Select } from '../ui/Field';
import Chip from '../ui/Chip';
import { segmentClass } from '../ui/ThemeSwitch';
import DropDownCat from "./DropDownCat";

const TOP = 6;

/**
 * Categorías para los chips: las más usadas del tipo (gasto o ingreso) entre las transacciones ya cargadas.
 * Sin historial se usa el orden de la lista. La elegida siempre aparece (primera si no estaba entre las usadas).
 */
export const topCategories = (categories = [], transactions = [], expense = true, selectedId = null, n = TOP) => {
  const sameKind = categories.filter(c => Boolean(c.income) === !expense);
  const pool = sameKind.length > 0 ? sameKind : categories;
  const uses = new Map();
  transactions.forEach(tx => {
    if (tx.transfer_group_id || Boolean(tx.expense) !== Boolean(expense)) return;
    const id = tx.category?.id;
    if (id != null) uses.set(String(id), (uses.get(String(id)) || 0) + 1);
  });
  const order = new Map(pool.map((c, i) => [String(c.id), i]));
  const sorted = [...pool].sort((a, b) =>
    (uses.get(String(b.id)) || 0) - (uses.get(String(a.id)) || 0) || order.get(String(a.id)) - order.get(String(b.id)));
  let top = sorted.slice(0, n);
  const selected = categories.find(c => String(c.id) === String(selectedId));
  if (selected && !top.some(c => String(c.id) === String(selected.id))) top = [selected, ...top.slice(0, n - 1)];
  return top;
};

/** Formulario de crear y editar transacción: monto primero, categoría con chips, luego descripción, cuenta y fecha. */
const FormEditCreateTrans = ({
    editCreateData,
    onChangeCreate,
    user_categories,
    user_accounts,
    date,
    setDate,
    //states
    bank_done,
    recent_transactions,
}) => {
    const [showAllCats, setShowAllCats] = useState(false);
    const accounts = user_accounts?.items || [];
    const categories = user_categories?.items || [];
    const account = accounts.find(a => String(a.id) === String(editCreateData.account_id));
    const expense = Boolean(editCreateData.expense);

    const chips = useMemo(
        () => topCategories(categories, recent_transactions || [], expense, editCreateData.category_id),
        [categories, recent_transactions, expense, editCreateData.category_id]);

    // Gasto/Ingreso: solo avisa si cambia. `checked` = es ingreso (así lo leen los dos formularios que lo usan).
    const setKind = (nextExpense) => {
        if (nextExpense === expense) return;
        onChangeCreate({ target: { name: 'expense', checked: !nextExpense, value: nextExpense } });
    };
    const pickCategory = (id) => onChangeCreate({ target: { name: 'category_id', value: id } });

    if (!bank_done) {
        return (
            <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
                <ExclamationTriangleIcon className="w-8 h-8 text-status-warn-text dark:text-amber-300" aria-hidden="true" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                    Para registrar un movimiento primero crea una cuenta (de banco, efectivo o tarjeta) a la que asociarlo.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* tipo y monto */}
            <div className="flex flex-col items-center gap-3">
                <div role="radiogroup" aria-label="Tipo de movimiento" className="inline-flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-900">
                    {[{ v: true, label: 'Gasto', icon: MinusCircleIcon }, { v: false, label: 'Ingreso', icon: PlusCircleIcon }].map(({ v, label, icon: Icon }) => (
                        <button key={label} type="button" role="radio" aria-checked={expense === v} onClick={() => setKind(v)}
                            className={`${segmentClass(expense === v)} !flex-none px-4 text-sm`}>
                            <Icon className={`w-4 h-4 ${expense === v ? (v ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark') : ''}`} aria-hidden="true" />
                            {label}
                        </button>
                    ))}
                </div>
                <div className="w-full">
                    <InputMoneyInt2Decs
                        name="amount"
                        id="amount"
                        size="lg"
                        onChangeCreate={e => onChangeCreate(e)}
                        number={editCreateData.amount}
                        currency={account?.currency}
                        ariaLabel="Monto"
                    />
                </div>
            </div>

            {/* categoría: las más usadas a un toque; el resto en "Otra…" */}
            <fieldset className="flex flex-col gap-2 min-w-0">
                <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Categoría</legend>
                <div className="flex flex-wrap gap-2">
                    {chips.map(c => (
                        <Chip key={c.id} selected={String(c.id) === String(editCreateData.category_id)} onClick={() => pickCategory(c.id)}>
                            {c.emoji && <Emoji unified={c.emoji.toLowerCase()} emojiStyle="apple" size={16} />}
                            <span className="max-w-[10rem] truncate">{capitalizeWords(c.name)}</span>
                        </Chip>
                    ))}
                    <Chip icon={EllipsisHorizontalIcon} selected={false} aria-expanded={showAllCats} onClick={() => setShowAllCats(v => !v)}>
                        Otra…
                    </Chip>
                </div>
                {showAllCats && (
                    <DropDownCat
                        options={categories}
                        selected={editCreateData.category_id}
                        defaultOpen
                        onChange={e => { onChangeCreate(e); setShowAllCats(false); }}
                        placeholder="Buscar categoría"
                    />
                )}
            </fieldset>

            <Field label="Descripción">
                <Input type="text" name="description" value={editCreateData.description}
                    onChange={e => onChangeCreate(e)} placeholder="Ej.: Almuerzo, arriendo, salario" required />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Cuenta" id="account_id">
                    <Select name="account_id" value={editCreateData.account_id} onChange={e => onChangeCreate(e)} required>
                        {/* las cerradas no reciben movimientos nuevos (salvo la que ya tiene la transacción) */}
                        {accounts.filter(a => isOpenAccount(a) || String(a.id) === String(editCreateData.account_id)).map(a => (
                            <option key={a.id} value={a.id}>
                                {a.name} - ***{a.last_four_digits}{a.currency && a.currency !== getBaseCurrency() ? ` · ${a.currency}` : ''}
                            </option>
                        ))}
                    </Select>
                </Field>
                <Field label="Fecha" id="date">
                    <SingleDateSelector
                        value={date ? parseDatetoDatetimeBrow(date, "YYYY-MM-DD HH:mm:ss Z") : undefined}
                        onChange={(newDate) => {
                            if (!newDate) return;
                            const dateToStore = new Date(newDate.getTime());
                            dateToStore.setHours(12, 0, 0, 0);
                            setDate(parseDatetimetoDateStrFormat(dateToStore, "YYYY-MM-DD HH:mm:ss Z"));
                        }}
                    />
                </Field>
            </div>

            {/* cuotas: compra con tarjeta diferida (informativo; el gasto es la compra completa) */}
            {expense && isCreditAccount(account) && (
                <Field label="Cuotas (opcional)" id="installments"
                    help="El gasto cuenta completo hoy; las cuotas sirven para saber qué te cobrará el banco cada mes.">
                    <Input type="number" inputMode="numeric" min="1" max="120" name="installments"
                        value={editCreateData.installments ?? ''} onChange={e => onChangeCreate(e)} placeholder="1" className="sm:!w-32" />
                </Field>
            )}
        </div>
    )
}

const mapStateToProps = state => ({
    bank_done: state.CashFlow.first_steps.bank,
    recent_transactions: state.CashFlow.user_transactions?.items,
})

export default connect(mapStateToProps, {})(FormEditCreateTrans)
