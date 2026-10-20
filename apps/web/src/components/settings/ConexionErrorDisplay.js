import { Fragment, useEffect, useState } from 'react'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
//redux
import { connect } from 'react-redux'
import { emailsAutomationErrors } from '../errosMaping'

//components


/* This example requires Tailwind CSS v2.0+ */
import {
    ChevronDoubleDownIcon,
    PlusIcon
} from '@heroicons/react/20/solid'

function ConexionErrorDisplay({
    //props
    openErrorPopup,
    setOpenErrorPopup,
    emailErrorSelected
    //actions

    //state


}) {

    const handleClosePopover = () => {
        setOpenErrorPopup(false);
        //setEditCreateData(null)

    }

    useEffect(() => {
        console.log("openDeleteEmail changed:", emailErrorSelected);
    }, [emailErrorSelected]);


    const stepiconsMap = {
        'basurita': <div
            className='border border-red-600 text-red-600 flex items-center justify-center rounded-md hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors duration-200'
            style={{ width: '40px', height: '40px' }}>
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
        </div>,
        'vincular': <div className="max-h-min text-sm px-4 flex flex-row items-center bg-slate-100 dark:bg-slate-800 dark:text-gray-200 rounded-full border border-[#5266EB] hover:bg-slate-200 dark:hover:bg-slate-700 group transition-colors duration-300">
            <PlusIcon className="w-4 h-4 mr-2 group-hover:text-[#5266EB]" />
            <span className="pr-2">
                Conectar nuevo Email
            </span>
        </div>,
    }

    return (

        <Transition show={openErrorPopup} as={Fragment}>
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
                    <div className="fixed inset-0 bg-white dark:bg-black bg-opacity-75 dark:bg-opacity-70 transition-opacity" />
                </TransitionChild>

                <div className="fixed md:left-[64px] inset-0 z-20">
                    <div className="flex min-h-full justify-center text-center  p-0">
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
                            <DialogPanel className="mx-1 md:w-2/3 max-h-min top-20 md:top-40 relative transform border border-yellow-300 rounded-lg bg-white shadow dark:bg-gray-800  transition-all ">
                                <div className='overflow-hidden rounded-lg text-left'>
                                    <div className="flex flex-col rounded-lg p-4 justify-items-end items-left" >

                                        {emailErrorSelected && emailErrorSelected.error !== null ?
                                            <div className="flex flex-col  gap-2 justify-center items-center">

                                                <div className="text-gray-700 dark:text-gray-300 font-medium">
                                                    {emailsAutomationErrors[emailErrorSelected.error]["intro"]}
                                                </div>
                                                <h4 className='font-bold dark:text-white'>{emailErrorSelected.email}</h4>
                                                <div className="dark:text-gray-300">
                                                    {emailsAutomationErrors[emailErrorSelected.error]["exp"]}
                                                </div>
                                                <div>
                                                    <ChevronDoubleDownIcon className="h-6 w-6 text-[#5266EB]" aria-hidden="true" />
                                                </div>
                                                <div className="dark:text-gray-300">
                                                    {emailsAutomationErrors[emailErrorSelected.error]["sol"]}
                                                </div>

                                                <div className='flex flex-row items-center mt-4 justify-center'>
                                                    {stepiconsMap[emailsAutomationErrors[emailErrorSelected.error]["step1icon"]]}
                                                    <div className='mx-4 dark:text-white'>➔</div>
                                                    {stepiconsMap[emailsAutomationErrors[emailErrorSelected.error]["step2icon"]]}

                                                </div>


                                            </div>
                                            : null
                                        }

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


})

export default connect(mapStateToProps, {


})(ConexionErrorDisplay)