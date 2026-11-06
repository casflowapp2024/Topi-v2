import { useEffect, useState } from 'react'

//redux
import { connect } from 'react-redux'
import { get_user_categories, update_category, delete_category } from '../../redux/actions/cashflow';
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
import Field, { Input } from '../ui/Field';
import BudgetProgress, { getMonthPace } from '../ui/BudgetProgress';

/* This example requires Tailwind CSS v2.0+ */


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

        const createResponse = await update_category(
            parseInt(detailInfo.id),
            categoryData.name,
            parseFloat(formatedCurrToNumber(categoryData.budget)),
            selectedEmoji,
            categoryData.isIncome
        )

        if (createResponse.res === true) {
            get_user_categories(0, 20)
            setActiveUpdate(false)
            setAlert("Categoría exitosamente actualizada", true, "text-white", "bg-green-500", 3000)
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

        }, 300)
    }


    // Lo gastado (o recibido) este mes en la categoría, del mismo reporte de la vista. Con el monto que se
    // está editando, la barra muestra cómo quedaría: para decidir con contexto.
    const isIncome = Boolean(categoryData.isIncome);
    const row = ((detailInfo?.income ? income_report : expenses_report) || []).find(r => String(r.category_id) === String(detailInfo?.id));
    const spent = Math.abs(Number(row?.value || 0));
    const budgetNow = Math.abs(Number(formatedCurrToNumber(String(categoryData.budget ?? '')) || 0));
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
    accountTypesOptions: state.CashFlow.account_types,
    banks: state.CashFlow.banks,
})

export default connect(mapStateToProps, {
    get_user_categories,
    update_category,
    delete_category,
    setAlert

})(EditCategory)