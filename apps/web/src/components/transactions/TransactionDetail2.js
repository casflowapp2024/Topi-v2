import { Fragment, useEffect, useState } from 'react'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
//redux
import { connect } from 'react-redux'
import { delete_transaction, get_user_transactions, update_transaction, update_transaction_local } from '../../redux/actions/cashflow';
import { get_user_categories, create_category } from '../../redux/actions/cashflow';
import { get_accounts_status_by_period, get_history_accounts_by_month, get_history_dash, get_history_category_by_month, get_expenses_report } from '../../redux/actions/reports';
import { setAlert } from '../../redux/actions/alert';
//components
import { findElmentNameById, formatDate, formatMoney, formatedCurrToNumber, findElmentById, parseDatetimetoDateStrFormat, formatToDateFilters, accountReportGroup, isCreditAccount } from '../helpers';
import TransSumm from './TransSumm';
import FxRateEditor from './FxRateEditor';
import TransferLinkSection from './TransferLinkSection';
import FormEditCreateTrans from './FormEditCreateTrans';
import Alert from '../alert';

/* This example requires Tailwind CSS v2.0+ */
import {
    CheckIcon,
    XMarkIcon,
    TrashIcon,
    PencilSquareIcon
} from '@heroicons/react/20/solid'
import Button from '../ui/Button';

