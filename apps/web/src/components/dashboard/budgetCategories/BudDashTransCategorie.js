
import { useMemo } from 'react';
import { useEffect, useState, useRef } from "react";
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
import { get_user_transactions } from '../../../redux/actions/cashflow';
import { get_history_dash, get_history_category_by_month, get_expenses_report } from '../../../redux/actions/reports';
import { set_dash_category_activated } from '../../../redux/actions/reports';
//componentes
import { Emoji } from "emoji-picker-react";
import { formatCurrency, formatDate, findElmentById, deepEqual } from '../../helpers';
import TransactionDetail from '../../transactions/TransactionDetail2'
import { parseDatetimetoDateStrFormat } from '../../helpers';
import CreateTransaction from '../../transactions/CreateTransaction';
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';

// A placeholder for your transaction icon component
const TransactionIcon = ({ expense }) => (
  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0 mr-4 flex items-center justify-center transition-colors duration-300">
    {/* You can add logic here to show different icons based on type */}
    {expense ?
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" class="size-5">
        <path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 0 1 1.06 0l13.72 13.72V8.25a.75.75 0 0 1 1.5 0V19.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1 0-1.5h9.44L3.97 5.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"></path>
      </svg>
      :
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16a34a" class="size-5">
        <path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clip-rule="evenodd"></path>
      </svg>
    }
  </div>
);

