import { useEffect, useState } from 'react'
//redux
import { connect } from 'react-redux'
import { delete_transaction, get_user_transactions, take_learned_identifier, update_transaction, update_transaction_local } from '../../redux/actions/cashflow';
import { updatedMessage } from './learnedMessage';

import { get_user_categories, create_category } from '../../redux/actions/cashflow';
import { get_accounts_status_by_period, get_history_accounts_by_month, get_history_dash, get_history_category_by_month, get_expenses_report } from '../../redux/actions/reports';
import { setAlert } from '../../redux/actions/alert';
//components
import { findElmentNameById, formatDate, formatMoney, formatedCurrToNumber, findElmentById, parseDatetimetoDateStrFormat, formatToDateFilters, accountReportGroup, isCreditAccount } from '../helpers';
import TransSumm from './TransSumm';
import FxRateEditor from './FxRateEditor';
import TransferLinkSection from './TransferLinkSection';
import FormEditCreateTrans from './FormEditCreateTrans';
import { CategoryPicker, AccountPicker } from './QuickPickers';
import { budgetTransactionParams } from '../dashboard/budgetCategories/budgetTransactionParams';
import Alert from '../alert';

/* This example requires Tailwind CSS v2.0+ */
import {
    CheckIcon,
    TrashIcon,
    PencilSquareIcon,
    ChevronLeftIcon
} from '@heroicons/react/20/solid'
import Button from '../ui/Button';
import Sheet from '../ui/Sheet';

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
    active_report_tab,

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
        } else if (contextWindow === "dashCategories") {
            // Presupuestos: la lista, el total del mes y las categorías. Sin categoría elegida también
            // (antes solo recargaba con una elegida y el cambio no se veía en la lista)
            const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
            get_history_dash(date_filter);
            if (category_activated?.category_id != null) get_history_category_by_month(category_activated.category_id, date_filter);
            get_user_transactions(0, 100, budgetTransactionParams({ category_activated, active_report_tab, current_Year, current_Month }), "budgetCategory")
            get_expenses_report(`${date_filter}-01`)

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
        return element?.emoji;
    }

    // Las "Recomendadas" (id negativo) aún no existen: se crean al elegirlas. Devuelve el id real o null.
    // create_category responde { res, id } (antes se usaba la respuesta entera como id y fallaba)
    const resolveCategoryId = async (categoryId) => {
        if (Number(categoryId) >= 0) return categoryId
        const newCategory = findElmentById(user_categories.items, Number(categoryId))
        const created = newCategory ? await create_category(newCategory.name, parseFloat(0), newCategory.emoji, Boolean(newCategory.income)) : null
        if (!created || created.res === false || created.id == null) {
            setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!", true, "text-white", "bg-red-500", 3000)
            return null
        }
        return created.id
    }

    const onSubmitUpdate = async (e) => {
        e.preventDefault();
        setLoadingUpdate(true)

        const newCategoryId = await resolveCategoryId(editCreateData.category_id)
        if (newCategoryId == null) {
            setLoadingUpdate(false)
            return
        }

        const cats_retrieved = await get_user_categories(0, 50)
        setEditCreateData({ ...editCreateData, ["category_id"]: newCategoryId })
        const newEmoji = findElmentEmojiById(cats_retrieved || [], parseInt(newCategoryId))
        const newCatName = findElmentNameById(cats_retrieved || [], parseInt(newCategoryId))

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
                setAlert(updatedMessage(take_learned_identifier()), true, "text-white", "bg-green-500", 6000)
            }, 200)

        } else {
            setLoadingUpdate(false)
            setAlert("No se pudo actualizar la transaccion, intenta de nuevo", false, "text-white", "bg-red-500", 5000)
        }
    }


    // Cambio rápido de categoría o cuenta desde el detalle: guarda al tocar, sin pasar por "Editar"
    const [picking, setPicking] = useState(null) // null | 'category' | 'account'
    const [savingPick, setSavingPick] = useState(false)

    const quickUpdate = async ({ category, account }) => {
        if (savingPick) return
        const sameCategory = category && String(category.id) === String(detailInfo.category?.id)
        const sameAccount = account && String(account.id) === String(detailInfo.account?.id)
        if (sameCategory || sameAccount) { setPicking(null); return }
        setSavingPick(true)

        let newCategory = detailInfo.category
        if (category) {
            const id = await resolveCategoryId(category.id)
            if (id == null) { setSavingPick(false); return }
            if (Number(category.id) < 0) get_user_categories(0, 50)
            newCategory = { id, name: category.name, emoji: category.emoji }
        }
        const newAccount = account ? { id: account.id, name: account.name, last_four_digits: account.last_four_digits } : detailInfo.account
        // cuotas solo en gastos con tarjeta: si la cuenta nueva no es tarjeta se quitan; con la categoría no cambian
        const installments = account
            ? (detailInfo.expense && isCreditAccount(account) ? (Number(detailInfo.installments) || 0) : 0)
            : undefined

        const ok = await update_transaction(
            parseInt(detailInfo.id),
            parseInt(newCategory.id),
            parseInt(newAccount.id),
            detailInfo.description,
            detailInfo.expense,
            detailInfo.amount,
            detailInfo.date,
            undefined,
            undefined,
            undefined,
            installments
        )
        setSavingPick(false)
        if (ok !== true) {
            setAlert("No se pudo actualizar la transaccion, intenta de nuevo", false, "text-white", "bg-red-500", 5000)
            return
        }
        const changes = {
            category: newCategory,
            account: newAccount,
            ...(account ? { currency: account.currency || detailInfo.currency, installments: Number(installments) > 1 ? Number(installments) : null } : {}),
        }
        setDetailInfo({ ...detailInfo, ...changes })
        update_transaction_local(detailInfo.id, changes, contextWindow)
        refreshViews()
        setPicking(null)
        setAlert(updatedMessage(take_learned_identifier()), true, "text-white", "bg-green-500", 6000)
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
            setPicking(null);
        }, 500)
    }

    //GENERALES


    /* useEffect(() => {
        console.log("closing/opening Edit ", editCreateData); 
    }, [openEditTrans]); */

    // Detalle de una transacción: hoja lateral (acompaña la lista). Estados: detalle → editar | eliminar → eliminada.
    const view = !detailInfo ? 'detail' : deleteSuccess ? 'deleted' : openDeleteBox ? 'delete' : openEditTrans ? 'edit'
        : picking === 'category' ? 'pickCategory' : picking === 'account' ? 'pickAccount' : 'detail';
    const TITLES = { detail: 'Transacción', edit: 'Editar transacción', delete: '¿Eliminar esta transacción?', deleted: 'Transacción eliminada', pickCategory: 'Cambiar categoría', pickAccount: 'Cambiar cuenta' };
    const backFooter = (
        <div className="flex">
            <Button variant="ghost" icon={ChevronLeftIcon} onClick={() => setPicking(null)} disabled={savingPick}>Volver</Button>
        </div>
    );
    const footers = {
        detail: (
            <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" className="!text-status-crit-text dark:!text-red-400 hover:!bg-status-crit-soft dark:hover:!bg-red-500/10"
                    icon={TrashIcon} onClick={() => setOpenDeleteBox(true)}>
                    Eliminar
                </Button>
                <Button icon={PencilSquareIcon} onClick={() => handleOpenEditTransaction()}>Editar</Button>
            </div>
        ),
        edit: (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenEditTrans(false)} disabled={loadingUpdate}>Cancelar</Button>
                <Button type="submit" form="edit-transaction-form" icon={CheckIcon} loading={loadingUpdate}>Guardar cambios</Button>
            </div>
        ),
        delete: (
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpenDeleteBox(false)} disabled={loadingDelete}>Cancelar</Button>
                <Button variant="danger" icon={TrashIcon} loading={loadingDelete}
                    onClick={() => handleDeleteTransaction(detailInfo.id)}>
                    Sí, eliminar
                </Button>
            </div>
        ),
        pickCategory: backFooter,
        pickAccount: backFooter,
        deleted: (
            <div className="flex sm:justify-end">
                <Button variant="secondary" className="w-full sm:w-auto" onClick={() => handleClosePopover()}>Cerrar</Button>
            </div>
        ),
    };

    return (
        <Sheet open={Boolean(openTransDetail)} onClose={handleClosePopover} title={TITLES[view]} footer={detailInfo ? footers[view] : null}>
            {detailInfo && (
                <>
                    {view === 'deleted' ? (
                        <div className="flex flex-col items-center text-center gap-3 py-6" role="status">
                            <span className="w-14 h-14 rounded-full bg-status-ok-soft dark:bg-emerald-500/15 text-status-ok flex items-center justify-center">
                                <CheckIcon className="w-8 h-8" aria-hidden="true" />
                            </span>
                            <p className="text-sm text-ink-2 dark:text-gray-400">Tus saldos y reportes ya se actualizaron.</p>
                        </div>
                    ) : view === 'delete' ? (
                        <div className="flex flex-col items-center text-center gap-3 pt-2">
                            <span className="w-14 h-14 rounded-full bg-status-crit-soft dark:bg-red-500/15 text-status-crit flex items-center justify-center">
                                <TrashIcon className="w-7 h-7" aria-hidden="true" />
                            </span>
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
                        </div>
                    ) : view === 'pickCategory' ? (
                        <CategoryPicker categories={user_categories?.items} selectedId={detailInfo.category?.id}
                            expense={detailInfo.expense} busy={savingPick} onPick={(category) => quickUpdate({ category })} />
                    ) : view === 'pickAccount' ? (
                        <AccountPicker accounts={user_accounts?.items} selectedId={detailInfo.account?.id}
                            busy={savingPick} onPick={(account) => quickUpdate({ account })} />
                    ) : view === 'edit' ? (
                        <form id="edit-transaction-form" onSubmit={(e) => onSubmitUpdate(e)} noValidate>
                            <FormEditCreateTrans
                                editCreateData={editCreateData}
                                onChangeCreate={onChangeCreate}
                                user_categories={user_categories}
                                user_accounts={user_accounts}
                                date={date}
                                setDate={setDate}
                                sourceAccountHint={detailInfo.source_account_hint}
                            />
                        </form>
                    ) : (
                        <div>
                            <TransSumm detailInfo={detailInfo}
                                onPickCategory={() => setPicking('category')}
                                onPickAccount={() => setPicking('account')} />
                            <FxRateEditor detailInfo={detailInfo} setDetailInfo={setDetailInfo} contextWindow={contextWindow} />
                            <TransferLinkSection detailInfo={detailInfo} setDetailInfo={setDetailInfo} onChanged={refreshViews} />
                        </div>
                    )}
                    {view !== 'deleted' && (
                        <div className="overflow-hidden rounded-2xl mt-3 empty:hidden">
                            <Alert />
                        </div>
                    )}
                </>
            )}
        </Sheet>
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
    active_report_tab: state.UI?.active_report_tab,

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