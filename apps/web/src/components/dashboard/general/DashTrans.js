//react
import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from "react";
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
//componentes
import { Emoji } from "emoji-picker-react";
import { formatMoney, formatDate, findElmentById } from '../../helpers';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
import EmptyState from '../../ui/EmptyState';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import TransactionDetail from '../../transactions/TransactionDetail2'

const DashTrans = ({
  //actions
  update_transaction_local,
  update_transaction,
  //state
  transactions,

}) => {

  //INFOR POR DETAIL MODAL
  const [detailInfo, setDetailInfo] = useState(null)
  const [openTransDetail, setOpenTransDetail] = useState(false)
  //const userTransactions = useSelector(state => state.CashFlow.user_transactions)


  const handleOpenTransDetail = async (transactionId) => {
    console.log("Open detail for transaction ID:", transactionId);
    const selectedTransaction = findElmentById(transactions.items, transactionId)

    setDetailInfo(selectedTransaction)
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
        //update_transaction_local(transactionId, updatedTransaction, "dash");
      }
    }
  }

  const handleCloseTransDetail = () => {
    /* document.body.style.paddingRight = '0px';
    document.body.style.overflow = 'unset'; */
    setDetailInfo(null)
    setOpenTransDetail(false);
  }

  return (
    <>
      <div className="md:h-[300px] py-3 px-3 bg-white border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700 ">
        <div className='flex flex-row justify-between items-center text-sm font-medium pb-3 border-b border-gray-300 dark:border-gray-700 dark:text-gray-100'>
          <h2>Últimas Transacciones</h2>
          <Link to="transactions/" className="text-xs flex flex-row items-center font-medium text-blue-600 hover:underline dark:text-blue-400">
            <span>Ver todas</span>
            {/* <ChevronRightIcon className='w-4 h-4'/> */}
          </Link>

        </div>

        <div className='divide-y divide-gray-200 dark:divide-gray-700'>
          {transactions.items && transactions.items.slice(0, 6).map((transaction) => (
            <div
              key={transaction.id}
              onClick={() => handleOpenTransDetail(transaction.id)}
              className='py-1 flex flex-row hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200'>

              <div className="w-[10%] f-full pt-1 pr-2 rounded-full md:w-6 h-6 flex justify-center items-center">
                {transaction.category?.emoji && transaction.category.emoji !== "" && (
                  <Emoji unified={(transaction.category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                )}
              </div>

              <div className='w-[55%] pl-1 flex flex-col items-center justify-left text-xs'>
                <span className='w-full text-left truncate overflow-hidden dark:text-gray-200'>{(transaction.description)}</span>
                <span className='w-full text-left text-[10px] text-gray-600 dark:text-gray-400'>{formatDate(transaction.date)}</span>
              </div>
              <div className='w-[35%] flex flex-grow-0 items-center text-xs justify-end font-semibold'>
                {transaction.expense === false ?
                  <span className='text-[#16a34a] dark:text-[#22c55e] truncate'>
                    <FormatMoneyShowDecs
                      numb={transaction.amount}
                      currency={transaction.currency}
                      base={transaction.amount_base}
                      showDecimals={true}
                      intClass="text-[#16a34a] dark:text-[#22c55e] text-sm"
                      decClass="text-xs"
                    />
                  </span>
                  :
                  <span className='text-[#e11d48] dark:text-[#fb7185] truncate'>
                    <FormatMoneyShowDecs
                      numb={transaction.amount}
                      currency={transaction.currency}
                      base={transaction.amount_base}
                      showDecimals={true}
                      intClass="text-[#e11d48] dark:text-[#fb7185] text-sm"
                      decClass="text-xs"
                    />
                  </span>
                }
              </div>

            </div>
          ))}
          {!transactions.items || transactions.items.length === 0 ?
            <EmptyState compact icon={ArrowsRightLeftIcon} title="Aún no hay transacciones" description="Conecta tu correo o crea una desde Transacciones." /> : null
          }
        </div>

      </div>

      <TransactionDetail
        openTransDetail={openTransDetail}
        setOpenTransDetail={handleCloseTransDetail}
        detailInfo={detailInfo}
        setDetailInfo={setDetailInfo}
        currentFrontendPage={1}
        contextWindow={"dash"}
      />
    </>
  );
};

const mapStateToProps = state => ({
  transactions: state.CashFlow.user_transactions_dash,

})

export default connect(mapStateToProps, {
  update_transaction_local,
  update_transaction,
})(DashTrans)