const BudDashTransCategorie = ({
  //states
  category_activated,
  category_transactions,
  current_Month,
  current_Year,
  //actions
  update_transaction_local,
  update_transaction,
  get_user_transactions,
  get_history_dash,
  get_history_category_by_month,
  get_expenses_report,
  set_dash_category_activated,
  expenses_report,
  // Props passed from parent
}) => {
  const groupedTransactions = useMemo(() => {
    if (!Array.isArray(category_transactions)) {
      return {};
    }

    const groups = category_transactions.reduce((acc, tx) => {
      const dateKey = tx.date.split(' ')[0];
      (acc[dateKey] = acc[dateKey] || []).push(tx);
      return acc;
    }, {});

    // The Object.keys will be sorted chronologically by default for YYYY-MM-DD format,
    // but we want descending order, so we reverse it.
    const sortedDates = Object.keys(groups).sort().reverse();

    return { groups, sortedDates };
  }, [category_transactions, category_activated]);


  //transaction detail state
  //INFOR POR DETAIL MODAL
  const [detailInfo, setDetailInfo] = useState(null)
  const [openTransDetail, setOpenTransDetail] = useState(false)

  const handleOpenTransDetail = async (transactionId) => {
    const selectedTransaction = findElmentById(category_transactions, transactionId)

    setDetailInfo(selectedTransaction)
    // Create a snapshot of the original data to compare against on close
    setOriginalDetailInfo(selectedTransaction);
    setOpenTransDetail(true);
    if ((selectedTransaction.checked === false) || (selectedTransaction.should_verify === true)) {
      // Update database
      const updateResponse = await update_transaction(
        transactionId,
        selectedTransaction.category?.id,
        selectedTransaction.account?.id,
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


  const [originalDetailInfo, setOriginalDetailInfo] = useState(null);

  const handleCloseTransDetail = async () => {
    setDetailInfo(null);
    setOpenTransDetail(false);
    setOriginalDetailInfo(null);
  }

  const handleChangeCategory = (newCategoryData) => {
    if (newCategoryData) {
      set_dash_category_activated(newCategoryData);
      setDetailInfo(null)
      setOpenTransDetail(false);
    }
  }

  // CREATE TRANSACTION POPUP
  const [openCreatePopUp, SetOpenCreatePopUp] = useState(false)
  const handleOpenCreatePopUp = () => {
    SetOpenCreatePopUp(true);
  }

  const handleCloseCreatePopUp = async () => {
    SetOpenCreatePopUp(false);
    // Refetch data to ensure new transactions are shown
    const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
    get_history_dash(date_filter);
    get_history_category_by_month(category_activated?.category_id, date_filter);
    let dateString = `${current_Year}-${current_Month.toString().padStart(2, '0')}-01`
    get_expenses_report(dateString)
  }


  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md transition-colors duration-300">

      {category_activated && (
        <>
          <div className="flex items-center">
            <div className="w-full">
              <h2 className='flex flex-row justify-start items-center mb-2'>
                {category_activated.emoji && category_activated.emoji !== "" && (
                  <Emoji unified={category_activated.emoji.toLowerCase()} emojiStyle="apple" size={20} />
                )}
                <span className='pl-2 text-lg font-semibold text-gray-700 dark:text-gray-200 mb-1'>{category_activated.name}</span>
              </h2>
              <div className="flex items-center justify-between">
                <div className="flex items-center flex-col">
                  <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                    {formatCurrency(category_activated.value || category_activated.expenses || 0)}
                  </p>
                  <span className='pl-1 text-[8px] xl:text-[10px] w-full text-left text-gray-400 dark:text-gray-500'>de {formatCurrency(category_activated.budget)}</span>
                </div>

                <button
                  onClick={handleOpenCreatePopUp}
                  className="flex gap-2 items-center justify-between px-1.5 p-1 bg-[#5266EB] hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group"
                >
                  <span className="text-[12px] font-semibold">Agregar Trx.</span>
                  <div className="p-1 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                    <PlusIcon className="w-4 h-4 text-white" />
                  </div>
                </button>

              </div>
            </div>
          </div>


          <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-3 transition-colors duration-300">
            {category_transactions && category_transactions.length > 0 ?
              <div className="transactions-list-container pr-2 max-h-[250px] md:max-h-[361.5px] md:min-h-[361.5px] overflow-y-auto">
                {groupedTransactions.sortedDates && groupedTransactions.sortedDates.map(date => (
                  <section key={date} className="date-group mb-4" aria-labelledby={`date-${date}`}>
                    <h3 id={`date-${date}`} className="date-header text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 sticky top-0 bg-white dark:bg-gray-800 py-1 transition-colors duration-300">
                      {date}
                    </h3>
                    <ul className="transactions-list space-y-3">
                      {groupedTransactions.groups[date].map((tx) => (
                        <li key={tx.id} className="cursor-pointer transaction-item flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                          onClick={() => handleOpenTransDetail(tx.id)}
                        >
                          <div className="transaction-details flex items-center">
                            <TransactionIcon expense={tx.expense} />
                            <div>
                              <p className="description font-medium text-gray-800 dark:text-gray-200">{tx.description}</p>
                              <p className="status text-xs text-gray-500 dark:text-gray-400 capitalize">{tx.status}</p>
                            </div>
                          </div>
                          <div className="transaction-amount text-right">
                            <p className={`primary-amount font-semibold ${tx.expense ? 'text-gray-800 dark:text-gray-200' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(tx.amount)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              :
              <p className='text-gray-500 dark:text-gray-400 pt-4 md:h-[362px] md:min-h-[362px]'>Aún no hay transacciones en este periodo.</p>
            }

          </div>


        </>
      )}



      <TransactionDetail
        openTransDetail={openTransDetail}
        setOpenTransDetail={handleCloseTransDetail}
        detailInfo={detailInfo}
        setDetailInfo={setDetailInfo}
        currentFrontendPage={1}
        contextWindow="dashCategories"
      />

      <CreateTransaction
        openCreatePopUp={openCreatePopUp}
        SetOpenCreatePopUp={handleCloseCreatePopUp}
        currentFrontendPage={1}
        initialCategoryId={category_activated?.category_id}
      />





    </div>
  );
};

const mapStateToProps = state => ({
  category_transactions: state.Reports.transactions_category_activated,
  category_activated: state.Reports.category_activated,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
  expenses_report: state.Reports.expenses_report,

})

export default connect(mapStateToProps, {
  update_transaction_local,
  update_transaction,
  get_user_transactions,
  get_history_dash,
  get_history_category_by_month,
  get_expenses_report,
  set_dash_category_activated

})(BudDashTransCategorie)
