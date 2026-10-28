
import { useMemo } from 'react';
import { useEffect, useState, useRef } from "react";
import moment from 'moment';
import DatePicker from 'react-datepicker';
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
import { get_user_transactions } from '../../../redux/actions/cashflow';
import { set_init_date_account_activated, set_end_date_account_activated } from '../../../redux/actions/reports';
import { set_dash_account_activated, get_accounts_status_by_period, get_history_accounts_by_month } from '../../../redux/actions/reports';

//componentes
import AccSummaryCard from './AccSummaryCard';
import { formatMoney, formatDate, findElmentById, formatToDateFilters, deepEqual } from '../../helpers';
import { parseDatetimetoDateStrFormat } from '../../helpers';
import TransactionDetail from '../../transactions/TransactionDetail2'
import CreateTransaction from '../../transactions/CreateTransaction';

//ui
import { Emoji } from 'emoji-picker-react';
import { PlusIcon } from '@heroicons/react/24/outline';

const AccTransPeriod = ({


    //actions
    update_transaction_local,
    update_transaction,
    get_user_transactions,
    set_dash_account_activated,
    get_accounts_status_by_period,
    get_history_accounts_by_month,

    //states
    account_activated,
    iniDate_account_dash,
    endDate_account_dash,
    transactions_accounts_activated,
    account_activated_stats,
    current_Month,
    current_Year,


}) => {

    //tRANSACCIONES DE LA cuenta EN EL PERIODO

    const [loadingTransactions, setLoadingTransactions] = useState(false);

    const buildTransactionParams = ({
        selectedAccounts,
        iniDate,
        endDate,
    }) => {

        const params = [];
        if (selectedAccounts && selectedAccounts.length > 0) params.push(`accounts=${selectedAccounts}`);
        if (iniDate) params.push(`init_date=${iniDate}`);
        if (endDate) params.push(`end_date=${endDate}`);

        return params.join("&");
    };

    const handleGetTransactions = async () => {
        if (account_activated && iniDate_account_dash && endDate_account_dash) {
            setLoadingTransactions(true)
            const filterParams = buildTransactionParams(
                {
                    selectedAccounts: account_activated ? [account_activated.id] : null,
                    iniDate: formatToDateFilters((iniDate_account_dash)),
                    endDate: formatToDateFilters((endDate_account_dash))
                }
            )
            const transResponse = await get_user_transactions(0, 100, filterParams, "accountsAnalysis")

            if (transResponse === true) {
                setLoadingTransactions(false)
            } else {
                setLoadingTransactions(false)
            }
        }
    }

    useEffect(() => {
        handleGetTransactions()
    }, [account_activated, iniDate_account_dash, endDate_account_dash]);

    //GROUPING BY DATE

    const groupedTransactions = useMemo(() => {

        const transactions = transactions_accounts_activated?.transactions;
        if (!Array.isArray(transactions)) {
            return {};
        }
        const groups = transactions.reduce((acc, tx) => {
            const dateKey = tx.date.split(' ')[0];
            (acc[dateKey] = acc[dateKey] || []).push(tx);
            return acc;
        }, {});
        // The Object.keys will be sorted chronologically by default for YYYY-MM-DD format,
        // but we want descending order, so we reverse it.
        const sortedDates = Object.keys(groups).sort().reverse();
        return { groups, sortedDates };

    }, [account_activated, transactions_accounts_activated]);


    //transaction detail state
    //INFOR POR DETAIL MODAL
    const [detailInfo, setDetailInfo] = useState(null)
    const [openTransDetail, setOpenTransDetail] = useState(false)

    const handleOpenTransDetail = async (transactionId) => {
        const selectedTransaction = findElmentById(transactions_accounts_activated.transactions, transactionId)

        setDetailInfo(selectedTransaction)
        // Create a snapshot of the original data to compare against on close
        setOriginalDetailInfo(selectedTransaction);
        setOpenTransDetail(true);
        if ((selectedTransaction.checked === false) || (selectedTransaction.should_verify === true)) {
            // Update database
            const updateResponse = await update_transaction(
                transactionId,
                selectedTransaction.category.id,
                selectedTransaction.account.id,
                selectedTransaction.description,
                selectedTransaction.expense,
                selectedTransaction.amount,
                selectedTransaction.date,
                true
            );
            // Update local state immediately
            if (updateResponse === true) {
                const updatedTransaction = {
                    ...selectedTransaction,
                    checked: true,
                    should_verify: false
                };
                //update_transaction_local(transactionId, updatedTransaction);
            }
        }
    }


    const [changeInfo, setChangeInfo] = useState(0);
    const [originalDetailInfo, setOriginalDetailInfo] = useState(null);

    // CREATE TRANSACTION POPUP
    const [openCreatePopUp, SetOpenCreatePopUp] = useState(false)
    const handleOpenCreatePopUp = () => {
        SetOpenCreatePopUp(true);
    }

    const handleCloseCreatePopUp = async () => {
        SetOpenCreatePopUp(false);
        // Refetch data to ensure new transactions are shown
        handleGetTransactions();

        // Also refresh account stats if needed
        if (account_activated) {
            let accounts_type
            if (account_activated.type.id === 1 || account_activated.type.id === 2) {
                accounts_type = "savings"
            } else if (account_activated.type.id === 3) {
                accounts_type = "investments"
            } else if (account_activated.type.id === 4) {
                accounts_type = "credits"
            } else {
                return
            }
            const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
            get_history_accounts_by_month(date_filter, account_activated?.id);
            get_accounts_status_by_period(iniDate_account_dash, endDate_account_dash, accounts_type, [account_activated.id]);
        }
    }


    const handleCloseTransDetail = async () => {
        setDetailInfo(null);
        setOpenTransDetail(false);
        setOriginalDetailInfo(null);
    }





    return (
        <>
            <div className='p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md transition-colors duration-300'>
                {/* TRANSACCIONES DE CUENTA EN EL PERIODO */}

                <div className='flex flex-row justify-between items-center pb-2 mb-2 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300'>

                    <div className='text-md font-bold text-gray-800 dark:text-gray-100'>Transacciones</div>

                    <button
                        onClick={() => handleOpenCreatePopUp()}
                        className="flex gap-2 items-center justify-between px-1.5 p-1 bg-[#5266EB] hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group"
                    >
                        <span className="text-[12px] font-semibold">Agregar Trx.</span>
                        <div className="p-1 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                            <PlusIcon className="w-4 h-4 text-white" />
                        </div>
                    </button>
                    {/* <button
                        onClick={() => handleOpenCreatePopUp()}
                        className="p-2 rounded-lg hover:bg-[#5266EB] hover:text-white transition-all duration-200">
                        <PlusIcon className="size-5" />
                    </button> */}
                </div>


                <div className='min-h-[282px] max-h-[282px] overflow-y-scroll'>
                    {(transactions_accounts_activated !== null) && groupedTransactions.sortedDates && groupedTransactions.sortedDates.map(date => (
                        <section key={date} className="l date-group mb-4" aria-labelledby={`date-${date}`}>
                            <div className="flex items-center justify-between">
                                <h3 id={`date-${date}`} className="date-header text-sm font-semibold text-gray-500 dark:text-gray-400 mb-0 sticky top-0 bg-white dark:bg-gray-800 py-1 transition-colors duration-300">
                                    {date}
                                </h3>
                            </div>
                            <ul className="transactions-list space-y-1 border-b border-gray-200 dark:border-gray-700 transition-colors duration-300">
                                {groupedTransactions.groups[date].map((tx) => (
                                    <li key={tx.id} className="cursor-pointer transaction-item hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150 flex flex-row justify-between items-center py-2"
                                        onClick={() => handleOpenTransDetail(tx.id)}
                                    >

                                        <div className='flex flex-row items-center'>
                                            <div className="w-[10%] f-full pt-1 pr-2 rounded-full md:w-8 h-8 flex justify-center items-center">
                                                {tx.category?.emoji && tx.category.emoji !== "" && (
                                                    <Emoji unified={(tx.category.emoji).toLowerCase()} emojiStyle="apple" size={18} />
                                                )}
                                            </div>
                                            <div className='text-sm font-medium text-gray-800 dark:text-gray-200'>{tx.description}</div>
                                        </div>

                                        <div className={`text-sm font-bold ${tx.expense === true ? 'text-red-600' : 'text-green-600'}`}>{formatMoney(tx.amount, tx.currency)}</div>

                                    </li>
                                ))}
                            </ul>
                        </section>


                    ))}
                    <div>
                        {transactions_accounts_activated === null || transactions_accounts_activated.transactions === null ? (
                            <p className="text-gray-500 pt-4 text-sm">Aún no hay transacciones en este periodo</p>
                        ) : <></>}
                    </div>
                </div>




            </div>
            <TransactionDetail
                openTransDetail={openTransDetail}
                setOpenTransDetail={handleCloseTransDetail}
                detailInfo={detailInfo}
                setDetailInfo={setDetailInfo}
                currentFrontendPage={1}
                contextWindow="dashAccounts"
            />
            <CreateTransaction
                openCreatePopUp={openCreatePopUp}
                SetOpenCreatePopUp={handleCloseCreatePopUp}
                currentFrontendPage={1}
                contextWindow="dashAccounts"
                initialAccountId={account_activated?.id}
            />


        </>
    );
};

const mapStateToProps = state => ({
    account_activated: state.Reports.account_activated,
    iniDate_account_dash: state.Reports.iniDate_account_dash,
    endDate_account_dash: state.Reports.endDate_account_dash,
    transactions_accounts_activated: state.Reports.transactions_accounts_activated,
    account_activated_stats: state.Reports.account_activated_stats,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,

})

export default connect(mapStateToProps, {
    update_transaction_local,
    update_transaction,
    get_user_transactions,
    set_dash_account_activated,
    get_accounts_status_by_period,
    get_history_accounts_by_month,


})(AccTransPeriod)
