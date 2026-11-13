import { useEffect, useState } from 'react'

//redux
import { connect } from 'react-redux'
import { get_user_categories, update_category, delete_category, get_category_budgets, set_category_budget, delete_category_budget } from '../../redux/actions/cashflow';
import { get_expenses_report, get_history_dash, get_history_category_by_month } from '../../redux/actions/reports';
import { setAlert } from '../../redux/actions/alert';

//components
import DropDownEmoji from './DropDownEmoji';
import Alert from '../alert';
import Alert2 from '../alert2';
import { Emoji } from "emoji-picker-react";
import { formatedCurrToNumber, formatMoneyInput, formatMoney, capitalizeWords } from "../helpers";
import { categoriesApiErrors } from "../errosMaping";
import { TrashIcon, PencilSquareIcon, CheckIcon } from '@heroicons/react/20/solid';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field, { Input, Select } from '../ui/Field';
import BudgetProgress, { getMonthPace } from '../ui/BudgetProgress';

// Historial de presupuestos (plan/26-presupuestos-historicos.md): cada versión rige desde un mes ('YYYY-MM')
// hasta la siguiente. 2000-01 es "desde el inicio" (los presupuestos que existían antes del historial).
const BASE_MONTH = '2000-01';
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_OPTIONS = 24; // el mes en curso y los 23 anteriores, más "Desde el inicio"
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (key, n) => { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1)); };
export const budgetMonthLabel = (key) => {
    if (key === BASE_MONTH) return 'el inicio';
    const [y, m] = key.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
};

// Qué pasa al fijar el presupuesto desde un mes pasado: hasta cuándo rige y qué sigue después.
// versions: la más reciente primero, como las devuelve el API.
export const budgetFromNotice = (versions, from, current) => {
    if (!from || from === current) return null;
    const desde = from === BASE_MONTH ? 'desde el inicio' : `desde ${budgetMonthLabel(from)}`;
    const next = (versions || []).filter(v => v.from > from).pop(); // la más antigua después del mes elegido
    if (!next) return `Rige ${desde} en adelante, también este mes.`;
    const until = shiftMonth(next.from, -1);
    const span = until === from ? `Rige solo en ${budgetMonthLabel(from)}` : `Rige ${desde} hasta ${budgetMonthLabel(until)}`;
    return `${span}; desde ${budgetMonthLabel(next.from)} sigue ${formatMoney(next.budget)}.`;
};