function TransactionDetail({
    //props
    openTransDetail,
    setOpenTransDetail,
    detailInfo,
    setDetailInfo,
    currentFrontendPage,
    contextWindow = "",

    //state
    //actions
    delete_transaction,
    get_user_transactions,
    get_user_categories,
    create_category,
    setAlert,
    update_transaction,
    update_transaction_local,
    //state
    user_categories,
    user_accounts,
    trans_filters_activated,
    default_limit,

    //Reports state
    account_activated,
    iniDate_account_dash,
    endDate_account_dash,
    current_Month,
    current_Year,
    category_activated,

    //Reports Actions
    get_accounts_status_by_period,
    get_history_accounts_by_month,
    get_history_dash,
    get_history_category_by_month,
    get_expenses_report

}) {

    //ELIMINAR TRANSACION
    const [openDeleteBox, setOpenDeleteBox] = useState(false)
    const [loadingDelete, setLoadingDelete] = useState(false)
    const [deleteSuccess, setDeleteSuccess] = useState(false)

    // Recarga las vistas que dependen de la transacción según dónde se abrió el detalle
    const refreshViews = () => {
        if (contextWindow === "dashAccounts" && account_activated) {
            const accounts_type = accountReportGroup(account_activated)

            if (accounts_type) {
                const year_from_end_date = endDate_account_dash.substring(0, 4);
                const month_from_end_date = endDate_account_dash.substring(5, 7);

                const date_filter = `${year_from_end_date}-${month_from_end_date.toString().padStart(2, '0')}`

                get_history_accounts_by_month(date_filter, account_activated.id);
                get_accounts_status_by_period(iniDate_account_dash, endDate_account_dash, accounts_type, [account_activated.id]);

                const buildTransactionParams = ({
                    selectedAccounts,
                    iniDate,
                    endDate,
                }) => {

                    const params = [];
                    if (selectedAccounts && selectedAccounts.length > 0) params.push(`accounts=${selectedAccounts}`);
                    if (iniDate) params.push(`init_date=${iniDate}`);
                    if (endDate) params.push(`end_date=${endDate}`);

                    return params.join("&");
                };

                const filterParams = buildTransactionParams(
                    {
                        selectedAccounts: account_activated ? [account_activated.id] : null,
                        iniDate: formatToDateFilters((iniDate_account_dash)),
                        endDate: formatToDateFilters((endDate_account_dash))
                    }
                )

                get_user_transactions(0, 100, filterParams, "accountsAnalysis")
            }
        } else if (contextWindow === "dashCategories" && category_activated) {

            const buildTransactionParams = ({
                selectedCategories,
                iniDate,
                endDate,
            }) => {

                const params = [];
                if (selectedCategories && selectedCategories.length > 0) params.push(`categories=${selectedCategories}`);
                if (iniDate) params.push(`init_date=${iniDate}`);
                if (endDate) params.push(`end_date=${endDate}`);

                return params.join("&");
            };

            const filterParams = buildTransactionParams(
                {
                    selectedCategories: category_activated ? [category_activated.category_id] : null,
                    iniDate: parseDatetimetoDateStrFormat(new Date(current_Year, current_Month - 1, 1), "YYYY-MM-DD HH:mm:ss Z"),
                    endDate: parseDatetimetoDateStrFormat(new Date(current_Year, current_Month, 0), "YYYY-MM-DD HH:mm:ss Z")
                }
            )
            const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`

            get_history_dash(date_filter);
            get_history_category_by_month(category_activated?.category_id, date_filter);
            const transResponse = get_user_transactions(0, 100, filterParams, "budgetCategory")
            let dateString = `${current_Year}-${current_Month.toString().padStart(2, '0')}-01`
            const getReportResponse = get_expenses_report(dateString)

        } else if (contextWindow === "dash") {
            get_user_transactions(0, default_limit, null, "dash")
        } else {
            get_user_transactions((currentFrontendPage - 1) * default_limit, default_limit, trans_filters_activated.params)
        }
    }

    const handleDeleteTransaction = async (transactionId) => {
        setLoadingDelete(true)
        const deleteResponse = await delete_transaction(transactionId);
        if (deleteResponse === true) {

            refreshViews()
                        setLoadingDelete(false)
            setDeleteSuccess(true);
        } else {
            setAlert('No se pudo eliminar la transacción. Intenta de nuevo.', false, 'text-white', 'bg-red-500', 5000)
            setLoadingDelete(false)
        }
    }

    //Update Transaction
    const [openEditTrans, setOpenEditTrans] = useState(false)
    const [editCreateData, setEditCreateData] = useState(detailInfo ? {
        category_id: detailInfo.category.id,
        account_id: detailInfo.account.id,
        description: detailInfo.description,
        expense: detailInfo.expense,
        amount: detailInfo.amount,
        installments: detailInfo.installments ?? '',
    } : null)

    const [date, setDate] = useState(detailInfo ? detailInfo.date : null)
    const [loadingUpdate, setLoadingUpdate] = useState(false)

    const handleOpenEditTransaction = () => {

        get_user_transactions((currentFrontendPage - 1) * default_limit, default_limit, trans_filters_activated.params)
        setEditCreateData(
            {
                category_id: detailInfo.category.id,
                account_id: detailInfo.account.id,
                description: detailInfo.description,
                expense: detailInfo.expense,
                amount: detailInfo.amount,
                installments: detailInfo.installments ?? '',
            }
        )
        setDate(detailInfo.date)
        setTimeout(() => {
            setOpenEditTrans(true)
        }, 50)

        //console.log("detailInfo",detailInfo)
    }

    const onChangeCreate = (e) => {
        if (e.target.name === "expense") {
            setEditCreateData({ ...editCreateData, [e.target.name]: !editCreateData.expense })
        } else {
            setEditCreateData({ ...editCreateData, [e.target.name]: e.target.value })
        }
    }

    const findElmentEmojiById = (elements, id) => {
        const element = elements.find(element => element.id === id);
        return element.emoji;
    }

    const onSubmitUpdate = async (e) => {
        e.preventDefault();
        setLoadingUpdate(true)

        let newCategoryId = editCreateData.category_id
        if (editCreateData.category_id < 0) {
            const newCategory = findElmentById(user_categories.items, editCreateData.category_id)
            const createCategoryResponse = await create_category(newCategory.name, parseFloat(0), newCategory.emoji)
            if (createCategoryResponse === false) {
                setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!", true, "text-white", "bg-red-500", 3000)
                setLoadingUpdate(false)
                return
            }
            newCategoryId = createCategoryResponse
        }

        const cats_retrieved = await get_user_categories(0, 50)
        setEditCreateData({ ...editCreateData, ["category_id"]: newCategoryId })
        const newEmoji = findElmentEmojiById(cats_retrieved, parseInt(newCategoryId))
        const newCatName = findElmentNameById(cats_retrieved, parseInt(newCategoryId))

        const updateResponse = await update_transaction(
            parseInt(detailInfo.id),
            parseInt(newCategoryId),
            parseInt(editCreateData.account_id),
            editCreateData.description,
            editCreateData.expense,
            parseFloat(formatedCurrToNumber(editCreateData.amount)),
            date,
            undefined,
            undefined,
            undefined,
            // cuotas solo en gastos con tarjeta; en otro caso se quitan
            editCreateData.expense && isCreditAccount(findElmentById(user_accounts.items, parseInt(editCreateData.account_id)))
                ? (Number(editCreateData.installments) || 0) : 0
        )

        console.log("updateResponse: ", updateResponse);

        if (updateResponse === true) {

            setDetailInfo(
                {
                    ...detailInfo,
                    category: {
                        id: newCategoryId,
                        name: newCatName,
                        emoji: newEmoji
                    },
                    account: {
                        id: editCreateData.account_id,
                        name: findElmentNameById(user_accounts.items, parseInt(editCreateData.account_id))
                    },
                    description: editCreateData.description,
                    expense: editCreateData.expense,
                    amount: parseFloat(formatedCurrToNumber(editCreateData.amount)),
                    date: date,
                    installments: Number(editCreateData.installments) > 1 ? Number(editCreateData.installments) : null
                })
            update_transaction_local(detailInfo.id, {
                category: {
                    id: newCategoryId,
                    name: newCatName,
                    emoji: newEmoji
                },
                account: {
                    id: editCreateData.account_id,
                    name: findElmentNameById(user_accounts.items, parseInt(editCreateData.account_id))
                },
                description: editCreateData.description,
                expense: editCreateData.expense,
                amount: parseFloat(formatedCurrToNumber(editCreateData.amount)),
                date: date
            }, contextWindow);
            //}

            refreshViews()
            setTimeout(() => {
                setLoadingUpdate(false)
                setOpenEditTrans(false)
                setAlert("Transaccion actualizada", true, "text-white", "bg-green-500", 5000)
            }, 200)

        } else {
            setLoadingUpdate(false)
            setAlert("No se pudo actualizar la transaccion, intenta de nuevo", false, "text-white", "bg-red-500", 5000)
        }
    }


    //GENERALES
    useEffect(() => {
        //console.log("detailInfo",detailInfo)
        setDate(detailInfo ? detailInfo.date : null)
        setEditCreateData(detailInfo ? {
            category_id: detailInfo.category.id,
            account_id: detailInfo.account.id,
            description: detailInfo.description,
            expense: detailInfo.expense,
            amount: detailInfo.amount,
            installments: detailInfo.installments ?? '',
        } : null)
    }, [detailInfo])

    const handleClosePopover = () => {
        setOpenTransDetail(false);
        //setEditCreateData(null)

        setTimeout(() => {
            setAlert("...", false, "", "", 200)
            setDeleteSuccess(false)
            setOpenDeleteBox(false);
            setOpenEditTrans(false);
        }, 500)
    }

    //GENERALES


    /* useEffect(() => {
        console.log("closing/opening Edit ", editCreateData); 
    }, [openEditTrans]); */

    return (

        <Transition show={openTransDetail} as={Fragment}>
            <Dialog as="div" className="relative z-40 font-Inter" onClose={handleClosePopover}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 z-20 overflow-y-auto w-screen">
                    <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            {/**/}
                            <DialogPanel className="relative transform overflow-visible rounded-3xl bg-white dark:bg-[#151C2C] text-left shadow-2xl transition-all w-full max-w-md">
                                {detailInfo && (
                                    <div className="relative p-6 sm:p-8">
                                        {/* Cerrar (en todos los estados) */}
                                        <button
                                            type="button"
                                            onClick={() => handleClosePopover()}
                                            className="absolute top-4 right-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500"
                                            aria-label="Cerrar"
                                        >
                                            <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                                        </button>

                                        {deleteSuccess ? (
                                            /* ELIMINADA */
                                            <div className="flex flex-col items-center text-center gap-3 py-6" role="status">
                                                <span className="w-14 h-14 rounded-full bg-status-ok-soft dark:bg-emerald-500/15 text-status-ok flex items-center justify-center">
                                                    <CheckIcon className="w-8 h-8" aria-hidden="true" />
                                                </span>
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transacción eliminada</h3>
                                                <p className="text-sm text-ink-2 dark:text-gray-400">Tus saldos y reportes ya se actualizaron.</p>
                                                <Button variant="secondary" className="mt-2 min-w-[140px]" onClick={() => handleClosePopover()}>Cerrar</Button>
                                            </div>
                                        ) : openDeleteBox ? (
                                            /* CONFIRMAR ELIMINACIÓN */
                                            <div className="flex flex-col items-center text-center gap-3 pt-4">
                                                <span className="w-14 h-14 rounded-full bg-status-crit-soft dark:bg-red-500/15 text-status-crit flex items-center justify-center">
                                                    <TrashIcon className="w-7 h-7" aria-hidden="true" />
                                                </span>
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">¿Eliminar esta transacción?</h3>
                                                <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-4 py-3 flex items-center justify-between gap-3 text-left">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{detailInfo.description}</p>
                                                        <p className="text-xs text-ink-2 dark:text-gray-400 truncate">
                                                            {formatDate(detailInfo.date)} · {detailInfo.account?.name}
                                                        </p>
                                                    </div>
                                                    <span className={`shrink-0 text-sm font-bold tabular-nums ${detailInfo.transfer_group_id ? 'text-gray-700 dark:text-gray-200' : detailInfo.expense ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`}>
                                                        {detailInfo.transfer_group_id ? '' : detailInfo.expense ? '−' : '+'}{formatMoney(detailInfo.amount, detailInfo.currency)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-ink-2 dark:text-gray-400">
                                                    Se borra para siempre y deja de contar en tus saldos y presupuestos.
                                                </p>
                                                <div className="w-full flex flex-col-reverse sm:flex-row gap-2 pt-2">
                                                    <Button variant="secondary" className="flex-1" onClick={() => setOpenDeleteBox(false)} disabled={loadingDelete}>
                                                        Cancelar
                                                    </Button>
                                                    <Button variant="danger" className="flex-1" icon={TrashIcon} loading={loadingDelete}
                                                        onClick={() => handleDeleteTransaction(detailInfo.id)}>
                                                        Sí, eliminar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : openEditTrans ? (
                                            /* EDITAR */
                                            <div className="w-full">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 pr-10">Editar transacción</h3>
                                                <FormEditCreateTrans
                                                    editCreateData={editCreateData}
                                                    onChangeCreate={onChangeCreate}
                                                    user_categories={user_categories}
                                                    user_accounts={user_accounts}
                                                    date={date}
                                                    setDate={setDate}
                                                />
                                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                                                    <Button variant="secondary" onClick={() => setOpenEditTrans(false)} disabled={loadingUpdate}>Cancelar</Button>
                                                    <Button icon={CheckIcon} loading={loadingUpdate} onClick={(e) => onSubmitUpdate(e)}>Guardar cambios</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* DETALLE */
                                            <div>
                                                <TransSumm detailInfo={detailInfo} />
                                                <FxRateEditor detailInfo={detailInfo} setDetailInfo={setDetailInfo} contextWindow={contextWindow} />
                                                <TransferLinkSection detailInfo={detailInfo} setDetailInfo={setDetailInfo} onChanged={refreshViews} />
                                                <div className="flex flex-row justify-between items-center gap-2 mt-6">
                                                    <Button variant="ghost" className="text-status-crit-text dark:text-red-400 hover:bg-status-crit-soft dark:hover:bg-red-500/10"
                                                        icon={TrashIcon} onClick={() => setOpenDeleteBox(true)}>
                                                        Eliminar
                                                    </Button>
                                                    <Button icon={PencilSquareIcon} onClick={() => handleOpenEditTransaction()}>Editar</Button>
                                                </div>
                                            </div>
                                        )}
                                        {!deleteSuccess && (
                                            <div className="overflow-hidden rounded-2xl mt-3 empty:hidden">
                                                <Alert />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>

    )
}


const mapStateToProps = state => ({
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    user_transactions: state.CashFlow.user_transactions,
    trans_filters_activated: state.CashFlow.trans_filters_activated,
    default_limit: state.CashFlow.user_transactions.default_limit,

    account_activated: state.Reports.account_activated,
    iniDate_account_dash: state.Reports.iniDate_account_dash,
    endDate_account_dash: state.Reports.endDate_account_dash,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    category_activated: state.Reports.category_activated,

})

export default connect(mapStateToProps, {
    delete_transaction,
    get_user_transactions,
    update_transaction,
    setAlert,
    update_transaction_local,
    get_user_categories,
    update_transaction_local,
    get_user_categories,
    create_category,
    get_accounts_status_by_period,
    get_history_accounts_by_month,
    get_history_dash,
    get_history_category_by_month,
    get_expenses_report

})(TransactionDetail)