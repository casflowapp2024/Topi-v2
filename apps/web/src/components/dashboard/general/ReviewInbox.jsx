import { useCallback, useEffect, useMemo, useState } from 'react';
import moment from 'moment-timezone';
import { connect } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Emoji } from 'emoji-picker-react';
import {
  ArrowRightIcon, CheckIcon, ChevronRightIcon, CreditCardIcon, ExclamationTriangleIcon,
} from '@heroicons/react/20/solid';
import { CheckCircleIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
//redux
import {
  change_transactions_filter, create_category, fetch_review_transactions, filtersFromState,
  get_user_categories, update_transaction,
} from '../../../redux/actions/cashflow';
import { get_expenses_report, get_financial_report, get_history_dash } from '../../../redux/actions/reports';
import { get_net_worth } from '../../../redux/actions/fx';
import { setAlert } from '../../../redux/actions/alert';
import { dismiss_transfer_candidate, fetch_transfer_candidates, link_transfer } from '../../../redux/actions/transfers';
import { fetch_credit_cards, fetch_installment_reviews, save_installments } from '../../../redux/actions/creditCards';
//components
import Button from '../../ui/Button';
import Card, { CardHeader } from '../../ui/Card';
import EmptyState from '../../ui/EmptyState';
import Money from '../../ui/Money';
import Sheet from '../../ui/Sheet';
import { SkeletonRows } from '../../ui/Skeleton';
import CardReconcile from '../productsAccounts/CardReconcile';
import DropDownCat from '../../transactions/DropDownCat';
import TransactionDetail from '../../transactions/TransactionDetail2';
import TransferLinkSection from '../../transactions/TransferLinkSection';
import { capitalizeWords, cardsDueSoon, findElmentById, formatMoney, isCreditAccount, isOpenAccount } from '../../helpers';

const MIN_LOADED = 5;   // con menos en memoria se pide la siguiente tanda
const MAX_DOTS = 5;
const PAGE = 10;
const INSTALLMENT_OPTIONS = [1, 3, 6, 12];
const LEAVE_MS = 200;

// Cola de la bandeja: uno de cada grupo por vuelta, así ningún tipo queda de último
export const buildQueue = (groups) => {
  const out = [];
  for (let i = 0; groups.some(g => i < g.length); i += 1) {
    groups.forEach(g => { if (i < g.length) out.push(g[i]); });
  }
  return out;
};

// Aviso del estado vacío: el pago de tarjeta más cercano, si hay. No cuenta como pendiente.
export const nextPaymentNotice = (cards) => {
  const [next] = cardsDueSoon(cards).sort((a, b) => moment(a.due_date) - moment(b.due_date));
  if (!next) return null;
  const overdue = moment(next.due_date).isBefore(moment().startOf('day'));
  return `${next.name}: ${overdue ? 'quedó pendiente' : 'paga'} ≈ ${formatMoney(next.pending_statement, next.currency)}${overdue ? '' : ` antes del ${moment(next.due_date).format('DD-MM')}`}`;
};

// Al ligar una pareja, las otras con alguna de sus transacciones dejan de ser posibles
const pairKey = (c) => `${c.out_transaction_id}-${c.in_transaction_id}`;
const sharesLeg = (a, b) => [a.out_transaction_id, a.in_transaction_id].some(id => id === b.out_transaction_id || id === b.in_transaction_id);

const Row = ({ leaving, children }) => (
  <div className={`flex flex-col gap-2 transition-opacity duration-200 motion-reduce:transition-none ${leaving ? 'opacity-0' : ''}`}>
    {children}
  </div>
);

const TxSummary = ({ tx, onOpen }) => (
  <button type="button" onClick={onOpen} className="w-full flex items-start gap-2 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
    <span className="w-5 h-5 shrink-0 flex items-center justify-center">
      {tx.category?.emoji && <Emoji unified={tx.category.emoji.toLowerCase()} emojiStyle="apple" size={16} />}
    </span>
    <span className="flex-1 min-w-0 flex flex-col">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tx.description}</span>
      <span className="text-xs text-ink-2 dark:text-gray-400 truncate">{capitalizeWords(tx.category?.name)} · {tx.account?.name}</span>
    </span>
    <Money amount={tx.amount} currency={tx.currency} base={tx.amount_base} sign={tx.expense ? '-' : '+'}
      className={`text-sm font-semibold tabular-nums ${tx.expense ? 'text-gray-900 dark:text-gray-100' : 'text-money-in dark:text-money-in-dark'}`} />
  </button>
);

