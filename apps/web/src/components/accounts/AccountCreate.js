import { useEffect, useState } from "react";

//components
import { ThreeDots } from 'react-loader-spinner';
import Alert from '../alert';
import Alert2 from "../alert2";
import AccCard from "./AccCard";
import EditCreateFinAccountForm from "./EditCreateFinAccountForm";
import { formatedCurrToNumber, findElmentById } from '../helpers';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
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
        currency: 'COP',
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
            currency: 'COP',
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
            setAlert('Los últimos dígitos de la cuenta deben ser solo números.', false, 'text-white', 'bg-red-500', 4000)
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
                email_id,
                createAccountData.currency
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
                currency: 'COP',
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


    const card = (
        <div className="flex justify-center">
            <AccCard
                name={createAccountData.name}
                accountTypesOptions={accountTypesOptions}
                accountType={createAccountData.accountType}
                banks={banks}
                bankId={createAccountData.bankId}
                initia_balance_amount={parseFloat(formatedCurrToNumber(createAccountData.initia_balance_amount))}
                currency={createAccountData.currency}
                lastFourDigits={createAccountData.last_four_digits}
            />
        </div>
    );

    // Estados: formulario → creando → creada. Al terminar, "Listo" cierra y limpia (handleReturnToForm).
    const footer = loadingCreate ? null : accCreated ? (
        <Button onClick={() => handleReturnToForm()}>Listo</Button>
    ) : (
        <>
            <Button variant="ghost" onClick={handleClosePopover}>Cancelar</Button>
            <Button type="submit" form="create-account-form">Crear cuenta</Button>
        </>
    );

    return (
        <Modal open={openCreateBox} onClose={handleClosePopover} title="Agregar cuenta" size="lg" footer={footer}>
            {loadingCreate ? (
                <div className="flex flex-col items-center gap-3 py-2" role="status">
                    {card}
                    <span className="text-topi-500">
                        <ThreeDots height="48" width="48" color="currentColor" ariaLabel="Creando la cuenta" />
                    </span>
                    <p className="text-sm text-ink-2 dark:text-gray-400">Estamos creando tu cuenta…</p>
                </div>
            ) : accCreated ? (
                <div className="flex flex-col items-center gap-3 py-2">
                    {card}
                    <Alert2 />
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {card}
                    <div className="rounded-2xl w-full overflow-hidden empty:hidden">
                        <Alert />
                    </div>
                    <form id="create-account-form" onSubmit={onSubmitCreate} noValidate>
                        <EditCreateFinAccountForm
                            createAccountData={createAccountData}
                            setCreateAccountData={setCreateAccountData}
                            onChangeCreate={onChangeCreate}
                            banks={banks}
                            accountTypesOptions={accountTypesOptions}
                            automatedEmails={automatedEmails}
                        />
                    </form>
                </div>
            )}
        </Modal>
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
