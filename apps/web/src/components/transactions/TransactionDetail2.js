import { Fragment, useEffect, useState } from 'react'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
//redux
import { connect } from 'react-redux'
import { delete_transaction, get_user_transactions, update_transaction, update_transaction_local } from '../../redux/actions/cashflow';
import { get_user_categories, create_category } from '../../redux/actions/cashflow';
import { get_accounts_status_by_period, get_history_accounts_by_month, get_history_dash, get_history_category_by_month, get_expenses_report } from '../../redux/actions/reports';
import { setAlert } from '../../redux/actions/alert';
//components
import { findElmentNameById, formatDate, formatMoney, formatedCurrToNumber, findElmentById, parseDatetimetoDateStrFormat, formatToDateFilters } from '../helpers';
import TransSumm from './TransSumm';
import FxRateEditor from './FxRateEditor';
import TransferLinkSection from './TransferLinkSection';
import FormEditCreateTrans from './FormEditCreateTrans';
import Alert from '../alert';
import Alert2 from '../alert2';
import { ThreeDots } from 'react-loader-spinner';

/* This example requires Tailwind CSS v2.0+ */
import {
    CheckIcon,
    XMarkIcon
} from '@heroicons/react/20/solid'

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
            let accounts_type
            if (account_activated.type.id === 1 || account_activated.type.id === 2) {
                accounts_type = "savings"
            } else if (account_activated.type.id === 3) {
                accounts_type = "investments"
            } else if (account_activated.type.id === 4) {
                accounts_type = "credits"
            }

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
            setAlert("Transaccion eliminada exitosamente", true, "", "", false)
            setLoadingDelete(false)
            setDeleteSuccess(true);
        } else {
            setAlert('No se pudo elminar la transaccion, intenta de nuevo', false, 'text-white', 'bg-red-500', 5000)
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
            date
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
                    date: date
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

    useEffect(() => {
        console.log("detailInfo Detail: ", detailInfo);
    }, [detailInfo]);
    useEffect(() => {
        console.log("editCreateData Detail: ", editCreateData);
    }, [editCreateData]);

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
                                {/* TARJETA RESUMEN */}
                                {detailInfo ?
                                    <div className='overflow-visible rounded-3xl text-left'>
                                        <div className="flex flex-col p-6 sm:p-8" >
                                            {(openDeleteBox === false && openEditTrans === false) ?

                                                /* DETALLE DE LA TRANSACCION INICIAL*/
                                                <div className="z-40">
                                                    {/* BOTON CERRAR */}
                                                    <div className='absolute top-4 right-4'>
                                                        <button
                                                            type="button"
                                                            onClick={e => setOpenTransDetail(false)}
                                                            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none"
                                                        >
                                                            <XMarkIcon className="w-6 h-6" />
                                                            <span className="sr-only">Cerrar modal</span>
                                                        </button>
                                                    </div>
                                                    {/* resumen */}
                                                    <TransSumm detailInfo={detailInfo} />
                                                    <FxRateEditor detailInfo={detailInfo} setDetailInfo={setDetailInfo} contextWindow={contextWindow} />
                                                    <TransferLinkSection detailInfo={detailInfo} setDetailInfo={setDetailInfo} onChanged={refreshViews} />
                                                    {/* botones */}
                                                    <div className="flex flex-row justify-between items-center mt-6">
                                                        <div class="flex items-center space-x-3 sm:space-x-4">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditTransaction()}
                                                                class="text-white inline-flex items-center bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                <svg aria-hidden="true" class="mr-1 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg>
                                                                Editar
                                                            </button>
                                                        </div>
                                                        <button
                                                            onClick={e => setOpenDeleteBox(true)}
                                                            type="button" class="inline-flex items-center text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-900">
                                                            <svg aria-hidden="true" class="w-5 h-5 mr-1.5 -ml-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                                                            Eliminar
                                                        </button>
                                                    </div>

                                                </div>
                                                :
                                                <>
                                                    {openEditTrans === true ?
                                                        /* EDITAR TRANSACCION */
                                                        <div className='w-full'>

                                                            <FormEditCreateTrans
                                                                editCreateData={editCreateData}
                                                                onChangeCreate={onChangeCreate}
                                                                user_categories={user_categories}
                                                                user_accounts={user_accounts}
                                                                date={date}
                                                                setDate={setDate}
                                                            />

                                                            {/* botones */}
                                                            <div class="flex flex-row justify-end items-center gap-2">
                                                                <div class="flex items-center space-x-3 sm:space-x-4">

                                                                    {loadingUpdate ?
                                                                        <div className='w-[170px] text-white flex justify-center items-center bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800'>
                                                                            <ThreeDots color="white" height="20" width="20" ariaLabel="loading" />
                                                                        </div>
                                                                        :
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => onSubmitUpdate(e)}
                                                                            class="text-white inline-flex items-center bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                            <>

                                                                                {/*  <svg aria-hidden="true" class="mr-1 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg>
                                             */}
                                                                                <CheckIcon className='mr-1 -ml-1 w-5 h-5' />

                                                                                Actualizar
                                                                            </>
                                                                        </button>
                                                                    }
                                                                </div>
                                                                {loadingUpdate ?
                                                                    <></>
                                                                    :

                                                                    <button
                                                                        onClick={() => setOpenEditTrans(false)}
                                                                        className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                        </svg>
                                                                    </button>
                                                                }
                                                            </div>



                                                        </div>
                                                        :

                                                        /* ELIMINAR TRANSACCION */
                                                        <div className='w-[284px]'>
                                                            {deleteSuccess ?
                                                                <Alert2 />
                                                                :
                                                                <div className='py-20 text-center col-span-3 text-xl flex justify-center font-medium h-[280px]'>
                                                                    Estas seguro que quieres borras esta transacción?, Perderas la información definitivamente
                                                                </div>

                                                            }
                                                            {/* BOTONES */}
                                                            {deleteSuccess ?

                                                                <div className="w-full justify-items-center items-center flex flex-row justify-around" >
                                                                    <button
                                                                        onClick={() => handleClosePopover()}
                                                                        className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                        </svg>
                                                                    </button>
                                                                </div>

                                                                :
                                                                <>
                                                                    {loadingDelete ?
                                                                        <div className="w-full justify-items-center items-center flex flex-row justify-around">
                                                                            <ThreeDots color="gray" height="40" width="40" ariaLabel="loading" />
                                                                        </div>
                                                                        :
                                                                        <div className="w-full justify-items-center items-center flex flex-row justify-around" >
                                                                            <button
                                                                                onClick={() => handleDeleteTransaction(detailInfo.id)}

                                                                                className='px-2 rounded-md bg-zinc-600 text-zinc-300 shadow-sm shadow-zinc-300 h-12 flex justify-center items-center border border-zinc-700 hover:bg-red-400 transition-transform'>
                                                                                Si, Eliminar!
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setOpenDeleteBox(false)}
                                                                                className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    }
                                                                </>
                                                            }

                                                        </div>

                                                    }
                                                </>
                                            }
                                        </div>
                                        {deleteSuccess ?
                                            <></>
                                            :
                                            <div className="overflow-hidden rounded-b-3xl">
                                                <Alert />
                                            </div>
                                        }
                                    </div>

                                    :
                                    <></>
                                }
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