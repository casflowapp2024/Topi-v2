import { Fragment, useEffect, useState } from 'react'
import { NavLink, Link, useNavigate, Await } from 'react-router-dom';
import { Menu, Popover, Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'
import moment from 'moment'
//redux
import { connect, useSelector } from 'react-redux'
import { delete_transaction, get_user_transactions } from '../../redux/actions/cashflow';

//components
import { formatDate, formatCurrency, capitalizeWords } from '../helpers';
import EditTransaction from '../transactions/EditTransaction';
import TransSumm from '../transactions/TransSumm';
/* This example requires Tailwind CSS v2.0+ */
import {
    TrashIcon,
    XMarkIcon,
    PencilSquareIcon
} from '@heroicons/react/20/solid'

function TransactionDetail({
    openTransDetail,
    setOpenTransDetail,
    detailInfo,
    setDetailInfo,
    delete_transaction,
    get_user_transactions

}) {

    //ELIMINAR TRANSACION

    const [openDeleteBox, setOpenDeleteBox] = useState(false)

    const handleDeleteTransaction = async (transactionId) => {
        try {
            const deleteResponse = await delete_transaction(transactionId);
            console.log(deleteResponse)
            // The code below will only execute after the transaction is deleted
            setOpenDeleteBox(false);
            setOpenTransDetail(false);
            if (deleteResponse === true) {
                get_user_transactions(0, 20)
                setOpenDeleteBox(false);
                setOpenTransDetail(false);
                alert('Transaccion eliminada')
            } else {

                alert('No se pudo celiminar la transaccion, intenta de nuevo')
            }

        } catch (error) {
            alert('Error al borrar la transaccion intente de nuevo:', error);
        }
    }

    //GENERALES
    useEffect(() => {
        get_user_transactions(0, 20)
    }, [detailInfo])

    //Edit Open
    const [openEditTrans, setOpenEditTrans] = useState(false)

    const handleOpenEditTransaction = async () => {
        setOpenEditTrans(true)
        console.log('opening')
    }

    return (

        <>
            {/*Este es el modal para abrir el Box de crear una transaccion nueva */}
            <Transition show={openTransDetail} as={Fragment}>
                <Dialog as="div" className="relative z-40 font-Inter" onClose={setOpenTransDetail}>
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-white bg-opacity-75 transition-opacity" />
                    </TransitionChild>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full items-end justify-center p-2 text-center sm:items-center sm:p-0">
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
                                <DialogPanel className="w-[340px] relative transform overflow-hidden text-gray-700 rounded-lg border border-gray-300 bg-white px-2 py-2 text-left shadow-xl transition-all sm:my-8 sm:p-6">
                                    <div>
                                        <div className="text-center">
                                            <DialogTitle as="h3" className=" font-mediump b-2 ">
                                                Detalle de la Transacción
                                            </DialogTitle>
                                        </div>
                                    </div>
                                    {/* TARJETA RESUMEN */}
                                    {detailInfo ?
                                        <div className='h-[350px]'>
                                            {/* contenido transacion */}
                                            <div className="h-[280px] w-full flex flex-col mb-4 rounded-lg p-4 justify-items-end items-left" >
                                                {(openDeleteBox === false && openEditTrans === false) ?
                                                    <>  <TransSumm detailInfo={detailInfo} />
                                                        <div className='flex flex-row justify-start items-baseline'>
                                                            <span className='text-sm font-light'>Fecha:</span>
                                                            <span className='col-span-2 font-medium pl-2'>
                                                                {formatDate(detailInfo.date)}
                                                            </span>
                                                        </div>
                                                        <div className='flex flex-row justify-start items-baseline'>
                                                            <span className='text-sm font-light'>Cuenta:</span>
                                                            <span className='col-span-2 font-medium  pl-2'>{detailInfo.account.name}</span>
                                                        </div>
                                                        <div className='text-sm font-light w-full flex justify-center py-2'>
                                                            {detailInfo.expense === false ?
                                                                <span className=' text-xl text-emerald-600 font-medium '>
                                                                    +{formatCurrency(detailInfo.amount)}
                                                                </span>
                                                                :
                                                                <span className=' text-xl text-red-600 font-medium '>
                                                                    -{formatCurrency(detailInfo.amount)}
                                                                </span>
                                                            }
                                                        </div>
                                                        <div>
                                                            <span className='text-sm font-light leading-tight '>Categoría:</span>
                                                            <span className='font-medium pl-2'> {capitalizeWords(detailInfo.category.name)}</span>
                                                        </div>
                                                        <span className='text-sm font-light leading-tight '>Decripción:</span>
                                                        <span className='font-medium '>
                                                            {detailInfo.description}
                                                        </span>

                                                        <div className='flex flex-col justify-end'>
                                                            <div className='mt-8 text-xs flex flex-col justify-items-end '>
                                                                <span className='font-light text-end '>Balance antes de Operación</span>
                                                                <span className='font-medium text-end  '>balance_before </span>
                                                            </div>
                                                            <div className='text-xs flex flex-col justify-items-end'>
                                                                <span className='font-light leading-tight  text-end'>Balance despúes de Operación</span>
                                                                <span className='font-medium text-end '> balance_after </span>
                                                            </div>
                                                        </div>
                                                    </>
                                                    :
                                                    <>
                                                        {openEditTrans === true ?
                                                            <>
                                                                <EditTransaction
                                                                    openEditTrans={openEditTrans}
                                                                    setOpenEditTrans={setOpenEditTrans}
                                                                    detailInfo={detailInfo}
                                                                    setDetailInfo={setDetailInfo}
                                                                />
                                                            </>
                                                            :
                                                            <div className='py-20 text-center col-span-3 text-xl flex justify-center font-medium h-[280px]'>
                                                                Estas seguro que quieres borras esta transacción?, Perderas la información definitivamente
                                                            </div>
                                                        }
                                                    </>
                                                }
                                            </div>
                                            {/* botones */}
                                            <div className="w-full justify-items-center items-center flex flex-row justify-around" >
                                                {(openDeleteBox === true || openEditTrans === true) ?
                                                    <>
                                                        {openDeleteBox ?
                                                            <>
                                                                <button
                                                                    onClick={() => handleDeleteTransaction(detailInfo.id)}

                                                                    className='px-2 rounded-md bg-zinc-600 text-zinc-300 shadow-sm shadow-zinc-300 h-12 flex justify-center items-center border border-zinc-700 hover:bg-red-400 transition-transform'>
                                                                    Si, Eliminar!
                                                                </button>
                                                                <button
                                                                    onClick={e => setOpenDeleteBox(false)}
                                                                    className='rounded-full bg-zinc-400 w-12 shadow-sm shadow-zinc-400 h-12 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                    </svg>

                                                                </button>
                                                            </> :
                                                            <></>
                                                        }


                                                    </>
                                                    :
                                                    <div className="flex flex-row justify-around w-full">
                                                        <button
                                                            onClick={e => setOpenDeleteBox(true)}
                                                            className='rounded-full bg-rose-500 w-12 shadow-sm shadow-rose-500 h-12 flex justify-center items-center border border-zinc-700 hover:bg-rose-300'>
                                                            <TrashIcon className='w-8 h-8 text-gray-700' />
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenEditTransaction()}
                                                            className='rounded-full bg-[#5266EB] w-12 shadow-sm shadow-"#5266EB" h-12 flex justify-center items-center border border-zinc-700 hover:bg-blue-300'>
                                                            <PencilSquareIcon className='w-8 h-8 text-gray-700' />
                                                        </button>
                                                        <button
                                                            onClick={e => setOpenTransDetail(false)}
                                                            className='rounded-full bg-zinc-400 w-12 shadow-sm shadow-zinc-400 h-12 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                            <XMarkIcon className='w-8 h-8 text-gray-700' />
                                                        </button>
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

})

export default connect(mapStateToProps, {
    delete_transaction,
    get_user_transactions

})(TransactionDetail)