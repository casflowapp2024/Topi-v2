import { Fragment, useEffect, useState } from "react";

//components
import { Transition, Dialog, TransitionChild, DialogPanel } from '@headlessui/react'
import { ThreeDots } from 'react-loader-spinner';
import Alert from '../alert';
import Alert2 from "../alert2";
import AccCard from "./AccCard";
import EditCreateFinAccountForm from "./EditCreateFinAccountForm";
import { formatCurrency, formatedCurrToNumber, findElmentById } from '../helpers';
import { XMarkIcon } from '@heroicons/react/24/solid';
//redux
import { connect } from 'react-redux';
import { get_user_accounts, create_f_account } from "../../redux/actions/cashflow";
import { create_personal_bank, get_banks } from "../../redux/actions/cashflow";
import { setAlert } from "../../redux/actions/alert";

// primer banco propio del usuario; si no tiene, el primero de los oficiales
const defaultBankId = (banks) => (banks.find(bank => !bank.isDefault) || banks[0]).id;

const AccountCreate = ({
    openCreateBox,
    setOpenCreateBox,
    //redux actions|
    get_user_accounts,
    create_f_account,
    setAlert,
    get_banks,
    //redux state
    banks,
    accountTypesOptions,
    automatedEmails,
    create_personal_bank
}) => {

    const [loadingCreate, setLoadingCreate] = useState(false)
    const [accCreated, setAccCreated] = useState(false)
    const [isFailed, setIsFailed] = useState(false)
    const [createAccountData, setCreateAccountData] = useState({
        name: '',
        last_four_digits: '',
        accountType: 1,
        bankId: '', // Default to the first bank if available
        initia_balance_amount: '$0',
        automated: true,
        gmailPersonalEmail: '',
    });

    // Banco por defecto: se elige al abrir el diálogo (no al montar la página, cuando la lista puede
    // tener solo los bancos oficiales) y se prefieren los bancos propios del usuario.
    useEffect(() => {
        if (!openCreateBox || !banks || banks.length === 0) return;
        setCreateAccountData(prev => {
            const current = banks.find(bank => bank.id === parseInt(prev.bankId));
            if (prev.bankId !== '' && current) return prev;
            return { ...prev, bankId: defaultBankId(banks) };
        });
    }, [banks, openCreateBox]);

    useEffect(() => {
        console.log("createAccountData changed:", createAccountData);

    }, [createAccountData]);




    const onChangeCreate = (e) => {
        const { name, type, checked, value } = e.target;

        setCreateAccountData({
            ...createAccountData,
            [name]: type === "checkbox" ? checked : value
        });

    };

    //handle off automated
    useEffect(() => {
        if (banks && banks.length === 0) {
            const selectedBank = banks.find(bank => bank.id === parseInt(createAccountData.bankId))
            //console.log("selectedBank",selectedBank)
            if ((!createAccountData.automated) || (!selectedBank.is_automated)) {
                setCreateAccountData((prevData) => ({
                    ...prevData,
                    automated: false,
                    gmailPersonalEmail: "",
                }));
            }
        }
    }, [createAccountData.automated, createAccountData.bankId]);

    const handleClosePopover = () => {
        setOpenCreateBox(false); // Hide the popover
        setCreateAccountData({
            ...createAccountData,
            name: '',
            last_four_digits: '',
            accountType: 1,
            bankId: '', // Default to the first bank if available
            initia_balance_amount: '$0',
            automated: true,
            gmailPersonalEmail: '',
        })
        setTimeout(() => {
            setAccCreated(false)
        }, 900)
    };

    const verifyData = (id) => {
        if (parseInt(id) >= 0) {
            return true
        } else {
            alert('Los Digitos de la cuenta deben ser números!!')
            return false
        }
    }

    const onSubmitCreate = async (e) => {
        e.preventDefault();
        setLoadingCreate(true)

        const passData = verifyData(createAccountData.last_four_digits)

        //crear cuenta primero
        if (passData === true) {
            if (createAccountData.automated === false) {
                createAccountData.gmailPersonalEmail = null
            }
            let email_id = ""
            if (createAccountData.gmailPersonalEmail && createAccountData.gmailPersonalEmail.id) {
                email_id = parseInt(createAccountData.gmailPersonalEmail.id)
            }

            let newBankId = createAccountData.bankId
            // bank must be created first
            if (createAccountData.bankId < 0) {
                const newBank = findElmentById(banks, createAccountData.bankId)
                const createBankResponse = await create_personal_bank(newBank.name, newBank.email)
                if (createBankResponse === false) {
                    setAlert("Algo salio mal, el banco no fue creado, intenta de nuevo!", true, "text-white", "bg-red-500", 3000)
                    setLoadingCreate(false)
                    return
                }
                newBankId = createBankResponse
                await get_banks(0, 50)
                setCreateAccountData({ ...createAccountData, ["bankId"]: newBankId })
            }

            const created = await create_f_account(
                createAccountData.name,
                createAccountData.last_four_digits,
                parseInt(createAccountData.accountType),
                parseInt(newBankId),
                parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount)),
                email_id
            )

            if (created === 201) {
                setIsFailed(false)
                get_user_accounts(0, 20)
                setLoadingCreate(false)
                setAccCreated(true)
                setAlert("Cuenta Adicionada con exito!!", true, "", "", false)

            } else {
                setIsFailed(true)
                setLoadingCreate(false)
                if (created === 409) {
                    setAlert("Está cuenta ya existe!", false, "text-white", "bg-red-500", 4000)
                } else {
                    setAlert("Algo salió mal la cuenta no fue creada, intenta de nuevo!", false, "text-white", "bg-red-500", 4000)
                }
            }

        } else {
            setLoadingCreate(false)
        }
    }

    const handleReturnToForm = () => {
        setOpenCreateBox(false)
        setAccCreated(false)
        setCreateAccountData(
            {
                name: '',
                last_four_digits: '',
                accountType: 1,
                bankId: '', // se elige al volver a abrir el diálogo (defaultBankId)
                initia_balance_amount: '$0',
                automated: true,
                gmailPersonalEmail: '',
            }
        )
        setTimeout(() => {
            setAlert("---", true, "", "", 100)
        }, 50)

    };


    useEffect(() => {

        if (automatedEmails) {
            // Aquí puedes realizar alguna acción cuando se abra el popover
            setCreateAccountData((prevData) => ({
                ...prevData,
                gmailPersonalEmail: automatedEmails[0],
            }));
        }
        // Aquí puedes realizar alguna acción cuando se abra el popover
        //console.log("auto:",automatedEmails);

    }, [openCreateBox]);

    /* useEffect(() => {
          if (createAccountData) {
            // Aquí puedes realizar alguna acción cuando se abra el popover
            console.log(createAccountData);
          }
        }, [createAccountData]); */


    return (
        <Transition show={openCreateBox} as={Fragment}>
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
                                <div className="px-6 py-6 sm:px-8 sm:py-8">
                                    {loadingCreate ?
                                        <div className="h-auto">
                                            {/* card */}
                                            <div className="flex justify-center items-center mb-3">
                                                <AccCard
                                                    name={createAccountData.name}
                                                    accountTypesOptions={accountTypesOptions}
                                                    accountType={createAccountData.accountType}
                                                    banks={banks}
                                                    bankId={createAccountData.bankId}
                                                    initia_balance_amount={parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount))}
                                                    last_four_digits={createAccountData.last_four_digits}
                                                />
                                            </div>
                                            <div>
                                                <div className='flex justify-center items-center'>
                                                    <ThreeDots
                                                        height="70"
                                                        width="70"
                                                        color="#5266EB"
                                                        ariaLabel="loading"
                                                    />
                                                </div>
                                                <h4 className="pb-5 text-xl text-center">
                                                    Espera un momento, Estamos creando tu producto...
                                                </h4>
                                            </div>
                                        </div>
                                        :
                                        <>
                                            {accCreated ?
                                                <>
                                                    {/* titulo y cerrar */}
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            Vincular Producto
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
                                                    <div className="flex flex-col justify-center items-center">
                                                        {/* titulo y cerrar */}
                                                        <Alert2 />
                                                        <button
                                                            onClick={() => handleReturnToForm()}
                                                            className='rounded-lg  w-10 shadow-sm shadow-zinc-400 h-10 flex justify-center items-center border border-zinc-700 hover:bg-zinc-300'>
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                                                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </>
                                                :
                                                <>
                                                    {/* vista normal */}
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                                            Vincular Producto
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
                                                    {/* card */}
                                                    <div className="flex justify-center items-center mb-3">
                                                        <AccCard
                                                            name={createAccountData.name}
                                                            accountTypesOptions={accountTypesOptions}
                                                            accountType={createAccountData.accountType}
                                                            banks={banks}
                                                            bankId={createAccountData.bankId}
                                                            initia_balance_amount={parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount))}
                                                            lastFourDigits={createAccountData.last_four_digits}
                                                        />
                                                    </div>
                                                    <div className="border-b border-gray-300 mb-4">
                                                    </div>

                                                    <div className="mb-2 rounded-md w-full overflow-hidden">
                                                        <Alert />
                                                    </div>


                                                    {/* FORMULARIO */}
                                                    <form className="flex flex-col">


                                                        <EditCreateFinAccountForm
                                                            createAccountData={createAccountData}
                                                            setCreateAccountData={setCreateAccountData}
                                                            onChangeCreate={onChangeCreate}
                                                            banks={banks}
                                                            accountTypesOptions={accountTypesOptions}
                                                            automatedEmails={automatedEmails}

                                                        />

                                                        <div className="flex justify-end gap-2 mt-2">

                                                            <button
                                                                onClick={onSubmitCreate}
                                                                className="bg-[#5266EB] text-white px-4 py-2 rounded-lg hover:bg-blue-600 w-28"
                                                            >
                                                                Crear
                                                            </button>



                                                        </div>

                                                    </form>
                                                </>
                                            }
                                        </>
                                    }
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
    banks: state.CashFlow.banks.items,
    accountTypesOptions: state.CashFlow.account_types,
    automatedEmails: state.Conexions.automated_emails.emails

})

export default connect(mapStateToProps, {
    get_user_accounts,
    create_f_account,
    setAlert,
    create_personal_bank,
    get_banks
})(AccountCreate)
