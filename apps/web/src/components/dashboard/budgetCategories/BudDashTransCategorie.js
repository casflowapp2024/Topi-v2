
import { useMemo } from 'react';
import { useEffect, useState, useRef } from "react";
//redux
import { connect } from 'react-redux'
import { update_transaction_local, update_transaction } from '../../../redux/actions/cashflow';
import { get_user_transactions } from '../../../redux/actions/cashflow';
import { get_history_dash, get_history_category_by_month, get_expenses_report } from '../../../redux/actions/reports';
import { set_dash_category_activated } from '../../../redux/actions/reports';
import { fetch_card_charges, fetch_installments } from '../../../redux/actions/creditCards';
import { installmentsNote, isNeutral, directionLabel, pairTransfers } from '../../transactions/transactionDays';
import TransferDirectionIcon from '../../transactions/TransferDirectionIcon';
//componentes
import { Emoji } from "emoji-picker-react";
import { formatMoney, formatDate, findElmentById, deepEqual, capitalizeWords } from '../../helpers';
import Money from '../../ui/Money';
import TransactionDetail from '../../transactions/TransactionDetail2'
import { parseDatetimetoDateStrFormat } from '../../helpers';
import CreateTransaction from '../../transactions/CreateTransaction';
import { PlusIcon } from '@heroicons/react/20/solid';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import moment from 'moment';
import 'moment/locale/es';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';

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
  active_report_tab,
  // Props passed from parent
}) => {
  // Los cargos de tarjeta no son transacciones: se calculan desde los cortes
  const isCharges = String(category_activated?.name || '').toLowerCase() === 'cargos de tarjeta';
  const [charges, setCharges] = useState([]);
  useEffect(() => {
    let active = true;
    setCharges([]);
    if (isCharges) {
      fetch_card_charges(`${current_Year}-${String(current_Month).padStart(2, '0')}`).then(list => { if (active) setCharges(list || []); });
    }
    return () => { active = false; };
  }, [isCharges, current_Month, current_Year]);

  // Cuotas de compras de meses anteriores: pesan aquí, pero su transacción está en el mes de la compra
  const categoryId = category_activated?.category_id;
  const showInstallments = Boolean(categoryId || active_report_tab === 'Expenses');
  const [installments, setInstallments] = useState([]);
  useEffect(() => {
    let active = true;
    setInstallments([]);
    if (showInstallments) {
      fetch_installments({ month: `${current_Year}-${String(current_Month).padStart(2, '0')}` })
        .then(list => { if (active) setInstallments((list || []).filter(i => !categoryId || i.category_id === categoryId)); });
    }
    return () => { active = false; };
  }, [showInstallments, categoryId, current_Month, current_Year]);

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
    if (category_activated?.category_id) get_history_category_by_month(category_activated.category_id, date_filter);
    let dateString = `${current_Year}-${current_Month.toString().padStart(2, '0')}-01`
    get_expenses_report(dateString)
  }


  const isIncome = active_report_tab !== 'Expenses';
  const monthName = new Date(current_Year, current_Month - 1, 1).toLocaleString('es-CO', { month: 'long' });
  const cat = category_activated;
  const catAmount = cat ? Math.abs(Number(cat.amount ?? cat.value ?? cat.expenses ?? 0)) : 0;
  const catBudget = cat ? Math.abs(Number(cat.budget || 0)) : 0;
  const prettyDate = (d) => {
    const m = moment(d, 'YYYY-MM-DD');
    return m.isValid() ? capitalizeWords(m.locale('es').format('dddd D [de] MMMM')) : d;
  };

  return (
    <section className="lg:h-full lg:flex lg:flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-md transition-colors duration-300" aria-label="Movimientos">
      <header className="px-4 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-700">
        <div className="min-w-0">
          {cat ? (
            <>
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {cat.emoji && <Emoji unified={cat.emoji.toLowerCase()} emojiStyle="apple" size={18} />}
                {capitalizeWords(cat.name)}
              </h2>
              <p className="text-sm text-ink-2 dark:text-gray-400">
                <b className="text-gray-900 dark:text-gray-100 tabular-nums">{formatMoney(catAmount)}</b>
                {catBudget > 0 && <> de {formatMoney(catBudget)}</>} en {monthName}
              </p>
            </>
          ) : (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{isIncome ? 'Ingresos' : 'Gastos'} de {monthName}</h2>
              <p className="text-xs text-ink-2 dark:text-gray-400">Elige una categoría para ver solo sus movimientos</p>
            </>
          )}
        </div>
        <Button size="icon" variant="ghost" icon={PlusIcon} onClick={handleOpenCreatePopUp} aria-label="Agregar transacción" title="Agregar transacción" className="shrink-0" />
      </header>

      <div className="px-2 py-2 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        {installments.length > 0 && (
          <section aria-label="Cuotas del mes" className="mb-2 px-2">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {installments.map(i => (
                <li key={`${i.transaction_id}-${i.number}`} className="py-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{i.description}</span>
                    <span className="text-xs text-ink-2 dark:text-gray-400 truncate">Cuota {i.number} de {i.total} · {i.account_name}</span>
                  </span>
                  <Money amount={i.amount} currency={i.currency} base={i.amount_base} sign="-" className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100" />
                </li>
              ))}
            </ul>
          </section>
        )}
        {charges.length > 0 && (
          <section aria-label="Cargos de tarjeta del mes" className="mb-2 px-2">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {charges.map(c => (
                <li key={`${c.account_id}-${c.statement_date}`} className="py-2 flex items-center justify-between gap-3">
                  <span className="min-w-0 flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.account_name}</span>
                    <span className="text-xs text-ink-2 dark:text-gray-400">Corte del {moment(c.statement_date).format('DD-MM')} · pago del {moment(c.charged_on).format('DD-MM')}</span>
                  </span>
                  <Money amount={c.amount} currency={c.currency} base={c.amount_base} sign="-" className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100" />
                </li>
              ))}
            </ul>
            <p className="pt-1 text-xs text-ink-2 dark:text-gray-400">
              Lo que pagaste por encima de lo registrado: intereses, cuota de manejo o compras que no llegaron por correo.
            </p>
          </section>
        )}
        {category_transactions && category_transactions.length > 0 ? (
          <div className="max-h-[300px] md:max-h-[380px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-contain">
            {groupedTransactions.sortedDates && groupedTransactions.sortedDates.map(date => (
              <section key={date} aria-labelledby={`date-${date}`}>
                <h3 id={`date-${date}`} className="sticky top-0 z-[1] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
                  {prettyDate(date)}
                </h3>
                <ul>
                  {pairTransfers(groupedTransactions.groups[date]).map((legs) => {
                    const row = (tx, follows = null) => {
                      const neutral = isNeutral(tx);
                      const repeated = follows && follows.description === tx.description;
                      const category = !cat && tx.category?.name && !(follows && follows.category?.name === tx.category?.name) ? capitalizeWords(tx.category.name) : '';
                      const detail = repeated ? category : (neutral ? [directionLabel(tx), category] : [category, tx.account?.name]).filter(Boolean).join(' · ');
                      return (
                        <button key={tx.id} type="button" onClick={() => handleOpenTransDetail(tx.id)}
                          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors">
                          <span className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                            {tx.category?.emoji ? <Emoji unified={tx.category.emoji.toLowerCase()} emojiStyle="apple" size={16} /> : null}
                          </span>
                          <span className="flex-1 min-w-0">
                            {/* La flecha ↙/↗ va antes de "Entra a / Sale de": en el subtítulo o, si repite la descripción, en el título */}
                            {repeated
                              ? <span className="flex items-center gap-1 min-w-0 text-sm text-ink-2 dark:text-gray-400"><TransferDirectionIcon tx={tx} className="w-3.5 h-3.5" /><span className="truncate">{directionLabel(tx)}</span></span>
                              : <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tx.description}</span>}
                            {detail && (
                              <span className="flex items-center gap-1 min-w-0 text-xs text-ink-2 dark:text-gray-400">
                                {neutral && !repeated && <TransferDirectionIcon tx={tx} className="w-3 h-3" />}
                                <span className="truncate">{detail}</span>
                              </span>
                            )}
                          </span>
                          <Money amount={tx.amount} currency={tx.currency} base={tx.amount_base} note={installmentsNote(tx)}
                            sign={tx.expense ? '−' : '+'}
                            className={`text-sm font-semibold tabular-nums ${neutral ? 'text-data-transfer dark:text-slate-300' : tx.expense ? 'text-money-out dark:text-money-out-dark' : 'text-money-in dark:text-money-in-dark'}`} />
                        </button>
                      );
                    };
                    // Las dos patas de una transferencia van seguidas (arriba la que entra), unidas por una barra gris a la izquierda
                    return legs.length === 1 ? <li key={legs[0].id}>{row(legs[0])}</li> : (
                      <li key={legs[0].id} className="relative" data-transfer-pair="">
                        <span aria-hidden="true" className="absolute left-0 inset-y-3 w-0.5 rounded-full bg-data-transfer/50 dark:bg-slate-500" />
                        {row(legs[0])}
                        {row(legs[1], legs[0])}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : charges.length > 0 || installments.length > 0 ? null : (
          <EmptyState compact icon={ArrowsRightLeftIcon}
            title={cat ? `Sin movimientos de ${capitalizeWords(cat.name)}` : 'Sin movimientos este mes'}
            description="Los que lleguen por correo aparecerán aquí; también puedes agregarlos." />
        )}
      </div>

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





    </section>
  );
};

const mapStateToProps = state => ({
  category_transactions: state.Reports.transactions_category_activated,
  category_activated: state.Reports.category_activated,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
  expenses_report: state.Reports.expenses_report,
  active_report_tab: state.UI.active_report_tab,

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
