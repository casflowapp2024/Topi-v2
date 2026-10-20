import { Fragment, useState } from "react";
//components
import { get_user_categories, create_category } from "../../redux/actions/cashflow";
import { Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/solid';
import EditCreateCategoryForm from "./EditCreateCategoryForm";
import Alert from '../alert';
import { formatedCurrToNumber, formatCurrency } from "../helpers";
import { categoriesApiErrors } from "../errosMaping";
//apiCall
import { CreateCategoryCall } from '../../apiCalls/categories/CreateCategoryCall'
//redux
import { connect } from 'react-redux';
import { setAlert } from "../../redux/actions/alert";

const CreateCategory = ({
  openCreateBox,
  setOpenCreateBox,
  get_user_categories,
  create_category,
  setAlert
}) => {

  const contextEditCreate = "create"

  const {
    loadingCreate,
    formDataCreate,
    setformDataCreate,
    selectedEmoji,
    setSelectedEmoji,
    onSubmitEditCreate,
    onChangeCreate,
    initialFormState, // Obtenemos el estado inicial para resetear
  } = CreateCategoryCall(create_category, get_user_categories, setAlert);


  const handleCloseDetail = async () => {
    setOpenCreateBox(false);
    setTimeout(() => {
      setformDataCreate(initialFormState); // Reiniciamos el estado del formulario
      setSelectedEmoji("");
      setAlert("...", true, "text-white", "bg-white", 300);
    }, 500);
  };


  return (
    <>
      {/*PopOver Create category*/}
      <Transition show={openCreateBox} as={Fragment}>
        <Dialog as="div" className="relative z-30 font-Inter" onClose={handleCloseDetail}>
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

                  <div className='p-6 sm:p-8'>
                    <div className="flex flex-row justify-between items-center mb-6">
                      <DialogTitle as="h3" className="text-xl font-bold leading-6 text-gray-900 dark:text-white">
                        Crear Categoría
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

                    <EditCreateCategoryForm
                      categoryData={formDataCreate} // Usamos el estado del hook
                      selectedEmoji={selectedEmoji} // Usamos el estado del hook
                      setSelectedEmoji={setSelectedEmoji} // Usamos el setter del hook
                      onChangeCreate={onChangeCreate} // Usamos el onChange del hook
                      loadingCreate={loadingCreate} // Usamos el estado de carga del hook
                      contextEditCreate={contextEditCreate}
                      onSubmitEditCreate={onSubmitEditCreate} // Usamos la función del hook
                      handleCloseDetail={handleCloseDetail}
                    />

                  </div>
                  <div className="overflow-hidden rounded-b-3xl">
                    <Alert />
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
  get_user_categories,
  create_category,
  setAlert
})(CreateCategory)
