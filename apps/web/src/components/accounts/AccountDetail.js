import { Fragment, useState, useEffect } from 'react'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
//redux
import { connect } from 'react-redux'
import { delete_account, get_user_accounts } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
//components
import AccCard from './AccCard';
import EditAccounts from './EditAccounts';
import Alert from '../alert';
import Alert2 from '../alert2';
import { formatMoney, formatedCurrToNumber } from '../helpers';
import { get_net_worth } from '../../redux/actions/fx';
import { XMarkIcon } from '@heroicons/react/24/solid';
/* This example requires Tailwind CSS v2.0+ */
import { ThreeDots } from 'react-loader-spinner';


function AccountDetail({
    openAccDetail,
    setOpenAccDetail,
    detailInfo,
    setDetailInfo,
    banks,
    accountTypesOptions,
    delete_account,
    get_user_accounts,
    setAlert,
    balance_by_account,
    net_worth,
    get_net_worth

}) {


    //ELIMINAR CUENTA
    const [openDeleteBox, setOpenDeleteBox] = useState(false)
    const [loadingDelete, setLoadingDelete] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [isFailed, setIsFailed] = useState(false)

    const handleDeleteAcc = async (accId) => {
        setLoadingDelete(true)
        const deleteResponse = await delete_account(accId);

        // The code below will only execute after the transaction is deleted
        if (deleteResponse === true) {
            setLoadingDelete(false)
            setIsSuccess(true)
            setAlert('Cuenta Eliminada', true, 'text-red-600', 'bg-gray-200', false)
            get_user_accounts(0, 20)
            /* setTimeout(() => {
                setOpenAccDetail(false);
            }, 4900)
            setTimeout(() => {
                setOpenDeleteBox(false);
                setIsSuccess(false)
            }, 5200) */

        } else {
            setLoadingDelete(false)
            setIsFailed(true)
            setAlert('Algo salió mal la cuenta no fue eliminada', false, 'text-red-600', 'bg-gray-200', false)
            /* setTimeout(() => {
                //setOpenDeleteBox(false);
                setIsFailed(false)
            }, 5000) */
        }


    }

    const outSuccesFailed = async () => {
        if (isSuccess) {
            setOpenAccDetail(false)
            setTimeout(() => {
                setAlert('...', false, 'text-white', 'bg-white', 300)
                setIsSuccess(false)
                setOpenDeleteBox(false)
            }, 1000)
        } else {
            setIsFailed(false)
        }
    }

    //Edit Open
    const [openEditAcc, setOpenEditAcc] = useState(false)

    const handleOpenEditAcc = async () => {
        setOpenEditAcc(true)
    }

    //close popup
    const handleClosePopUp = async () => {
        setOpenAccDetail(false)
        setTimeout(() => {
            setAlert('...', true, 'text-white', 'bg-white', 100)
            setOpenDeleteBox(false)
            setOpenEditAcc(false)
            setIsFailed(false)
            setIsSuccess(false)
        }, 300)
    }

    useEffect(() => {
        if (openAccDetail === false) {
            setOpenDeleteBox(false)
            setLoadingDelete(false)
            setIsSuccess(false)
            setIsFailed(false)
        }

    }, [openAccDetail]);

    // Saldo de hoy en la moneda de la cuenta y su equivalente en la moneda base: sale del
    // patrimonio, que se recarga después de cada cambio (incluido el de moneda); el reporte de
    // saldos por cuenta queda de respaldo
    const accountNetWorth = (id) => net_worth?.accounts?.find(a => a.account_id === id);
    const findBalanceByAccountId = (elements, id) => {
        const nw = accountNetWorth(id);
        if (nw) return Number(nw.balance);
        const element = (elements || []).find(element => element.account_id === id);
        return element ? element.balance : null;
    };
    useEffect(() => { if (openAccDetail) get_net_worth(); }, [openAccDetail]); // eslint-disable-line react-hooks/exhaustive-deps

    /* useEffect(() => {
    console.log("detailInfo: ", detailInfo);
    }, [detailInfo]); */

    return (
        <>
            {/*Este es el modal para abrir el Box de crear una transaccion nueva */}
            <Transition show={openAccDetail} as={Fragment}>
                <Dialog as="div" className="relative z-40 font-Inter" onClose={handleClosePopUp}>
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
                                <DialogPanel className="relative transform overflow-hidden rounded-3xl bg-white dark:bg-[#151C2C] text-left shadow-2xl transition-all w-full max-w-lg">
                                    {/* TARJETA RESUMEN */}
                                    {detailInfo ?
                                        <div className='p-6 sm:p-8 w-full'>

                                            {/* titulo y cerrar */}
                                            <div className="flex justify-between items-center mb-6">
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                    Detalle de Producto
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={handleClosePopUp}
                                                    className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none"
                                                >
                                                    <XMarkIcon className="w-6 h-6" />
                                                    <span className="sr-only">Cerrar modal</span>
                                                </button>
                                            </div>

                                            {/* card */}
                                            <div className="flex justify-center items-center my-5">
                                                <AccCard
                                                    name={detailInfo.name}
                                                    accountTypesOptions={accountTypesOptions}
                                                    accountType={detailInfo.type.id}
                                                    banks={banks}
                                                    bankId={detailInfo.bank.id}
                                                    initia_balance_amount={findBalanceByAccountId(balance_by_account, detailInfo.id)}
                                                    lastFourDigits={detailInfo.last_four_digits}
                                                    currency={detailInfo.currency}
                                                    base={accountNetWorth(detailInfo.id)?.base_value}
                                                />
                                            </div>
                                            {detailInfo && detailInfo.automation.configured === true ?
                                                <span className='text-xs text-gray-500'>
                                                    Lectura de transacciones automáticas <span className='text-green-600 font-bold'>activada</span>
                                                </span>
                                                :
                                                <span className='text-xs text-gray-500'>
                                                    Lectura de transacciones automáticas <span className='text-red-600 font-bold'>desactivada</span>
                                                </span>
                                            }
                                            <div className="border-b border-gray-300 mb-4">
                                            </div>

                                            {/* Editar, Eliminar cuenta status */}
                                            <div className='h-auto'>
                                                {(isSuccess === true || isFailed === true) ?
                                                    <Alert2 />
                                                    :
                                                    < >
                                                        {(openDeleteBox === false && openEditAcc === false) ?
                                                            <>
                                                            </>
                                                            :
                                                            <>
                                                                {openEditAcc === true ?
                                                                    <>
                                                                        <EditAccounts
                                                                            openEditAcc={openEditAcc}
                                                                            setOpenEditAcc={setOpenEditAcc}
                                                                            detailInfo={detailInfo}
                                                                            setDetailInfo={setDetailInfo}
                                                                            setOpenAccDetail={setOpenAccDetail}
                                                                            setIsFailed={setIsFailed}
                                                                            handleClosePopUp={handleClosePopUp}
                                                                        />
                                                                    </>
                                                                    :
                                                                    <div className='flex justify-center text-center col-span-3 text-sm font-medium h-auto text-gray-700 dark:text-gray-300'>
                                                                        El saldo de está cuenta se eliminará de tu balance total. Estás seguro que quieres desvincular esta cuenta?
                                                                    </div>
                                                                }
                                                            </>
                                                        }
                                                    </>
                                                }
                                            </div>

                                            {/* botones */}

                                            <div className="w-full justify-items-center items-center flex flex-row justify-around mt-4" >
                                                {(openDeleteBox === true || openEditAcc === true) ?
                                                    <>
                                                        {openDeleteBox ?
                                                            <>
                                                                {loadingDelete ?
                                                                    <div className='flex justify-center items-center'>
                                                                        <ThreeDots
                                                                            height="70"
                                                                            width="70"
                                                                            color="#5266EB"
                                                                            ariaLabel="loading"
                                                                        />
                                                                    </div>

                                                                    :
                                                                    <>
                                                                        {(isSuccess === true || isFailed === true) ?
                                                                            <button
                                                                                onClick={e => outSuccesFailed()}
                                                                                className='rounded-lg w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                                </svg>
                                                                            </button>
                                                                            :
                                                                            <>
                                                                                <button
                                                                                    onClick={() => handleDeleteAcc(detailInfo.id)}
                                                                                    className='text-red-600 inline-flex items-center hover:text-white border border-red-600 hover:bg-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900'>
                                                                                    Si, Desvincular!
                                                                                </button>
                                                                                <button
                                                                                    onClick={e => setOpenDeleteBox(false)}
                                                                                    className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                                    </svg>
                                                                                </button>
                                                                            </>
                                                                        }
                                                                    </>

                                                                }
                                                            </>
                                                            :
                                                            <></>
                                                        }


                                                    </>
                                                    :
                                                    <div className="flex flex-row justify-around w-full">
                                                        <div class="flex items-center space-x-4">
                                                            <button type="button"
                                                                onClick={() => handleOpenEditAcc()}
                                                                class="text-white bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                Actualizar Info.
                                                            </button>
                                                            <button type="button"
                                                                onClick={e => setOpenDeleteBox(true)}
                                                                class="text-red-600 inline-flex items-center hover:text-white border border-red-600 hover:bg-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900">
                                                                <svg class="mr-1 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    </div>

                                                }

                                            </div>

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
        </>
    )
}


const mapStateToProps = state => ({
    banks: state.CashFlow.banks.items,
    accountTypesOptions: state.CashFlow.account_types,
    balance_by_account: state.Reports.balance_by_account,
    net_worth: state.Fx?.net_worth,

})

export default connect(mapStateToProps, {
    delete_account,
    get_user_accounts,
    setAlert,
    get_net_worth

})(AccountDetail)