/**
 * Bandeja "Por revisar": la acción principal del inicio. Reúne lo que el worker no pudo resolver
 * solo: transacciones por confirmar, pagos de tarjeta sin la cuenta de origen, posibles
 * transferencias y tarjetas con pagos de más. Muestra uno en móvil y dos en PC: al resolver uno sale
 * el siguiente.
 * El contador solo cuenta lo que hay que resolver: el aviso de pago aparece cuando ya no queda nada.
 */
const ReviewInbox = ({
  user_categories, user_accounts, net_worth, first_steps, trans_filters_activated, current_Month, current_Year,
  update_transaction, create_category, get_user_categories, change_transactions_filter, setAlert,
  get_financial_report, get_history_dash, get_expenses_report, get_net_worth,
}) => {
  const navigate = useNavigate();
  const [txs, setTxs] = useState(null);         // null = cargando
  const [txTotal, setTxTotal] = useState(0);
  const [purchases, setPurchases] = useState(null); // compras por las que falta preguntar las cuotas
  const [purchasesTotal, setPurchasesTotal] = useState(0);
  const [customInstallments, setCustomInstallments] = useState('');
  const [candidates, setCandidates] = useState(null);
  const [failed, setFailed] = useState(false);
  const [leaving, setLeaving] = useState(() => new Set());
  const [busy, setBusy] = useState(null);       // id del ítem en curso
  const [picking, setPicking] = useState(null); // transacción con "Otra…" abierto
  const [sheet, setSheet] = useState(null);     // { pay: tx } | { card: fila de tarjeta }
  const [detail, setDetail] = useState(null);
  const [position, setPosition] = useState(0);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const [review, pairs, asking] = await Promise.all([
      fetch_review_transactions(PAGE), fetch_transfer_candidates(), fetch_installment_reviews(PAGE),
    ]);
    setFailed(review === null || pairs === null || asking === null);
    setPurchases(asking?.items || []);
    setPurchasesTotal(asking?.total || 0);
    setTxs(review?.items || []);
    setTxTotal(review?.total || 0);
    setCandidates(pairs || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Tarjetas con saldo a favor: cargos pagados pero sin registrar. Con día de corte el patrimonio
  // las valora por su deuda estimada (nunca positiva), así que aquí solo salen las que no tienen.
  const cards = useMemo(() => {
    const items = new Map((user_accounts?.items || []).map(a => [a.id, a]));
    return (net_worth?.accounts || [])
      .map(nw => ({ nw, acc: items.get(nw.account_id) }))
      .filter(({ nw, acc }) => acc && isOpenAccount(acc) && isCreditAccount(acc) && Number(nw.balance) > 0);
  }, [user_accounts, net_worth]);

  const refreshReports = () => {
    const month = String(current_Month).padStart(2, '0');
    get_financial_report(current_Month, current_Year);
    get_history_dash(`${current_Year}-${month}`);
    get_expenses_report(`${current_Year}-${month}-01`);
    get_net_worth();
  };

  // Atenúa el ítem y lo saca cuando termina la transición; ahí baja el contador
  const leave = (key, remove) => {
    setLeaving(s => new Set(s).add(key));
    setTimeout(() => {
      remove();
      setLeaving(s => { const next = new Set(s); next.delete(key); return next; });
    }, LEAVE_MS);
  };
  const removeTx = (tx) => leave(`tx:${tx.id}`, () => {
    setTxs(list => list.filter(t => t.id !== tx.id));
    setTxTotal(n => n - 1);
  });
  // Quedan más en la API que aquí: se trae la siguiente tanda
  useEffect(() => {
    if (txs && txs.length < MIN_LOADED && txTotal > txs.length) load();
    if (purchases && purchases.length < MIN_LOADED && purchasesTotal > purchases.length) load();
  }, [txs, txTotal, purchases, purchasesTotal, load]);

  const confirm = async (tx, categoryId = tx.category?.id) => {
    setBusy(`tx:${tx.id}`);
    const ok = await update_transaction(tx.id, categoryId, tx.account?.id, tx.description, tx.expense, tx.amount, tx.date, true);
    setBusy(null);
    if (ok !== true) {
      setAlert('No se pudo guardar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
      return;
    }
    setPicking(null);
    removeTx(tx);
    if (categoryId !== tx.category?.id) refreshReports();
  };

  // Las categorías recomendadas aún no existen (id negativo): se crean al elegirlas
  const chooseCategory = async (tx, value) => {
    let categoryId = Number(value);
    if (categoryId < 0) {
      setBusy(`tx:${tx.id}`);
      const chosen = findElmentById(user_categories.items, categoryId);
      const created = await create_category(chosen.name, 0, chosen.emoji);
      setBusy(null);
      if (!created.res) {
        setAlert('No se pudo crear la categoría, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
        return;
      }
      categoryId = created.id;
      get_user_categories(0, 50);
    }
    confirm(tx, categoryId);
  };

  const chooseInstallments = async (tx, installments) => {
    const key = `cuotas:${tx.id}`;
    setBusy(key);
    const result = await save_installments(tx.id, installments);
    setBusy(null);
    if (!result.ok) {
      setAlert('No se pudo guardar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
      return;
    }
    setCustomInstallments('');
    leave(key, () => {
      setPurchases(list => list.filter(t => t.id !== tx.id));
      setPurchasesTotal(n => n - 1);
    });
    if (installments > 1) refreshReports();
  };

  const linkPair = async (c) => {
    setBusy(pairKey(c));
    const result = await link_transfer(c.out_transaction_id, { counterpartTransactionId: c.in_transaction_id });
    setBusy(null);
    if (!result.ok) {
      setAlert('No se pudo unir, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
      return;
    }
    leave(pairKey(c), () => setCandidates(list => list.filter(x => !sharesLeg(x, c))));
    refreshReports();
  };

  const dismissPair = async (c) => {
    setBusy(pairKey(c));
    const result = await dismiss_transfer_candidate(c.out_transaction_id, c.in_transaction_id);
    setBusy(null);
    if (!result.ok) {
      setAlert('No se pudo descartar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
      return;
    }
    leave(pairKey(c), () => setCandidates(list => list.filter(x => pairKey(x) !== pairKey(c))));
  };

  const seeAll = async () => {
    await change_transactions_filter(filtersFromState(trans_filters_activated, { shouldVerify: true, checked: '', transfer: '' }));
    navigate('/dashboard/transactions');
  };

  const loading = txs === null || candidates === null || purchases === null;
  const total = (txTotal || 0) + (purchasesTotal || 0) + (candidates?.length || 0) + cards.length;
  const accountName = (id) => (user_accounts?.items || []).find(a => a.id === id)?.name || 'Cuenta';
  const isCard = (id) => isCreditAccount((user_accounts?.items || []).find(a => a.id === id));

  useEffect(() => {
    if (!loading && !failed && total === 0) fetch_credit_cards().then(list => setNotice(nextPaymentNotice(list)));
  }, [loading, failed, total]);

  const queue = loading ? [] : buildQueue([
    (txs || []).filter(t => !t.needs_counterpart).map(tx => ({ kind: 'verify', key: `tx:${tx.id}`, tx })),
    (txs || []).filter(t => t.needs_counterpart).map(tx => ({ kind: 'payment', key: `tx:${tx.id}`, tx })),
    (purchases || []).map(tx => ({ kind: 'installments', key: `cuotas:${tx.id}`, tx })),
    (candidates || []).map(c => ({ kind: 'pair', key: pairKey(c), c })),
    cards.map(row => ({ kind: 'card', key: `card:${row.acc.id}`, ...row })),
  ]);
  const current = queue.length ? queue[position % queue.length] : null;
  const following = queue.length > 1 ? queue[(position + 1) % queue.length] : null;

  const renderItem = (item) => {
    const off = leaving.has(item.key);
    const isBusy = busy === item.key;
    if (item.kind === 'verify') {
      const { tx } = item;
      const name = capitalizeWords(tx.category?.name);
      return (
        <Row key={item.key} leaving={off}>
          <TxSummary tx={tx} onOpen={() => setDetail(tx)} />
          {picking === tx.id ? (
            <DropDownCat defaultOpen options={user_categories.items} selected={tx.category?.id} placeholder="Elige una categoría"
              onChange={e => chooseCategory(tx, e.target.value)} />
          ) : (
            <div className="flex items-center gap-2">
              <Button size="sm" icon={CheckIcon} loading={isBusy} disabled={busy !== null || !tx.category?.id} onClick={() => confirm(tx)}
                aria-label={`Confirmar categoría ${name}`} className="flex-1 min-w-0">
                <span className="truncate">{name}</span>
              </Button>
              <Button size="sm" variant="ghost" disabled={busy !== null || !user_categories?.items?.length} onClick={() => setPicking(tx.id)}>Otra…</Button>
            </div>
          )}
        </Row>
      );
    }
    if (item.kind === 'payment') {
      const { tx } = item;
      return (
        <Row key={item.key} leaving={off}>
          <TxSummary tx={tx} onOpen={() => setSheet({ pay: tx })} />
          <Button size="sm" variant="secondary" icon={CreditCardIcon} onClick={() => setSheet({ pay: tx })}>¿De qué cuenta salió?</Button>
        </Row>
      );
    }
    if (item.kind === 'installments') {
      const { tx } = item;
      const custom = Number(customInstallments);
      return (
        <Row key={item.key} leaving={off}>
          <TxSummary tx={tx} onOpen={() => setDetail(tx)} />
          <form className="flex flex-col gap-1.5"
            onSubmit={(e) => { e.preventDefault(); if (custom >= 2 && custom <= 120) chooseInstallments(tx, custom); }}>
            <span className="text-xs font-medium text-ink-2 dark:text-gray-400">¿A cuántas cuotas?</span>
            <span className="flex items-center gap-1.5">
              {INSTALLMENT_OPTIONS.map(n => (
                <Button key={n} size="sm" variant="secondary" disabled={busy !== null} onClick={() => chooseInstallments(tx, n)}
                  aria-label={n === 1 ? 'Una sola cuota' : `${n} cuotas`} className="!px-0 flex-1 min-w-0">{n}</Button>
              ))}
              <input type="number" inputMode="numeric" min="2" max="120" value={customInstallments} placeholder="Otra" aria-label="Otra cantidad de cuotas"
                onChange={e => setCustomInstallments(e.target.value)}
                className="h-8 w-14 shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-gray-100" />
            </span>
            {custom >= 2 && <Button type="submit" size="sm" loading={busy === item.key}>Guardar {custom} cuotas</Button>}
          </form>
        </Row>
      );
    }
    if (item.kind === 'pair') {
      const { c } = item;
      return (
        <Row key={item.key} leaving={off}>
          <div className="flex items-center gap-2 text-xs text-ink-2 dark:text-gray-400 min-w-0">
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(c.out_amount, c.out_currency)}</span>
              <span className="truncate">{accountName(c.out_account_id)}</span>
            </span>
            <ArrowRightIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 flex flex-col">
              <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatMoney(c.in_amount, c.in_currency)}</span>
              <span className="truncate">{accountName(c.in_account_id)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" loading={isBusy} disabled={busy !== null} onClick={() => linkPair(c)} className="flex-1 min-w-0 !px-2">
              <span className="truncate">{isCard(c.in_account_id) ? 'Unir como pago de tarjeta' : 'Unir como transferencia'}</span>
            </Button>
            <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => dismissPair(c)}>No es</Button>
          </div>
        </Row>
      );
    }
    const { acc, nw } = item;
    return (
      <Row key={item.key} leaving={off}>
        <div className="flex gap-2 text-sm text-gray-800 dark:text-gray-100">
          <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5 text-status-warn-text dark:text-amber-300" aria-hidden="true" />
          <span className="min-w-0"><b>Pagado de más</b> en {acc.name}: <span className="tabular-nums">{formatMoney(nw.balance, nw.currency)}</span></span>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setSheet({ card: item })}>Ajustar con el banco</Button>
      </Row>
    );
  };

  return (
    <Card aria-label="Por revisar" className="h-full flex flex-col">
      <CardHeader title={total > 0 ? `Por revisar · ${total}` : 'Por revisar'}
        action={total > 1 && (
          <button type="button" onClick={seeAll} className="shrink-0 text-xs font-medium text-topi-600 dark:text-indigo-300 hover:underline">Ver todo</button>
        )} />
      {loading ? (
        <SkeletonRows rows={3} />
      ) : current ? (
        <>
          {renderItem(current)}
          {following && (
            <div className="hidden lg:block mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">{renderItem(following)}</div>
          )}
          {queue.length > 1 && (
            <div className={`mt-auto pt-3 items-center justify-between gap-2 ${queue.length > 2 ? 'flex' : 'flex lg:hidden'}`}>
              <span className="flex items-center gap-1.5" aria-hidden="true">
                {Array.from({ length: Math.min(queue.length, MAX_DOTS) }).map((_, i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === Math.min(position % queue.length, MAX_DOTS - 1) ? 'bg-topi-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                ))}
              </span>
              <button type="button" onClick={() => { setPicking(null); setPosition(p => p + 1); }} aria-label="Ver el siguiente por revisar"
                className="inline-flex items-center text-xs font-medium text-ink-2 dark:text-gray-400 hover:text-topi-600 dark:hover:text-indigo-300 transition-colors">
                Siguiente <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      ) : failed ? (
        <EmptyState compact icon={ExclamationTriangleIcon} title="No pudimos revisar tus movimientos"
          action={<Button size="sm" variant="secondary" onClick={load}>Reintentar</Button>} />
      ) : first_steps?.retrieved_email && !first_steps?.email ? (
        <EmptyState compact icon={EnvelopeIcon} title="Conecta tu correo" description="Tus movimientos llegan solos y aquí solo confirmas lo que haga falta."
          action={<Button size="sm" onClick={() => navigate('/dashboard/connect-email')}>Conectar correo</Button>} />
      ) : (
        <EmptyState compact icon={CheckCircleIcon} title="Todo al día" description={notice || 'Cuando llegue algo por confirmar, lo verás aquí.'} />
      )}

      <Sheet open={Boolean(sheet)} onClose={() => setSheet(null)} title={sheet?.card ? 'Ajustar con el banco' : 'Pago de tarjeta'}
        description={sheet?.pay?.description || sheet?.card?.acc?.name}>
        {sheet?.pay && (
          <TransferLinkSection detailInfo={sheet.pay} setDetailInfo={(tx) => setSheet({ pay: tx })}
            onChanged={() => { removeTx(sheet.pay); setSheet(null); refreshReports(); }} />
        )}
        {sheet?.card && (
          <CardReconcile account={sheet.card.acc} balance={sheet.card.nw.balance} onCancel={() => setSheet(null)}
            onDone={() => { setSheet(null); refreshReports(); }} />
        )}
      </Sheet>

      {/* El detalle no confirma solo: abrirlo es mirar. Editar sí la marca como revisada. */}
      <TransactionDetail openTransDetail={Boolean(detail)} setOpenTransDetail={() => { setDetail(null); load(); }}
        detailInfo={detail} setDetailInfo={setDetail} currentFrontendPage={1} contextWindow="dash" />
    </Card>
  );
};

const mapStateToProps = state => ({
  user_categories: state.CashFlow.user_categories,
  user_accounts: state.CashFlow.user_accounts,
  first_steps: state.CashFlow.first_steps,
  trans_filters_activated: state.CashFlow.trans_filters_activated,
  net_worth: state.Fx.net_worth,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps, {
  update_transaction, create_category, get_user_categories, change_transactions_filter, setAlert,
  get_financial_report, get_history_dash, get_expenses_report, get_net_worth,
})(ReviewInbox);
