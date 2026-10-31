
import { useMemo } from 'react';
import { useEffect, useState, useRef } from "react";
import 'moment/locale/es';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import moment from 'moment';
import DatePicker from 'react-datepicker';
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
import { get_user_transactions } from '../../../redux/actions/cashflow';
import { set_init_date_account_activated, set_end_date_account_activated } from '../../../redux/actions/reports';
import { set_dash_account_activated, get_accounts_status_by_period, get_history_accounts_by_month } from '../../../redux/actions/reports';

//componentes
import { formatMoney, formatDate, findElmentById, formatToDateFilters, deepEqual } from '../../helpers';
import { parseDatetimetoDateStrFormat, accountReportGroup } from '../../helpers';
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
            const accounts_type = accountReportGroup(account_activated)
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
            <section aria-label="Movimientos de la cuenta" className='lg:h-full lg:flex lg:flex-col p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-md transition-colors duration-300'>
                <div className='flex items-start justify-between gap-2 pb-3 mb-1 border-b border-gray-100 dark:border-gray-700'>
                    <div>
                        <h3 className='text-sm font-semibold text-gray-900 dark:text-gray-100'>Movimientos</h3>
                        {iniDate_account_dash && endDate_account_dash && (
                            <p className='text-xs text-ink-2 dark:text-gray-400'>
                                {moment(iniDate_account_dash, 'YYYY-MM-DD').locale('es').format('D MMM')} – {moment(endDate_account_dash, 'YYYY-MM-DD').locale('es').format('D MMM YYYY')}
                                {Array.isArray(transactions_accounts_activated?.transactions) ? ` · ${transactions_accounts_activated.transactions.length}` : ''}
                            </p>
                        )}
                    </div>
                    <Button size="sm" icon={PlusIcon} onClick={() => handleOpenCreatePopUp()} aria-label="Agregar movimiento">
                        <span className="hidden sm:inline">Agregar</span>
                    </Button>
                </div>

                <div className='max-h-[360px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-contain'>
                    {(transactions_accounts_activated !== null) && groupedTransactions.sortedDates && groupedTransactions.sortedDates.map(date => (
                        <section key={date} aria-labelledby={`acc-date-${date}`}>
                            <h4 id={`acc-date-${date}`} className="sticky top-0 z-[1] px-1 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
                                {moment(date, 'YYYY-MM-DD').isValid() ? moment(date, 'YYYY-MM-DD').locale('es').format('dddd D [de] MMMM') : date}
                            </h4>
                            <ul>
                                {groupedTransactions.groups[date].map((tx) => {
                                    const transfer = !!tx.transfer_group_id;
                                    return (
                                        <li key={tx.id}>
                                            <button type="button" onClick={() => handleOpenTransDetail(tx.id)}
                                                className="w-full flex items-center gap-3 px-1 py-2 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                                                    {tx.category?.emoji ? <Emoji unified={(tx.category.emoji).toLowerCase()} emojiStyle="apple" size={16} /> : null}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tx.description}</span>
                                                    {tx.needs_counterpart
                                                        ? <span className="block text-xs text-status-warn-text dark:text-amber-300 truncate">Falta elegir la cuenta con que pagaste</span>
                                                        : <span className="block text-xs text-ink-2 dark:text-gray-400 truncate">{transfer ? 'Transferencia' : (tx.category?.name || '')}</span>}
                                                </span>
                                                <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${transfer ? 'text-gray-700 dark:text-gray-200' : tx.expense ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`}>
                                                    {transfer ? '' : tx.expense ? '−' : '+'}{formatMoney(tx.amount, tx.currency)}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                    {(transactions_accounts_activated === null || !transactions_accounts_activated.transactions || transactions_accounts_activated.transactions.length === 0) && (
                        <EmptyState compact icon={ArrowsRightLeftIcon} title="Sin movimientos en este periodo" description="Cambia el periodo o agrega un movimiento." />
                    )}
                </div>
            </section>
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