function EditCategory({
    openEditCat,
    setOpenEditCat,
    detailInfo,
    setDetailInfo,
    get_user_categories,
    user_categories,
    update_category,
    delete_category,
    setAlert,
    expenses_report,
    income_report,
    current_Month,
    current_Year,
    category_activated,
    get_category_budgets,
    set_category_budget,
    delete_category_budget,
    get_expenses_report,
    get_history_dash,
    get_history_category_by_month,
}) {

    /////////////load detail info
    const [selectedEmoji, setSelectedEmoji] = useState("")
    const [categoryData, setCategoryData] = useState({
        name: detailInfo.name,
        budget: formatMoneyInput(detailInfo.budget),
        isIncome: detailInfo.income,
    });

    useEffect(() => {
        setCategoryData({
            name: detailInfo.name,
            budget: formatMoneyInput(detailInfo.budget),
            isIncome: detailInfo.income,
        })
        setSelectedEmoji(detailInfo.emoji.toLowerCase())

    }, [detailInfo])

    ///////////// historial del presupuesto
    const currentMonth = monthKey(new Date());
    const [versions, setVersions] = useState(null);
    const [applyFrom, setApplyFrom] = useState(currentMonth);
    const [confirmVersion, setConfirmVersion] = useState(null); // 'YYYY-MM' de la versión a borrar
    const [loadingVersion, setLoadingVersion] = useState(false);

    const loadVersions = () => Promise.resolve(get_category_budgets?.(detailInfo.id))
        .then(r => { if (r?.res) setVersions(r.data || []); });

    useEffect(() => {
        if (!openEditCat || !detailInfo?.id) return;
        setVersions(null);
        loadVersions();
    }, [openEditCat, detailInfo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const fromOptions = Array.from({ length: MONTH_OPTIONS }, (_, i) => shiftMonth(currentMonth, -i));
    const fromNotice = budgetFromNotice(versions, applyFrom, currentMonth);
    const replaced = applyFrom !== currentMonth ? (versions || []).find(v => v.from === applyFrom) : null;

    // Tras un cambio de presupuesto: la lista de categorías y los reportes del mes que se está mirando
    const afterBudgetChange = (list) => {
        if (list?.length) {
            setVersions(list);
            setCategoryData(d => ({ ...d, budget: formatMoneyInput(list[0].budget) })); // la vigente hoy
        }
        get_user_categories(0, 20);
        if (current_Year && current_Month) {
            const mm = String(current_Month).padStart(2, '0');
            get_expenses_report?.(`${current_Year}-${mm}-01`);
            get_history_dash?.(`${current_Year}-${mm}`);
            if (category_activated?.category_id) get_history_category_by_month?.(category_activated.category_id, `${current_Year}-${mm}`);
        }
    };

    const handleDeleteVersion = async (from) => {
        setLoadingVersion(true);
        const r = await delete_category_budget(detailInfo.id, from);
        setLoadingVersion(false);
        setConfirmVersion(null);
        if (r.res) {
            afterBudgetChange(r.data);
            setAlert(`Se borró el presupuesto desde ${budgetMonthLabel(from)}`, true, "text-white", "bg-green-500", 3000);
        } else {
            setAlert(categoriesApiErrors[r.messages] || 'No se pudo borrar esa versión', false, 'text-white', 'bg-red-500', 4000);
        }
    };


    /////////////////////update category 
    const [activeUpdate, setActiveUpdate] = useState(false)
    const [loadingUpdate, setLoadingUpdate] = useState(false)


    const onChangeUpdate = (e) => {
        if (e.target.name == "budget") {
            const formated_budget = formatMoneyInput(formatedCurrToNumber(e.target.value)); // Remove non-numeric characters except for decimal point and minus sign
            setCategoryData({ ...categoryData, [e.target.name]: formated_budget });
        } else if (e.target.name == "isIncome") {
            setCategoryData({ ...categoryData, [e.target.name]: e.target.checked })
        } else {
            setCategoryData({ ...categoryData, [e.target.name]: e.target.value })
        }
    }


    const onSubmitUpdate = async () => {
        setLoadingUpdate(true)

        // Desde el mes en curso basta el PUT de siempre (el servidor versiona el cambio en este mes). Desde un mes
        // pasado el PUT lleva el presupuesto vigente (hoy no cambia por eso) y la versión se fija aparte.
        const newBudget = parseFloat(formatedCurrToNumber(categoryData.budget)) || 0
        const fromPast = applyFrom !== currentMonth
        const vigente = versions?.length ? versions[0].budget : Number(detailInfo.budget || 0)

        // Sin cambios de nombre, ícono ni tipo el PUT respondería "no data to update": desde un mes pasado se omite
        const metaChanged = categoryData.name !== detailInfo.name
            || selectedEmoji !== String(detailInfo.emoji || '').toLowerCase()
            || Boolean(categoryData.isIncome) !== Boolean(detailInfo.income)
        const createResponse = (!fromPast || metaChanged)
            ? await update_category(
                parseInt(detailInfo.id),
                categoryData.name,
                fromPast ? vigente : newBudget,
                selectedEmoji,
                categoryData.isIncome
            )
            : { res: true }

        const budgetResponse = createResponse.res === true && fromPast
            ? await set_category_budget(parseInt(detailInfo.id), newBudget, applyFrom)
            : null

        if (budgetResponse && !budgetResponse.res) {
            setLoadingUpdate(false)
            setAlert(categoriesApiErrors[budgetResponse.messages] || 'No se pudo guardar el presupuesto desde ese mes', false, 'text-white', 'bg-red-500', 4000)
        } else if (createResponse.res === true) {
            if (budgetResponse) {
                afterBudgetChange(budgetResponse.data)
            } else {
                loadVersions()
                afterBudgetChange(null)
            }
            setApplyFrom(currentMonth)
            setActiveUpdate(false)
            setAlert(fromPast ? `Presupuesto guardado desde ${budgetMonthLabel(applyFrom)}` : "Categoría exitosamente actualizada", true, "text-white", "bg-green-500", 3000)
            setLoadingUpdate(false)
        } else {
            const error = createResponse.messages;
            setLoadingUpdate(false)
            setAlert(categoriesApiErrors[error], false, 'text-white', 'bg-red-500', 4000)
        }
    }

    /////////////////////delete category
    const [openDeleteBox, setOpenDeleteBox] = useState(false)
    const [loadingDelete, setLoadingDelete] = useState(false)
    const handleDeleteCat = async (catId) => {

        setLoadingDelete(true)

        const deleteResponse = await delete_category(catId);
        console.log(deleteResponse)
        // The code below will only execute after the transaction is deleted

        if (deleteResponse.res === true) {

            setIsSuccess(true)
            setAlert('Categoría Eliminada', true, 'text-red-600', 'white', false)
            get_user_categories(0, 20)


        } else {

            const error = deleteResponse.messages;
            setLoadingDelete(false)
            setIsFailed(true)
            setAlert(categoriesApiErrors[error], false, 'text-red-600', 'bg-gray-200', 4000)
        }
    }

    const [isSuccess, setIsSuccess] = useState(false)
    const [isFailed, setIsFailed] = useState(false)


    //handle close edit
    const handleCloseDetail = async () => {

        setOpenEditCat(false)
        setAlert(null, true, "", "")
        setAlert('...', true, 'text-white', 'bg-white', 300)
        setTimeout(() => {
            setIsSuccess(false)
            setIsFailed(false)
            setLoadingDelete(false)
            setLoadingUpdate(false)
            setActiveUpdate(false)
            setOpenDeleteBox(false);
            setApplyFrom(currentMonth);
            setConfirmVersion(null);

        }, 300)
    }


    // Lo gastado (o recibido) este mes en la categoría, del mismo reporte de la vista. Con el monto que se
    // está editando, la barra muestra cómo quedaría: para decidir con contexto.
    const isIncome = Boolean(categoryData.isIncome);
    const row = ((detailInfo?.income ? income_report : expenses_report) || []).find(r => String(r.category_id) === String(detailInfo?.id));
    const spent = Math.abs(Number(row?.value || 0));
    // Desde un mes pasado con versiones después, este mes sigue con el vigente: la barra lo muestra así
    const typedBudget = Math.abs(Number(formatedCurrToNumber(String(categoryData.budget ?? '')) || 0));
    const keepsCurrent = activeUpdate && applyFrom !== currentMonth && (versions || []).some(v => v.from > applyFrom);
    const budgetNow = keepsCurrent ? Math.abs(Number(versions[0].budget) || 0) : typedBudget;
    const usage = budgetNow > 0 ? (spent / budgetNow) * 100 : 0;
    const pace = getMonthPace(current_Year, current_Month);
    const monthContext = (
        <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-3">
            <p className="text-xs text-ink-2 dark:text-gray-400">{isIncome ? 'Recibido este mes' : 'Gastado este mes'}</p>
            <p className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(spent)}</span>
                {budgetNow > 0 && <span className="text-sm text-ink-2 dark:text-gray-400">de {formatMoney(budgetNow)}</span>}
            </p>
            {budgetNow > 0
                ? <BudgetProgress usage={usage} isIncome={isIncome} pace={isIncome ? null : pace} className="mt-2" />
                : <p className="mt-1 text-xs text-ink-2 dark:text-gray-400">Sin presupuesto definido</p>}
        </div>
    );

    // Historial: solo si el presupuesto cambió alguna vez (una sola versión no dice nada)
    const history = versions && versions.length > 1 && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-medium text-ink-2 dark:text-gray-400">Historial del presupuesto</p>
            <ul className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
                {versions.map((v, i) => (
                    <li key={v.from} className="py-1.5 text-sm">
                        {confirmVersion === v.from ? (
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-gray-800 dark:text-gray-200">
                                    ¿Borrar? Desde {budgetMonthLabel(v.from)} vuelve a {formatMoney(versions[i + 1]?.budget)}
                                </span>
                                <span className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setConfirmVersion(null)} disabled={loadingVersion}>No</Button>
                                    <Button size="sm" variant="danger" loading={loadingVersion} onClick={() => handleDeleteVersion(v.from)}>Sí, borrar</Button>
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0">
                                    <b className="tabular-nums text-gray-900 dark:text-gray-100">{v.budget > 0 ? formatMoney(v.budget) : 'Sin presupuesto'}</b>
                                    <span className="text-ink-2 dark:text-gray-400"> desde {budgetMonthLabel(v.from)}{i === 0 ? ' · vigente' : ''}</span>
                                </span>
                                {!v.base && (
                                    <button type="button" onClick={() => setConfirmVersion(v.from)} aria-label={`Borrar el presupuesto desde ${budgetMonthLabel(v.from)}`}
                                        className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-status-crit-text hover:bg-status-crit-soft dark:hover:bg-red-500/10 dark:hover:text-red-400">
                                        <TrashIcon className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );

    const fromSelect = (
        <div className="flex flex-col gap-1">
            <Field label="Aplica desde" id="applyFrom">
                <Select id="applyFrom" name="applyFrom" value={applyFrom} onChange={e => setApplyFrom(e.target.value)}>
                    {fromOptions.map((key, i) => (
                        <option key={key} value={key}>{i === 0 ? `Este mes (${budgetMonthLabel(key)})` : budgetMonthLabel(key)}</option>
                    ))}
                    <option value={BASE_MONTH}>Desde el inicio</option>
                </Select>
            </Field>
            {(fromNotice || replaced) && (
                <p className="text-xs text-ink-2 dark:text-gray-400">
                    {fromNotice}{replaced ? ` Reemplaza el de ${budgetMonthLabel(replaced.from)} (${formatMoney(replaced.budget)}).` : ''}
                </p>
            )}
        </div>
    );

    const view = (openDeleteBox && isSuccess) ? 'deleted' : openDeleteBox ? 'delete' : activeUpdate ? 'edit' : 'detail';
    const TITLES = { detail: 'Presupuesto', edit: 'Editar presupuesto', delete: '¿Eliminar esta categoría?', deleted: 'Categoría eliminada' };
    const footers = {
        detail: (
            <div className="flex items-center justify-between gap-2 !w-full">
                <Button variant="ghost" className="!text-status-crit-text dark:!text-red-400 hover:!bg-status-crit-soft dark:hover:!bg-red-500/10"
                    icon={TrashIcon} onClick={() => setOpenDeleteBox(true)}>Eliminar</Button>
                <Button icon={PencilSquareIcon} onClick={() => setActiveUpdate(true)}>Editar</Button>
            </div>
        ),
        edit: <>
            <Button variant="ghost" onClick={() => setActiveUpdate(false)} disabled={loadingUpdate}>Cancelar</Button>
            <Button icon={CheckIcon} loading={loadingUpdate} onClick={() => onSubmitUpdate()}>Guardar cambios</Button>
        </>,
        delete: <>
            <Button variant="ghost" onClick={() => setOpenDeleteBox(false)} disabled={loadingDelete}>Cancelar</Button>
            <Button variant="danger" icon={TrashIcon} loading={loadingDelete} onClick={() => handleDeleteCat(detailInfo.id)}>Sí, eliminar</Button>
        </>,
        deleted: <Button variant="secondary" onClick={() => handleCloseDetail()}>Cerrar</Button>,
    };

    return (
        <Modal open={Boolean(openEditCat)} onClose={handleCloseDetail} title={TITLES[view]} footer={detailInfo ? footers[view] : null}>
            {detailInfo && (
                <div className="flex flex-col gap-4">
                    {view === 'deleted' ? (
                        <Alert2 />
                    ) : view === 'delete' ? (
                        <p className="rounded-2xl border border-status-crit/30 bg-status-crit-soft dark:bg-red-500/10 p-3 text-sm text-gray-800 dark:text-gray-200">
                            Se elimina <b>{capitalizeWords(categoryData.name)}</b>, con presupuesto mensual de {formatMoney(budgetNow)}.
                        </p>
                    ) : view === 'edit' ? (
                        <>
                            <div className="flex gap-4">
                                <div className="w-24 shrink-0">
                                    <DropDownEmoji selectedEmoji={selectedEmoji} setSelectedEmoji={setSelectedEmoji} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-4">
                                    <Field label="Nombre" id="name">
                                        <Input type="text" name="name" value={categoryData.name}
                                            onChange={e => onChangeUpdate(e)} placeholder="Nombre de la categoría" required />
                                    </Field>
                                    <Field label={isIncome ? 'Ingreso mensual esperado' : 'Presupuesto mensual'} id="budget">
                                        <Input type="text" inputMode="numeric" name="budget" value={categoryData.budget}
                                            onChange={e => onChangeUpdate(e)} placeholder="0" required />
                                    </Field>
                                </div>
                            </div>
                            {fromSelect}
                            {monthContext}
                            <label htmlFor="isIncome" className="flex items-start gap-2 cursor-pointer">
                                <input type="checkbox" id="isIncome" name="isIncome" checked={categoryData.isIncome}
                                    onChange={e => onChangeUpdate(e)} className="mt-0.5 w-4 h-4 rounded accent-topi-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Es de ingresos (como salario o ganancias)</span>
                            </label>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3">
                                <span className="w-14 h-14 shrink-0 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                    {selectedEmoji ? <Emoji unified={selectedEmoji.toLowerCase()} emojiStyle="apple" size={32} /> : null}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{capitalizeWords(categoryData.name)}</p>
                                    <p className="text-sm text-ink-2 dark:text-gray-400">
                                        {isIncome ? 'Ingreso mensual esperado' : 'Presupuesto mensual'}: <b className="text-gray-900 dark:text-gray-100 tabular-nums">{formatMoney(budgetNow)}</b>
                                    </p>
                                </div>
                            </div>
                            {monthContext}
                            {history}
                        </>
                    )}
                    {view !== 'deleted' && (
                        <div className="overflow-hidden rounded-2xl empty:hidden">
                            <Alert />
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}


const mapStateToProps = state => ({
    user_categories: state.CashFlow.user_categories,
    expenses_report: state.Reports.expenses_report,
    income_report: state.Reports.income_report,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    category_activated: state.Reports.category_activated,
    accountTypesOptions: state.CashFlow.account_types,
    banks: state.CashFlow.banks,
})

export default connect(mapStateToProps, {
    get_user_categories,
    update_category,
    delete_category,
    setAlert,
    get_category_budgets,
    set_category_budget,
    delete_category_budget,
    get_expenses_report,
    get_history_dash,
    get_history_category_by_month,
})(EditCategory)