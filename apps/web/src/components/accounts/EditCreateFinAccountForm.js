
import { capitalizeWords } from "../helpers";
import { useEffect, useState } from 'react';
import DropDownEmails from "./DropDownEmails";
import DropDownBanks from "./DropDownBanks";
import InputMoneyInt2Decs from "../InputMoneyInt2Decs";

const EditCreateFinAccountForm = ({
    createAccountData,
    setCreateAccountData,
    onChangeCreate,
    banks,
    accountTypesOptions,
    automatedEmails,
    contexWindow
}) => {

    const {
        name,
        last_four_digits,
        bankId,
        accountType,
        initia_balance_amount,
        automated,
        gmailPersonalEmail
    } = createAccountData;

    const [bankAutomated, setBankAutomated] = useState(true);
    //const [activeTooltip, setActiveTooltip] = useState(null);
    const [emailSelected, setEmailSelected] = useState(createAccountData.gmailPersonalEmail || "");


    useEffect(() => {
        // Check if the bankId is set and if the bank is automated

        if (bankId && banks) {
            const selectedBank = banks.find(bank => bank.id === parseInt(bankId));
            if (selectedBank && selectedBank.is_automated) {
                setBankAutomated(selectedBank.is_automated);
                setCreateAccountData({
                    ...createAccountData,
                    automated: true
                });
            } else {
                setCreateAccountData({
                    ...createAccountData,
                    automated: false
                });
                setBankAutomated(false); // If no bank is found, set to false
            }

        }

    }, [bankId]);


    useEffect(() => {
        setCreateAccountData({
            ...createAccountData,
            gmailPersonalEmail: emailSelected
        });

        console.log(emailSelected)

    }, [emailSelected]);

    /* useEffect (() => {
        console.log("createAccountData", createAccountData);
        
    }, [createAccountData]);  */




    return (

        <div className={`grid gap-4 mb-4  ${contexWindow === 'onboarding' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {/* Tipo */}
            <div>
                <label for="accountType" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Tipo de Producto</label>
                <select
                    id="accountType"
                    name="accountType"
                    value={createAccountData.accountType}
                    onChange={e => onChangeCreate(e)}
                    required
                    class="bg-gray-50 p-1 md:p-2.5 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500">
                    {accountTypesOptions.items && accountTypesOptions.items.map((accountT, index) => (
                        <option key={accountT.id} value={accountT.id}>
                            {accountT.name}
                        </option>

                    ))}
                </select>
            </div>
            {/* Banco */}
            <div>
                <label for="bankId" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Banco</label>
                <DropDownBanks
                    options={banks}
                    selected={createAccountData.bankId}
                    onChange={e => onChangeCreate(e)}
                    placeholder='Seleccciona un banco'
                />
            </div>

            {/* Nombre */}

            {contexWindow !== 'onboarding' && (
                <div class="sm:col-span-2">
                    <label for="name" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Nombre de la cuenta</label>
                    <input
                        type="text"
                        name="name"
                        id="name"
                        value={name}
                        onChange={e => onChangeCreate(e)}
                        class="bg-gray-50 pl-2 p-1 md:p-2.5 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                        placeholder="Escribe el nombre con el que identificas esta cuenta."
                        required />
                </div>
            )}

            {/* digitos */}
            <div>
                <label for="lastFourDigits" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Ultimos cuatro dígitos de la cuenta</label>
                <input
                    type="text"
                    name="last_four_digits"
                    id="lastFourDigits"
                    value={last_four_digits}
                    onChange={e => onChangeCreate(e)}
                    class="bg-gray-50 pl-2 p-1 md:p-2.5 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                    placeholder={last_four_digits ? last_four_digits : "1234"}
                    minlength="4"
                    maxlength="4"
                    required />
            </div>

            {/* monto inicial */}
            {contexWindow !== 'onboarding' && (
                <div>
                    <label for="initia_balance_amount" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">
                        {accountType === '4' ?
                            <>Deuda Inicial</>
                            :
                            <>Monto Inicial</>
                        }
                    </label>
                    <InputMoneyInt2Decs
                        name="initia_balance_amount"
                        id="initia_balance_amount"
                        onChangeCreate={e => onChangeCreate(e)}
                        number={createAccountData.initia_balance_amount}
                    />
                    {/* <input 
                type="text" 
                name="initia_balance_amount" 
                id="initia_balance_amount" 
                value={initia_balance_amount}
                onChange={e=>onChangeCreate(e)}
                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"  
                required/> */}
                </div>
            )}

            {/* SECCION AUTOMATIZACION */}
            {contexWindow !== "onboarding" ?
                <>
                    {bankAutomated === true ?
                        <>
                            {/* automatizada */}
                            <div className="sm:col-span-2">
                                <label htmlFor="automated" className="inline-flex items-center cursor-pointer">
                                    <span className="mr-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                                        Lectura automatizada de Transacciones?
                                    </span>

                                    <input
                                        type="checkbox"
                                        id="automated"
                                        name="automated"
                                        checked={automated}
                                        onChange={e => onChangeCreate(e)}
                                        className="sr-only peer"
                                    />

                                    <div className="relative w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800">
                                        <span
                                            className={`absolute top-[2px] w-5 h-5 bg-white rounded-full transition-all duration-300 ${automated ? 'right-[2px]' : 'left-[2px]'}`}></span>
                                    </div>
                                </label>
                            </div>

                            <div className={`${automated === true ? 'sm:col-span-2' : 'hidden'}`}>
                                <label for="gmailPersonalEmail" class="block mb-0.5 md:mb-2 text-xs font-medium text-gray-900 dark:text-white">Correo Transacciones</label>
                                <DropDownEmails
                                    options={automatedEmails}
                                    selected={createAccountData.gmailPersonalEmail}
                                    setValueEmail={setEmailSelected}
                                />
                            </div>



                        </> :
                        <div className="sm:col-span-2">
                            <span className="text-gray-600">
                                Este banco no permite la lectura automatizada de transacciones, por lo que deberás ingresar las transacciones manualmente.
                            </span>

                        </div>

                    }
                </> : <></>

            }

        </div>

    )
}


export default EditCreateFinAccountForm