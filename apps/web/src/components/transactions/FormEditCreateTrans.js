
import { useState, useRef, useEffect } from 'react'
import { formatDate, formatMoney, getBaseCurrency, parseDatetimetoDateStrFormat, parseDatetoDatetimeBrow } from "../../components/helpers";

import InputMoneyInt2Decs from '../InputMoneyInt2Decs';
import { SingleDateSelector } from '../ui/SingleDateSelector.tsx';
import DropDownCat from "./DropDownCat";

import { connect } from 'react-redux';


const FormEditCreateTrans = ({
    editCreateData,
    onChangeCreate,
    user_categories,
    user_accounts,
    date,
    setDate,
    //states
    bank_done

}) => {

    useEffect(() => {
        console.log("editCreateData Form: ", editCreateData);
        console.log("date:", date)
    }, [editCreateData]);

    return (
        <>
            {bank_done ?

                <>
                    <div class="grid pb-2 gap-4 mb-4 sm:grid-cols-2">
                        {/* Descripción */}
                        <div class="sm:col-span-2">

                            <label for="description" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Descripción</label>
                            <input
                                type="text"
                                name="description"
                                id="description"
                                value={editCreateData.description}
                                onChange={e => onChangeCreate(e)}
                                class="bg-gray-50 p-2 py-1 md:py-2 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
                                placeholder="Descripcion de la transacción"
                                required />
                        </div>
                        {/* categoría */}
                        <div>
                            <label for="category_id" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Categoría</label>
                            <DropDownCat
                                options={user_categories.items}
                                selected={editCreateData.category_id}
                                onChange={e => onChangeCreate(e)}
                                placeholder='Select an option'
                            />
                        </div>
                        {/* cuenta */}
                        <div>
                            <label for="account_id" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Cuenta</label>
                            <select
                                id="account_id"
                                name="account_id"
                                value={editCreateData.account_id}
                                onChange={e => onChangeCreate(e)}
                                required
                                class="bg-gray-50 p-2 py-1 md:py-2 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500">
                                {user_accounts.items && user_accounts.items.map((account, index) => (
                                    <option key={account.id} value={account.id}>
                                        {account.name} - ***{account.last_four_digits}{account.currency && account.currency !== getBaseCurrency() ? ` · ${account.currency}` : ''}
                                    </option>

                                ))}
                            </select>
                        </div>
                        {/* monto */}
                        <div>
                            <label for="amount" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Monto</label>

                            <InputMoneyInt2Decs
                                name="amount"
                                id="amount"
                                onChangeCreate={e => onChangeCreate(e)}
                                number={editCreateData.amount}
                                currency={(user_accounts.items || []).find(a => String(a.id) === String(editCreateData.account_id))?.currency}
                                ariaLabel="Monto"
                            />

                        </div>


                        {/* gasto ingreso */}
                        <div className="flex flex-col justify-center items-center">
                            <div class="h-[14px] block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white"></div>
                            <label class="inline-flex items-center cursor-pointer">
                                <input type="checkbox"
                                    id="expense"
                                    name="expense"
                                    value={editCreateData.expense}
                                    onChange={e => onChangeCreate(e)}
                                    class="sr-only peer" />
                                <span class="mr-3 text-sm font-medium text-gray-900 dark:text-gray-300">Gasto</span>
                                <div className={`relative w-11 h-6 ${editCreateData.expense ? 'bg-red-500' : 'bg-green-500'} rounded-full transition-colors peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800`}>
                                    <span
                                        className={`absolute top-[2px] w-5 h-5 bg-white rounded-full transition-all duration-300 ${editCreateData.expense ? 'left-[2px]' : 'right-[2px]'}`}></span>
                                </div>
                                <span class="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">Ingreso</span>
                            </label>
                        </div>
                        {/* date*/}
                        <div className="sm:col-span-2">
                            <label for="date" class="block mb-0.5 md:mb-2 text-sm font-medium text-gray-900 dark:text-white">Fecha</label>

                            <SingleDateSelector
                                value={date ? parseDatetoDatetimeBrow(date, "YYYY-MM-DD HH:mm:ss Z") : undefined}
                                onChange={(newDate) => {
                                    if (!newDate) return;
                                    const dateToStore = new Date(newDate.getTime());
                                    dateToStore.setHours(12, 0, 0, 0);
                                    setDate(parseDatetimetoDateStrFormat(dateToStore, "YYYY-MM-DD HH:mm:ss Z"));
                                }}
                                className="w-full"
                            />
                        </div>


                    </div>
                </> :
                <div className='flex flex-col py-4 justify-center items-center'>

                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-10">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>

                    <p className='text-justify'>
                        Para crear una transacción primero debes crear una producto como cuenta de banco o trajeta para asociar la transacción a esta.
                    </p>

                </div>


            }

        </>

    )
}




const mapStateToProps = state => ({
    bank_done: state.CashFlow.first_steps.bank,
})

export default connect(mapStateToProps, {


})(FormEditCreateTrans)
