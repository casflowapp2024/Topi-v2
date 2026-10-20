import { useEffect, useState } from "react";
import { connect } from 'react-redux';
import { get_user_accounts, create_f_account, create_personal_bank, get_banks } from "../../redux/actions/cashflow";
import { get_automated_emails } from "../../redux/actions/conexions";
import { setAlert } from "../../redux/actions/alert";
import { ThreeDots } from 'react-loader-spinner';
import Alert from '../alert';
import AccCard from "../accounts/AccCard";
import EditCreateFinAccountForm from "../accounts/EditCreateFinAccountForm";
import { findElmentById, formatedCurrToNumber } from "../helpers";
import { CheckCircleIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';

const StepCreateAccount = ({
    onNext,
    onBack,
    //redux actions
    get_user_accounts,
    create_f_account,
    setAlert,
    create_personal_bank,
    get_banks,
    get_automated_emails,
    //redux state
    fin_account_done,
    banks,
    accountTypesOptions,
    automatedEmails,
}) => {

    const [loadingCreate, setLoadingCreate] = useState(false);
    const [accCreated, setAccCreated] = useState(false);
    const [isFailed, setIsFailed] = useState(false);
    const [createAccountData, setCreateAccountData] = useState({
        name: '',
        last_four_digits: '',
        accountType: 1,
        bankId: null,
        initia_balance_amount: 0,
        automated: true,
        gmailPersonalEmail: '',
    });

    const [nameAccount, setNameAccount] = useState()

    const onChangeCreate = (e) => {
        const { name, type, checked, value } = e.target;
        setCreateAccountData({
            ...createAccountData,
            [name]: type === "checkbox" ? checked : value
        });

        if ((name === "accountType") || (name === "bankId")) {
            if (name === "bankId") {
                let bankName = banks.find(bank => bank.id === parseInt(value))?.name;
                let accountTypeName = accountTypesOptions.items.find(accountType => accountType.id === parseInt(createAccountData.accountType))?.name;
                setNameAccount(`${accountTypeName} - ${bankName}`);
            }
            if (name === "accountType") {
                let accountTypeName = accountTypesOptions.items.find(accountType => accountType.id === parseInt(value))?.name;
                let bankName = banks.find(bank => bank.id === parseInt(createAccountData.bankId))?.name;
                setNameAccount(`${accountTypeName} - ${bankName}`);
            }
        }
    };

    useEffect(() => {
        get_automated_emails(0, 20);
    }, []);

    useEffect(() => {
        if (banks && banks.length === 0) {
            const selectedBank = banks.find(bank => bank.id === parseInt(createAccountData.bankId));
            if ((!createAccountData.automated) || (!selectedBank?.is_automated)) {
                setCreateAccountData((prevData) => ({
                    ...prevData,
                    automated: false,
                    gmailPersonalEmail: "",
                }));
            }
        }
    }, [createAccountData.automated, createAccountData.bankId, banks]);

    useEffect(() => {
        if (banks && banks.length > 0 && !createAccountData.bankId) {
            setCreateAccountData(prev => ({
                ...prev,
                bankId: banks[0].id
            }));
            let bankName = banks.find(bank => bank.id === parseInt(banks[0].id))?.name;
            let accountTypeName = accountTypesOptions.items.find(accountType => accountType.id === parseInt(accountTypesOptions.items[0].id))?.name;
            setNameAccount(`${accountTypeName} - ${bankName}`);
        }
    }, [banks]);

    useEffect(() => {
        if (automatedEmails && automatedEmails.emails) {
            setCreateAccountData((prevData) => ({
                ...prevData,
                gmailPersonalEmail: automatedEmails.emails[0],
            }));
        }
    }, [automatedEmails]);

    const verifyData = (id) => {
        if (parseInt(id) >= 0) {
            return true;
        } else {
            alert('Los Digitos de la cuenta deben ser números!!');
            return false;
        }
    };

    const onSubmitCreate = async (e) => {
        e.preventDefault();
        setLoadingCreate(true);

        const passData = verifyData(createAccountData.last_four_digits);

        if (passData === true) {

            let email_id = "";
            //retrieve first email id
            if (automatedEmails.emails) {
                let email = automatedEmails.emails[0];
                email_id = parseInt(email.id);
            } else {
                alert("No se ha vinculado correo para leer transacciones");
                setLoadingCreate(false);
                return;
            }

            let newBankId = createAccountData.bankId;
            // bank must be created first if it's new (logic from original, though original checked < 0)
            // Assuming standard bank selection for now.
            if (createAccountData.bankId < 0) {
                const newBank = findElmentById(banks, createAccountData.bankId);
                const createBankResponse = await create_personal_bank(newBank.name, "");
                if (createBankResponse === false) {
                    setAlert("Algo salio mal, el banco no fue creado, intenta de nuevo!", true, "text-white", "bg-red-500", 3000);
                    setLoadingCreate(false);
                    return;
                }
                newBankId = createBankResponse;
                await get_banks(0, 50);
                setCreateAccountData({ ...createAccountData, ["bankId"]: newBankId });
            }

            const created = await create_f_account(
                nameAccount,
                createAccountData.last_four_digits,
                parseInt(createAccountData.accountType),
                parseInt(newBankId),
                parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount)),
                email_id
            );

            if (created === 201) {
                setIsFailed(false);
                get_user_accounts(0, 20);
                setLoadingCreate(false);
                setAccCreated(true);
            } else {
                setIsFailed(true);
                setLoadingCreate(false);
                if (created === 409) {
                    setAlert("Está cuenta ya existe!", false, "text-white", "bg-red-500", 4000);
                } else {
                    setAlert("Algo salió mal la cuenta no fue creada, intenta de nuevo!", false, "text-white", "bg-red-500", 4000);
                }
            }
        } else {
            setLoadingCreate(false);
        }
    };


    useEffect(() => {
        if (nameAccount) {
            console.log("nameAccount", nameAccount);
        }
    }, [nameAccount]);

    return (
        <div className="flex flex-col gap-4">
            {accCreated || fin_account_done ? (
                <div className="flex flex-col items-center justify-center py-6 gap-4">
                    <CheckCircleIcon className="w-16 h-16 text-green-500" />
                    <p className="text-lg font-medium text-gray-900">¡Cuenta creada exitosamente!</p>
                    <p className="text-sm text-gray-500 text-center">
                        Ahora tus transacciones se asociarán a esta cuenta.
                    </p>
                    <button
                        onClick={onNext}
                        className="mt-4 flex items-center gap-2 bg-[#5266EB] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Siguiente <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-gray-600 text-sm text-justify mb-4">
                        Crea tu cuenta principal. Las transacciones que lleguen al correo vinculado en el paso anterior se asociarán a esta cuenta.
                    </p>

                    {loadingCreate ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <ThreeDots
                                height="70"
                                width="70"
                                color="#5266EB"
                                ariaLabel="loading"
                            />
                            <p className="mt-4 text-gray-600">Creando tu cuenta...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <div className="flex flex-col-reverse sm:flex-row gap-4 items-start w-full">
                                <div className="w-full mt-2 sm:mt-10 flex justify-center items-center">

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

                                <form className="flex flex-col w-full">
                                    <EditCreateFinAccountForm
                                        createAccountData={createAccountData}
                                        setCreateAccountData={setCreateAccountData}
                                        onChangeCreate={onChangeCreate}
                                        banks={banks}
                                        accountTypesOptions={accountTypesOptions}
                                        automatedEmails={automatedEmails?.emails}
                                        contexWindow="onboarding"
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={onSubmitCreate}
                                            className="bg-[#5266EB] text-white px-6 py-2 rounded-lg hover:bg-blue-600"
                                        >
                                            Crear Cuenta
                                        </button>
                                    </div>
                                </form>

                            </div>
                            {isFailed && (
                                <div className="w-full mt-2">
                                    <Alert />
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const mapStateToProps = state => ({
    fin_account_done: state.CashFlow.first_steps.bank,
    banks: state.CashFlow.banks.items,
    accountTypesOptions: state.CashFlow.account_types,
    automatedEmails: state.Conexions.automated_emails,

});

export default connect(mapStateToProps, {
    get_user_accounts,
    create_f_account,
    setAlert,
    get_automated_emails,
    create_personal_bank,
    get_banks,
})(StepCreateAccount);
