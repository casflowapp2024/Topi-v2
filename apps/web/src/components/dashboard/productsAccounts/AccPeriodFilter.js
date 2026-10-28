
import { useMemo } from 'react';
import { useEffect, useState, useRef } from "react";
import moment from 'moment';
import { RangeDateSelector } from '../../ui/RangeDateSelector.tsx';
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
import { get_user_transactions } from '../../../redux/actions/cashflow';
import { set_init_date_account_activated, set_end_date_account_activated, get_accounts_status_by_period } from '../../../redux/actions/reports';
//componentes
import AccSummaryCard from './AccSummaryCard';
import { formatMoney, formatDate, findElmentById } from '../../helpers';
import { parseDatetimetoDateStrFormat } from '../../helpers';
//ui
import { Emoji } from 'emoji-picker-react';

const AccPeriodFilter = ({


    //actions
    set_init_date_account_activated,
    set_end_date_account_activated,
    update_transaction_local,
    update_transaction,
    get_user_transactions,
    get_history_dash,
    get_history_category_by_month,
    get_accounts_status_by_period,
    //states
    current_Month,
    current_Year,
    user_accounts,
    account_activated,
    iniDate_account_dash,
    endDate_account_dash,

}) => {

    const handleChangeInidate = (date) => {
        set_init_date_account_activated(formatDate(date))
    };
    const handleChangeEndDate = (date) => {
        set_end_date_account_activated(formatDate(date))
    };

    useEffect(() => {
        //al cargar el componente, si no hay cuenta activada, activar la primera cuenta de la list
        let accounts_type
        if (!account_activated) {
            return
        }
        if (account_activated.type.id === 1 || account_activated.type.id === 2) {
            accounts_type = "savings"
        } else if (account_activated.type.id === 3) {
            accounts_type = "investments"
        } else if (account_activated.type.id === 4) {
            accounts_type = "credits"
        } else {
            return
        }
        get_accounts_status_by_period(iniDate_account_dash, endDate_account_dash, accounts_type, [account_activated.id]);

    }, [iniDate_account_dash, endDate_account_dash]);


    return (

        <div className='p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md transition-colors duration-300'>
            {/* CUENTA SELECCIONADA */}
            {/* <div className='flex flex-row items-center mb-4'>
                <div className='w-full flex flex-row justify-between items-center gap-2 bg-gray-100 px-3 py-1 rounded-md'>
                    <div className='flex flex-col items-start'>
                        <div className='font-medium'>{account_activated ? account_activated.name : '...'}</div>
                        <div className='text-sm'>***{account_activated ? account_activated.last_four_digits : '...'}</div>
                    </div>
                    <div className='font-bold'>{account_activated ? account_activated.bank.name : '...'}</div>
                </div>
            </div> */}

            {/* FILTRO PERIODO */}
            <div className='w-full'>
                <RangeDateSelector
                    value={{
                        from: iniDate_account_dash ? moment(iniDate_account_dash).toDate() : undefined,
                        to: endDate_account_dash ? moment(endDate_account_dash).toDate() : undefined
                    }}
                    onChange={(range) => {
                        if (range?.from) {
                            const newFrom = new Date(range.from);
                            newFrom.setHours(12, 0, 0, 0);
                            handleChangeInidate(newFrom);
                        }
                        if (range?.to) {
                            const newTo = new Date(range.to);
                            newTo.setHours(12, 0, 0, 0);
                            handleChangeEndDate(newTo);
                        }
                    }}
                    className="w-full"
                />
            </div>
        </div>

    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    account_activated: state.Reports.account_activated,
    iniDate_account_dash: state.Reports.iniDate_account_dash,
    endDate_account_dash: state.Reports.endDate_account_dash,
    account_activated_stats: state.Reports.account_activated_stats,
    transactions_accounts_activated: state.Reports.transactions_accounts_activated,


})

export default connect(mapStateToProps, {
    set_init_date_account_activated,
    set_end_date_account_activated,
    update_transaction_local,
    update_transaction,
    get_user_transactions,
    get_accounts_status_by_period,

})(AccPeriodFilter)
