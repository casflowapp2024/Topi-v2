import { Fragment, useEffect, useState } from 'react'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
//redux
import { connect } from 'react-redux'
import {
    get_user_categories, create_transaction, get_user_transactions, get_user_accounts,
    create_category
} from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
//components
import { formatDate, formatMoney, formatMoneyCompact, formatedCurrToNumber, findElmentById, parseDatetimetoDateStrFormat, isOpenAccount } from '../helpers';
import 'react-datepicker/dist/react-datepicker.css'
import { ThreeDots } from 'react-loader-spinner';
import FormEditCreateTrans from './FormEditCreateTrans';
import Alert from '../alert';
//icons
import { XMarkIcon } from '@heroicons/react/24/solid';


function CreateTransaction({
    //props
    openCreatePopUp,
    SetOpenCreatePopUp,
    currentFrontendPage,
    //states 
    user_categories,
    user_accounts,
    create_transaction,
    get_user_transactions,
    get_user_categories,
    get_user_accounts,
    setAlert,
    trans_filters_activated,
    default_limit,
    create_category,
    initialCategoryId,
    initialAccountId

}) {

    const [date, setDate] = useState(parseDatetimetoDateStrFormat(new Date(), 'YYYY-MM-DD HH:mm:ss Z'));

    //create account
    const [loadingCreate, setLoadingCreate] = useState(false)
    const [createTransData, setCreatTransData] = useState({
        category_id: 0,
        account_id: 0,
        description: "",
        expense: true,
        amount: "$0",
    });

    useEffect(() => {
        if (openCreatePopUp) {
            setCreatTransData(prev => ({
                ...prev,
                category_id: initialCategoryId || (user_categories?.items?.length > 0 ? user_categories.items[0].id : 0),
                account_id: initialAccountId || ((user_accounts?.items || []).find(isOpenAccount)?.id ?? 0),
                amount: "$0",
            }));
        }
    }, [openCreatePopUp, initialCategoryId, initialAccountId]);

    useEffect(() => {
        get_user_accounts(0, 20)
        get_user_categories(0, 20)
    }, []);

    // Initialize default categories/accounts when they load if not already set
    useEffect(() => {
        if (openCreatePopUp) {
            if (user_categories?.items?.length > 0 && !createTransData.category_id && !initialCategoryId) {
                setCreatTransData(prev => ({ ...prev, category_id: user_categories.items[0].id }));
            }
        }
    }, [user_categories, openCreatePopUp]);

    useEffect(() => {
        if (openCreatePopUp) {
            const firstOpen = (user_accounts?.items || []).find(isOpenAccount);
            if (firstOpen && !createTransData.account_id && !initialAccountId) {
                setCreatTransData(prev => ({ ...prev, account_id: firstOpen.id }));
            }
        }
    }, [user_accounts, openCreatePopUp]);


    const onChangeCreate = (e) => {
        if (e.target.name === "expense") {
            setCreatTransData({ ...createTransData, [e.target.name]: !e.target.checked })
        } else {
            if (e.target.name === "expense") {
                setCreatTransData({ ...createTransData, [e.target.name]: !createTransData.expense })
            } else {
                setCreatTransData({ ...createTransData, [e.target.name]: e.target.value })
            }
        }
    }

    const onSubmitCreate = async (e) => {

        e.preventDefault();
        setLoadingCreate(true)
        let newCategoryId = createTransData.category_id
        // category must be created first
        if (createTransData.category_id < 0) {
            const newCategory = findElmentById(user_categories.items, createTransData.category_id)
            const createCategoryResponse = await create_category(newCategory.name, parseFloat(0), newCategory.emoji)
            if (createCategoryResponse === false) {
                setAlert("Algo salio mal, la categoría no fue creada, intenta de nuevo!", true, "text-white", "bg-red-500", 3000)
                setLoadingCreate(false)
                return
            }
            newCategoryId = createCategoryResponse
            await get_user_categories(0, 50)
            setCreatTransData({ ...createTransData, ["category_id"]: newCategoryId })
        }
        // create transaction

        console.log("creating", date)

        const createResponse = await create_transaction(
            parseInt(newCategoryId),
            parseInt(createTransData.account_id),
            createTransData.description,
            createTransData.expense,
            parseFloat(formatedCurrToNumber(createTransData.amount)),
            date)

        if (createResponse === true) {

            await get_user_transactions((currentFrontendPage - 1) * default_limit, default_limit, trans_filters_activated.params)
            setAlert('Transaccion creada', true, 'text-white', 'bg-green-500', 4000)
            setLoadingCreate(false)
            setTimeout(() =>
                setCreatTransData({
                    ...createTransData,
                    description: "",
                    expense: true,
                    amount: "$0",
                }),
                300)

        } else {
            setLoadingCreate(false)
            setAlert('No se pudo crear la transaccion, intenta de nuevo', true, 'text-white', 'bg-red-500', 4000)
        }
    }

    const handleClosePopover = () => {
        SetOpenCreatePopUp(false);
    };

    /* useEffect(() => {

        console.log(createTransData)

    }, [createTransData,date]); */


    return (
        <Transition show={openCreatePopUp} as={Fragment}>
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

                <div className="fixed inset-0 z-10 overflow-y-auto w-screen">
                    <div className="flex min-h-full items-center justify-center text-center p-4 sm:p-0">
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
                            <DialogPanel className="relative transform overflow-hidden rounded-3xl bg-white dark:bg-[#151C2C] text-left shadow-2xl transition-all w-full max-w-lg">
                                <div>
                                    <div className="px-6 py-6 sm:px-8 sm:py-8">
                                        {/* titulo y cerrar */}
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                Crear Transacción
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={handleClosePopover}
                                                className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none"
                                            >
                                                <XMarkIcon className="w-6 h-6" />
                                                <span className="sr-only">Cerrar modal</span>
                                            </button>
                                        </div>

                                        {/* formulario */}
                                        <FormEditCreateTrans
                                            editCreateData={createTransData}
                                            onChangeCreate={onChangeCreate}
                                            user_categories={user_categories}
                                            user_accounts={user_accounts}
                                            date={date}
                                            setDate={setDate}
                                        />

                                        {/* boton crear y cerrar */}
                                        <div className="flex justify-end gap-2 mt-2 p-2">
                                            {loadingCreate ?
                                                <div
                                                    class="bg-[#5266EB] text-white px-4 py-2 rounded-lg w-28">
                                                    <div className='flex justify-center items-center'>
                                                        <ThreeDots
                                                            height="20"
                                                            width="20"
                                                            color="white"
                                                            ariaLabel="loading"
                                                        />
                                                    </div>
                                                </div>
                                                :
                                                <button
                                                    onClick={onSubmitCreate}
                                                    className="bg-[#5266EB] text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-28"
                                                >
                                                    Crear
                                                </button>
                                            }
                                        </div>
                                    </div>
                                    <div className='overflow-hidden rounded-b-3xl'>
                                        <Alert />
                                    </div>
                                </div>



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
    trans_filters_activated: state.CashFlow.trans_filters_activated,
    default_limit: state.CashFlow.user_transactions.default_limit
})

export default connect(mapStateToProps, {
    create_transaction,
    get_user_transactions,
    get_user_categories,
    get_user_accounts,
    create_category,
    setAlert,


})(CreateTransaction)