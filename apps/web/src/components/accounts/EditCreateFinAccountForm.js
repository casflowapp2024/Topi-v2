
import { formatMoney, formatedCurrToNumber, getBaseCurrency, getCurrency } from "../helpers";
import { useEffect, useState } from 'react';
import DropDownEmails from "./DropDownEmails";
import DropDownBanks from "./DropDownBanks";
import InputMoneyInt2Decs from "../InputMoneyInt2Decs";
import CurrencySelect from "../ui/CurrencySelect";
import { fetch_fx_rate } from "../../redux/actions/fx";
import Field, { Input, Select } from "../ui/Field";
import { InformationCircleIcon } from "@heroicons/react/20/solid";

const LABEL = "text-sm font-medium text-gray-700 dark:text-gray-300";

const EditCreateFinAccountForm = ({
    createAccountData,
    setCreateAccountData,
    onChangeCreate,
    banks,
    accountTypesOptions,
    automatedEmails,
    contexWindow,
    currencyLocked = false, // la cuenta ya tiene movimientos
}) => {

    const {
        name,
        last_four_digits,
        bankId,
        accountType,
        initia_balance_amount,
        automated,
        gmailPersonalEmail,
        currency = 'COP',
    } = createAccountData;

    // equivalente del saldo inicial en la moneda base (tasa de hoy)
    const baseCurrency = getBaseCurrency();
    const [todayRate, setTodayRate] = useState(null);
    useEffect(() => {
        let active = true;
        setTodayRate(null);
        if (currency !== baseCurrency) {
            fetch_fx_rate(currency, baseCurrency).then(q => { if (active) setTodayRate(q?.rate ?? 'none'); });
        }
        return () => { active = false; };
    }, [currency, baseCurrency]);
    const initialAmount = Number(formatedCurrToNumber(String(initia_balance_amount ?? '')));

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


    }, [emailSelected]);

    /* useEffect (() => {
        console.log("createAccountData", createAccountData);
        
    }, [createAccountData]);  */




    return (

        <div className={`grid gap-4 ${contexWindow === 'onboarding' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {/* Tipo */}
            <Field label="Tipo de producto" id="accountType">
                <Select name="accountType" value={createAccountData.accountType} onChange={e => onChangeCreate(e)} required>
                    {accountTypesOptions.items && accountTypesOptions.items.map((accountT) => (
                        <option key={accountT.id} value={accountT.id}>
                            {accountT.name}
                        </option>
                    ))}
                </Select>
            </Field>
            {/* Banco */}
            <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Banco</span>
                <DropDownBanks
                    options={banks}
                    selected={createAccountData.bankId}
                    onChange={e => onChangeCreate(e)}
                    placeholder='Selecciona un banco'
                />
            </div>

            {/* Nombre */}
            {contexWindow !== 'onboarding' && (
                <Field label="Nombre de la cuenta" id="name" className="sm:col-span-2">
                    <Input type="text" name="name" value={name} onChange={e => onChangeCreate(e)}
                        placeholder="El nombre con el que identificas esta cuenta" required />
                </Field>
            )}

            {/* digitos */}
            <Field label="Últimos cuatro dígitos" id="lastFourDigits">
                <Input type="text" inputMode="numeric" name="last_four_digits" value={last_four_digits}
                    onChange={e => onChangeCreate(e)} placeholder={last_four_digits ? last_four_digits : "1234"}
                    minLength={4} maxLength={4} required />
            </Field>

            {/* moneda */}
            {contexWindow !== 'onboarding' && (
                <CurrencySelect
                    id="accountCurrency"
                    value={currency}
                    onChange={e => onChangeCreate({ target: { name: 'currency', value: e.target.value, type: 'select' } })}
                    locked={currencyLocked}
                />
            )}

            {/* monto inicial */}
            {contexWindow !== 'onboarding' && (
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>
                        {accountType === '4' ? 'Deuda inicial' : 'Monto inicial'}
                    </span>
                    <InputMoneyInt2Decs
                        name="initia_balance_amount"
                        id="initia_balance_amount"
                        onChangeCreate={e => onChangeCreate(e)}
                        number={createAccountData.initia_balance_amount}
                        currency={currency}
                        ariaLabel={accountType === '4' ? 'Deuda inicial' : 'Monto inicial'}
                    />
                    {currency !== baseCurrency && (
                        <p className="text-xs text-right text-ink-2 dark:text-gray-400" aria-live="polite">
                            {todayRate === null && 'Buscando la tasa de hoy…'}
                            {todayRate === 'none' && `Aún no hay tasa ${currency}→${baseCurrency}.`}
                            {todayRate && todayRate !== 'none' && (
                                <>≈ {formatMoney(initialAmount * Number(todayRate), baseCurrency)} con la tasa de hoy
                                    {' '}(1 {getCurrency(currency).symbol} = {formatMoney(todayRate, baseCurrency, { decimals: 2 })})</>
                            )}
                        </p>
                    )}
                </div>
            )}

            {/* SECCION AUTOMATIZACION */}
            {contexWindow !== "onboarding" ?
                <>
                    {bankAutomated === true ?
                        <>
                            {/* automatizada */}
                            <div className="sm:col-span-2">
                                <label htmlFor="automated" className="inline-flex items-center gap-3 cursor-pointer">
                                    <span className={LABEL}>
                                        ¿Leer sus transacciones del correo?
                                    </span>

                                    <input
                                        type="checkbox"
                                        id="automated"
                                        name="automated"
                                        checked={automated}
                                        onChange={e => onChangeCreate(e)}
                                        className="sr-only peer"
                                    />

                                    <div className="relative w-11 h-6 shrink-0 bg-gray-300 dark:bg-gray-600 rounded-full peer-checked:bg-topi-500 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-topi-500 peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-gray-900">
                                        <span
                                            className={`absolute top-[2px] w-5 h-5 bg-white rounded-full transition-all duration-300 ${automated ? 'right-[2px]' : 'left-[2px]'}`}></span>
                                    </div>
                                </label>
                            </div>

                            <div className={`${automated === true ? 'sm:col-span-2 flex flex-col gap-1.5' : 'hidden'}`}>
                                <span className={LABEL}>Correo donde llegan las notificaciones</span>
                                <DropDownEmails
                                    options={automatedEmails}
                                    selected={createAccountData.gmailPersonalEmail}
                                    setValueEmail={setEmailSelected}
                                />
                            </div>



                        </> :
                        <div className="sm:col-span-2 flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300">
                            <InformationCircleIcon className="w-5 h-5 shrink-0 text-ink-2 dark:text-gray-400" aria-hidden="true" />
                            <span>
                                Este banco no permite leer sus transacciones del correo: tendrás que registrarlas tú.
                            </span>

                        </div>

                    }
                </> : <></>

            }

        </div>

    )
}


export default EditCreateFinAccountForm