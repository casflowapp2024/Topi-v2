
import { useMemo } from 'react';
import { useEffect, useState, useRef } from "react";
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
import { get_user_transactions } from '../../../redux/actions/cashflow';
import { get_history_dash, get_history_category_by_month } from '../../../redux/actions/reports';
import { set_dash_account_activated } from '../../../redux/actions/reports';
//componentes
import { Emoji } from "emoji-picker-react";
import { formatMoney, formatDate, findElmentById } from '../../helpers';
import TransactionDetail from '../../transactions/TransactionDetail2'
import { parseDatetimetoDateStrFormat } from '../../helpers';
//ui
import { CreditCardIcon, BanknotesIcon, PresentationChartLineIcon, DocumentCurrencyDollarIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';


const AccbyTypeDash = ({
    //states
    current_Month,
    current_Year,
    user_accounts,
    account_activated,
    //actions
    update_transaction_local,
    update_transaction,
    get_user_transactions,
    get_history_dash,
    get_history_category_by_month,
    set_dash_account_activated,
    //new props
    onOpenDetail,
    onOpenCreate

}) => {

    //grouped accounts by type
    const groupedAccounts = useMemo(() => {
        if (!Array.isArray(user_accounts.items)) {
            return {};
        }

        const groups = user_accounts.items.reduce((acc, account) => {
            const typeKey = parseInt(account.type.id);
            (acc[typeKey] = acc[typeKey] || []).push(account);
            return acc;
        }, {});

        // The Object.keys will be sorted chronologically by default for YYYY-MM-DD format,
        // but we want descending order, so we reverse it.
        const sortedAccounts = Object.keys(groups).sort();

        return { groups, sortedAccounts };
    }, [user_accounts.items]);

    const comps_by_type = {
        1: {
            name: "Cuentas de Ahorros",
            color: "bg-blue-100 text-blue-800",
            icon: <BanknotesIcon className="size-6 text-blue-600 dark:text-blue-400" />
        },
        2: {
            name: "Cuentas Corrientes",
            color: "bg-blue-100 text-blue-800",
            icon: <DocumentCurrencyDollarIcon className="size-6 text-blue-600 dark:text-blue-400" />
        },
        3: {
            name: "Cuentas de Inversión",
            color: "bg-blue-100 text-blue-800",
            icon: <PresentationChartLineIcon className="size-6 text-blue-600 dark:text-blue-400" />
        },
        4: {
            name: "Tarjetas de Credito",
            color: "bg-blue-100 text-blue-800",
            icon: <CreditCardIcon className="size-6 text-blue-600 dark:text-blue-400" />
        }
    };


    //transaction detail state

    return (
        <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md transition-colors duration-300">
            <div className="px-1 flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Mis Cuentas</h2>

                <button
                    onClick={onOpenCreate}
                    className="w-1/2 flex items-center justify-between px-3 p-1 bg-[#5266EB] hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group"
                >
                    <span className="text-[12px] font-semibold">Agregar</span>
                    <div className="p-1 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                        <PlusIcon className="w-4 h-4 text-white" />
                    </div>
                </button>
                {/* <button
                    onClick={onOpenCreate}
                    className="p-2 rounded-xl hover:bg-[#5266EB] hover:text-white transition-all duration-200">
                    <PlusIcon className="size-5" />
                </button> */}
            </div>

            {user_accounts.items ? (

                <>
                    <div className="transactions-list-container h-[200px] md:h-[275px] overflow-y-auto hide-scrollbar pr-2">
                        {groupedAccounts.sortedAccounts && groupedAccounts.sortedAccounts.map(type => (
                            <section key={type} className="type-group mb-4" aria-labelledby={`type-${type}`}>
                                <div className='flex flex-row justify-start items-center gap-2 mb-2'>
                                    <div>
                                        {comps_by_type[type].icon}
                                    </div>
                                    <h3 id={`type-${type}`} className="text-md font-semibold text-gray-600 dark:text-gray-300 sticky top-0 bg-white dark:bg-gray-800 transition-colors duration-300">
                                        {comps_by_type[type].name}
                                    </h3>
                                </div>
                                <ul className="transactions-list space-y-3">
                                    {groupedAccounts.groups[type].map((account) => (
                                        <li key={account.id}
                                            className={`${account.id === account_activated?.id ? 'bg-[#5266EB] text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150'} cursor-pointer text-gray-900 dark:text-gray-100 transaction-item flex items-center justify-between p-2 rounded-lg `}
                                            onClick={() => set_dash_account_activated(account)}
                                        >

                                            <div className="flex-1 min-w-0 ms-4">
                                                <p className="text-sm font-medium  truncate dark:text-white">
                                                    {account.name}
                                                </p>
                                                <p className="text-sm  truncate dark:text-gray-400">
                                                    ****{account.last_four_digits}
                                                </p>
                                            </div>
                                            <div className="flex flex-row items-center gap-3">
                                                <div className="flex flex-col items-end text-sm font-semibold dark:text-white">
                                                    <span className="text-right">{account.bank.name}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onOpenDetail(account.id);
                                                    }}
                                                    className={`p-1 rounded-md transition-colors ${account.id === account_activated?.id ? 'hover:bg-blue-400 text-white' : 'hover:bg-gray-200 text-gray-500'}`}>
                                                    <ChevronDownIcon className="size-4" />
                                                </button>
                                            </div>

                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>

                </>

            ) : (
                <p className='text-gray-500'>Cargando...</p>
            )}

        </div>
    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    account_activated: state.Reports.account_activated,

})

export default connect(mapStateToProps, {
    update_transaction_local,
    update_transaction,
    get_user_transactions,
    get_history_dash,
    get_history_category_by_month,
    set_dash_account_activated

})(AccbyTypeDash)
