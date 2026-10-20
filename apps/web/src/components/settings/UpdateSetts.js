import { Fragment, useState } from 'react'
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
//redux
import { connect } from 'react-redux'
//components



function UpdateSetts({
    editField,
    openUpdateSettsBox,
    setOpenUpdateSettsBox,
    setAlert,
}) {
    const [gmailPersonalEmail, setGmailPersonalEmail] = useState('')
    const [loadingUpdate, setLoadingUpdate] = useState(false)
    const [linkSucess, setLikSucces] = useState(false)

    const handleClosePopUp = async () => {
        setOpenUpdateSettsBox(false)
        setTimeout(() => {
            setLoadingUpdate(false)
            setLikSucces(false)
            //setAlert('...',true,'text-white','bg-white',100)

        }, 300)
    }

    const onChangeGmail = (e) => {
        setGmailPersonalEmail(e.target.value);
    };

    const onSubmitLink = (e) => {
        setLoadingUpdate(true)

        console.log('linkig', gmailPersonalEmail)
    };



    return (

        <>
            {/*Este es el modal para abrir el Box de crear una transaccion nueva */}
            <Transition show={openUpdateSettsBox} as={Fragment}>
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
                        <div className="fixed inset-0 bg-white bg-opacity-75 transition-opacity" />
                    </TransitionChild>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full justify-center p-2 text-center items-start mt-52 md:mt-0 md:items-center">
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
                                <DialogPanel className="top-12 md:top-0 relative transform overflow-hidden rounded-lg bg-white px-4 py-2 text-left shadow-xl transition-all sm:my-8 sm:p-6">
                                    {/* TARJETA RESUMEN */}

                                    <div className='h-auto md:w-[552px]'>

                                        {/* titulo y cerrar */}
                                        <div class="flex justify-between mb-2 rounded-t sm:mb-5">
                                            <div class="w-2/3 text-lg text-gray-900 md:text-xl dark:text-white">
                                                <h3 class="font-semibold ">
                                                    Actualizar {editField}
                                                </h3>
                                            </div>
                                            <div>
                                                <button type="button"
                                                    onClick={handleClosePopUp}
                                                    class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                                    <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                    <span class="sr-only">Close modal</span>
                                                </button>
                                            </div>
                                        </div>


                                    </div>

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


})(UpdateSetts)