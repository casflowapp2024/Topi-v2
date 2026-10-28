import { Fragment, useEffect, useState } from 'react'
import { Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'

//redux
import { connect } from 'react-redux'
import { get_user_categories, update_category, delete_category } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';

//components
import DropDownEmoji from './DropDownEmoji';
import { ThreeDots } from 'react-loader-spinner';
import Alert from '../alert';
import Alert2 from '../alert2';
import { Emoji } from "emoji-picker-react";
import { formatedCurrToNumber, formatMoneyInput } from "../helpers";
import { categoriesApiErrors } from "../errosMaping";
import { XMarkIcon } from '@heroicons/react/24/solid';

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
    setAlert
}) {

    /////////////load detail info
    const [selectedEmoji, setSelectedEmoji] = useState("")
    const [categoryData, setCategoryData] = useState({
        name: detailInfo.name,
        budget: formatMoneyInput(detailInfo.budget),
        isIncome: detailInfo.income,
    });

    useEffect(() => {
        console.log(detailInfo)
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


    return (
        <>
            <Transition show={openEditCat} as={Fragment}>
                <Dialog as="div" className="relative z-40 font-Inter" onClose={handleCloseDetail}>
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
                                <DialogPanel className="relative transform overflow-hidden rounded-3xl bg-white dark:bg-[#151C2C] text-left shadow-2xl transition-all w-full max-w-md">
                                    {/* TARJETA RESUMEN */}
                                    {detailInfo ?
                                        <>
                                            <div className='h-auto'>
                                                <div className='p-6 sm:p-8'>
                                                    <div className="flex flex-row justify-between items-center mb-6">
                                                        <DialogTitle as="h3" className="text-xl font-bold leading-6 text-gray-900 dark:text-white">
                                                            Categoría
                                                        </DialogTitle>
                                                        <button
                                                            type="button"
                                                            onClick={e => handleCloseDetail()}
                                                            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors focus:outline-none"
                                                        >
                                                            <XMarkIcon className="w-6 h-6" />
                                                            <span className="sr-only">Cerrar modal</span>
                                                        </button>
                                                    </div>
                                                    {/* FORMULARIO */}
                                                    <div className="flex flex-col mt-4">
                                                        {openDeleteBox ?

                                                            <>
                                                                {(isSuccess === true) ?
                                                                    <Alert2 />
                                                                    :
                                                                    <span className='py-4'>
                                                                        Estás seguro que quieres eliminar la categoría {categoryData.name}, con presupuesto mensual de {categoryData.budget}?
                                                                    </span>
                                                                }
                                                            </>
                                                            :
                                                            <div className='flex flex-row gap-2'>
                                                                {/* emoji */}
                                                                <div className='w-1/4 flex flex-col justify-center items-center'>
                                                                    {activeUpdate ?
                                                                        <div className=''>
                                                                            <DropDownEmoji
                                                                                selectedEmoji={selectedEmoji}
                                                                                setSelectedEmoji={setSelectedEmoji}
                                                                            />
                                                                        </div>
                                                                        :
                                                                        <div className="w-[65px] flex items-center justify-center">
                                                                            <Emoji unified={(selectedEmoji).toLowerCase()} emojiStyle="apple" size={52} />
                                                                        </div>
                                                                    }
                                                                </div>
                                                                {/* data */}
                                                                <div className='w-3/4 flex flex-col'>

                                                                    <label for="name" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">
                                                                        Nombre Categoría</label>
                                                                    {activeUpdate ?
                                                                        <input type="text" name="name" id="name"
                                                                            value={categoryData.name}
                                                                            onChange={e => onChangeUpdate(e)}
                                                                            placeholder="Nombre de categoría" required
                                                                            class="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                                                                        /> :
                                                                        <>
                                                                            <span className='text-gray-900 text-sm p-2.5'>
                                                                                {categoryData.name}
                                                                            </span>

                                                                            {categoryData.isIncome ?
                                                                                <span className='text-xs px-2.5 text-gray-500' >Categoría marcada como ingresos</span> :
                                                                                <></>
                                                                            }
                                                                        </>

                                                                    }
                                                                    <label For="budget" className="mt-4 mb-2 block text-sm font-medium text-gray-900 dark:text-white">
                                                                        {categoryData.isIncome ?
                                                                            <span >Ingreso Mensual</span> :
                                                                            <span >Presupuesto Mensual</span>
                                                                        }
                                                                    </label>
                                                                    {activeUpdate ?
                                                                        <input type="text" name="budget" id="budget"
                                                                            value={categoryData.budget}
                                                                            onChange={e => onChangeUpdate(e)}
                                                                            placeholder="0" required
                                                                            className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                                                                        /> :
                                                                        <span className={` ${categoryData.isIncome ? 'text-green-700' : 'text-gray-900'}  text-sm p-2.5`}>
                                                                            {categoryData.budget}
                                                                        </span>
                                                                    }

                                                                    {activeUpdate ?
                                                                        <div className='flex flex-row gap-2 mt-3 items-center'>
                                                                            <input
                                                                                type="checkbox"
                                                                                id="isIncome"
                                                                                name="isIncome"
                                                                                checked={categoryData.isIncome}
                                                                                onChange={e => onChangeUpdate(e)}
                                                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                                                            />
                                                                            <label
                                                                                htmlFor="isIncome"
                                                                                className="ml-2 text-sm text-gray-900 dark:text-gray-300"
                                                                            >
                                                                                Esta categoría corresponde a ingresos (como salario o ganancias)
                                                                            </label>
                                                                        </div> : <></>
                                                                    }


                                                                </div>
                                                            </div>
                                                        }
                                                        {/* botones */}
                                                        <div className="flex justify-end gap-2 mt-2">
                                                            {/* normal */}
                                                            {activeUpdate === false && openDeleteBox === false ?
                                                                <div className="flex flex-row justify-around w-full">
                                                                    <div class="flex items-center space-x-4">
                                                                        <button type="button"
                                                                            onClick={() => setActiveUpdate(true)}
                                                                            class="text-white bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                                            Actualizar Categoría
                                                                        </button>
                                                                        <button type="button"
                                                                            onClick={e => setOpenDeleteBox(true)}
                                                                            class="text-red-600 inline-flex items-center hover:text-white border border-red-600 hover:bg-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900">
                                                                            <svg class="mr-1 -ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
                                                                            Eliminar
                                                                        </button>
                                                                    </div>
                                                                </div> : <></>
                                                            }
                                                            {/* actualizar */}
                                                            {activeUpdate && openDeleteBox === false ?
                                                                <>
                                                                    {loadingUpdate ?

                                                                        <div className='flex justify-center items-center'>
                                                                            <ThreeDots
                                                                                height="40"
                                                                                width="40"
                                                                                color="#5266EB"
                                                                                ariaLabel="loading"
                                                                            />
                                                                        </div>
                                                                        :
                                                                        <>
                                                                            <button
                                                                                onClick={() => onSubmitUpdate()}
                                                                                className='text-white bg-[#5266EB] hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800'>
                                                                                Actualizar
                                                                            </button>
                                                                            <button
                                                                                onClick={e => setActiveUpdate(false)}
                                                                                className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                                                </svg>
                                                                            </button>
                                                                        </>
                                                                    }
                                                                </> :
                                                                <>
                                                                </>
                                                            }
                                                            {/* eliminar */}
                                                            {openDeleteBox && activeUpdate === false ?
                                                                <>
                                                                    {loadingDelete ?

                                                                        <>
                                                                            {isSuccess ?
                                                                                <>
                                                                                </>
                                                                                :
                                                                                <div className='flex justify-center items-center'>
                                                                                    <ThreeDots
                                                                                        height="40"
                                                                                        width="40"
                                                                                        color="#5266EB"
                                                                                        ariaLabel="loading"
                                                                                    />
                                                                                </div>
                                                                            }
                                                                        </>
                                                                        :
                                                                        <>
                                                                            <button
                                                                                onClick={() => handleDeleteCat(detailInfo.id)}
                                                                                className='text-red-600 inline-flex items-center hover:text-white border border-red-600 hover:bg-red-600 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:border-red-500 dark:text-red-500 dark:hover:text-white dark:hover:bg-red-600 dark:focus:ring-red-900'>
                                                                                Si, Eliminar!
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
                                                                </> :
                                                                <>
                                                                </>
                                                            }


                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className='rounded-b-3xl overflow-hidden'>
                                                {isSuccess && loadingDelete ?
                                                    <>
                                                    </> :
                                                    <Alert />
                                                }
                                            </div>
                                        </>
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
    user_categories: state.CashFlow.user_categories,
    accountTypesOptions: state.CashFlow.account_types,
    banks: state.CashFlow.banks,
})

export default connect(mapStateToProps, {
    get_user_categories,
    update_category,
    delete_category,
    setAlert

})(EditCategory)