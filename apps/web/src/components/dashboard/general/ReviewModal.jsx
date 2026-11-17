import { useCallback, useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Emoji } from 'emoji-picker-react';
import { PlusIcon } from '@heroicons/react/20/solid';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Money from '../../ui/Money';
import DropDownEmoji from '../../expensePlan/DropDownEmoji';
import { create_category, fetch_review_transactions, get_user_categories, update_transaction } from '../../../redux/actions/cashflow';
import { fetch_installment_reviews, save_installments } from '../../../redux/actions/creditCards';
import { setAlert } from '../../../redux/actions/alert';
import { emitDataChanged } from '../../../lib/dataEvents';
import { capitalizeWords } from '../../helpers';

const PAGE = 50;
const INSTALLMENT_OPTIONS = [1, 3, 6, 12];

// "DLO*Didi 123" y "dlo*didi" son el mismo comercio
export const merchantKey = (description) => String(description || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

// Cola de la ventana: primero las categorías, luego las cuotas. Los pagos sin contraparte, las transferencias y
// las tarjetas con pagos de más siguen en la tarjeta Por revisar (necesitan elegir cuentas).
export const buildReviewQueue = (verify, installments) => [
    ...(verify || []).filter(t => !t.needs_counterpart).map(tx => ({ kind: 'verify', key: `tx:${tx.id}`, tx })),
    ...(installments || []).map(tx => ({ kind: 'installments', key: `cuotas:${tx.id}`, tx })),
];

const REASON = {
    verify: 'Topi no estaba seguro de la categoría. ¿Dónde va este gasto?',
    installments: '¿Esta compra fue a cuotas? Así repartimos el gasto en los meses que corresponde.',
};

/**
 * "Revisar movimientos" (plan/31, bloque D): uno a la vez, con contador, el porqué de cada uno, categorías como
 * botones (las que tienen presupuesto marcadas), crear una nueva aquí mismo y aplicar la misma categoría a todos
 * los pendientes del mismo comercio. La misma ventana sirve para el onboarding y para el Inicio (?revisar=1).
 */
export const ReviewModal = ({
    open, onClose, user_categories, expenses_report,
    update_transaction, create_category, get_user_categories, setAlert,
    loadVerify = fetch_review_transactions, loadInstallments = fetch_installment_reviews, saveInstallments = save_installments,
}) => {
    const [queue, setQueue] = useState(null);
    const [position, setPosition] = useState(0);
    const [done, setDone] = useState(0);
    const [busy, setBusy] = useState(false);
    const [applyAll, setApplyAll] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('');
    const [customInstallments, setCustomInstallments] = useState('');

    const load = useCallback(async () => {
        const [verify, asking] = await Promise.all([loadVerify(PAGE), loadInstallments(PAGE)]);
        setQueue(buildReviewQueue(verify?.items, asking?.items));
        setPosition(0);
    }, [loadVerify, loadInstallments]);

    useEffect(() => {
        if (!open) return;
        setDone(0); setCreating(false); setNewName(''); setNewEmoji(''); setCustomInstallments('');
        setQueue(null);
        load();
    }, [open, load]);

    const budgeted = useMemo(() => new Set((expenses_report || [])
        .filter(c => Math.abs(Number(c.budget) || 0) > 0).map(c => c.category_id)), [expenses_report]);
    // las que tienen presupuesto primero
    const categories = useMemo(() => [...(user_categories?.items || [])]
        .filter(c => Number(c.id) > 0 && !c.income)
        .sort((a, b) => Number(budgeted.has(b.id)) - Number(budgeted.has(a.id))), [user_categories, budgeted]);

    const total = (queue?.length || 0) + done;
    const item = queue && queue.length ? queue[position % queue.length] : null;
    const sameMerchant = item?.kind === 'verify'
        ? queue.filter(q => q.kind === 'verify' && q.key !== item.key && merchantKey(q.tx.description) === merchantKey(item.tx.description))
        : [];

    const resolve = (keys) => {
        setQueue(list => list.filter(q => !keys.includes(q.key)));
        setDone(n => n + keys.length);
        setCreating(false); setNewName(''); setNewEmoji(''); setCustomInstallments('');
    };

    const chooseCategory = async (categoryId) => {
        setBusy(true);
        const targets = [item, ...(applyAll ? sameMerchant : [])];
        const solved = [];
        for (const { tx, key } of targets) {
            const ok = await update_transaction(tx.id, categoryId, tx.account?.id, tx.description, tx.expense, tx.amount, tx.date, true);
            if (ok === true) solved.push(key);
        }
        setBusy(false);
        if (solved.length === 0) {
            setAlert('No se pudo guardar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        resolve(solved);
    };

    const createAndChoose = async () => {
        if (!newName.trim()) return;
        setBusy(true);
        const created = await create_category(newName.trim(), 0, newEmoji, false);
        setBusy(false);
        if (!created?.res) {
            setAlert('No se pudo crear la categoría, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        get_user_categories(0, 50);
        await chooseCategory(created.id);
    };

    const chooseInstallments = async (n) => {
        setBusy(true);
        const result = await saveInstallments(item.tx.id, n);
        setBusy(false);
        if (!result?.ok) {
            setAlert('No se pudo guardar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        resolve([item.key]);
    };

    const finish = () => {
        const left = queue?.length || 0;
        if (done > 0) {
            setAlert(left > 0 ? `Revisaste ${done}. Quedan ${left} para después.` : `¡Listo! Revisaste ${done}.`, true, 'text-white', 'bg-green-500', 3000);
        }
        // la tarjeta Por revisar y las cifras del mes se ponen al día
        emitDataChanged('transactions');
        onClose();
    };

    const footer = item ? (
        <>
            <Button variant="ghost" onClick={() => { setPosition(p => p + 1); setCreating(false); }} disabled={busy || queue.length < 2}>Saltar</Button>
            <Button variant="secondary" onClick={finish} disabled={busy}>Terminar</Button>
        </>
    ) : <Button onClick={finish}>Cerrar</Button>;

    return (
        <Modal open={open} onClose={finish} title="Revisa tus movimientos" size="md" footer={footer}>
            {queue === null ? (
                <p className="text-sm text-ink-2 dark:text-gray-400" role="status">Cargando…</p>
            ) : !item ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
                    <p className="text-base font-semibold text-gray-900 dark:text-white">{done > 0 ? `¡Listo! Revisaste ${done}.` : 'No hay nada por revisar.'}</p>
                    <p className="text-sm text-ink-2 dark:text-gray-400">Cuando llegue algo que Topi no sepa clasificar, lo verás en Por revisar.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs text-ink-2 dark:text-gray-400">
                            <span>{done + 1} de {total}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden" role="progressbar"
                            aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                            <div className="h-full bg-topi-500 rounded-full transition-all" style={{ width: `${(100 * done) / (total || 1)}%` }} />
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.tx.description}</p>
                            <p className="text-xs text-ink-2 dark:text-gray-400 truncate">
                                {item.tx.account?.name}{item.tx.date ? ` · ${String(item.tx.date).slice(0, 10)}` : ''}
                            </p>
                        </div>
                        <Money amount={item.tx.amount} currency={item.tx.currency} base={item.tx.amount_base} sign={item.tx.expense ? '-' : '+'}
                            className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100" />
                    </div>

                    <p className="text-sm text-gray-700 dark:text-gray-300">{REASON[item.kind]}</p>

                    {item.kind === 'verify' ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2" role="group" aria-label="Categorías">
                                {categories.map(c => {
                                    const suggested = c.id === item.tx.category?.id;
                                    return (
                                        <button key={c.id} type="button" disabled={busy} onClick={() => chooseCategory(c.id)}
                                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${suggested
                                                ? 'border-topi-500 bg-topi-50 text-topi-600 dark:bg-gray-700 dark:text-topi-200'
                                                : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                                            {c.emoji && <Emoji unified={c.emoji.toLowerCase()} emojiStyle="apple" size={16} />}
                                            {capitalizeWords(c.name)}
                                            {suggested && <span className="text-[11px] font-normal">(sugerida)</span>}
                                            {budgeted.has(c.id) && <span className="w-1.5 h-1.5 rounded-full bg-topi-500" title="Tiene presupuesto" aria-label="tiene presupuesto" />}
                                        </button>
                                    );
                                })}
                                {!creating && (
                                    <button type="button" onClick={() => setCreating(true)} disabled={busy}
                                        className="inline-flex items-center gap-1 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-topi-600 dark:text-topi-200">
                                        <PlusIcon className="w-4 h-4" aria-hidden="true" /> Nueva categoría
                                    </button>
                                )}
                            </div>
                            {creating && (
                                <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); createAndChoose(); }}>
                                    <div className="w-20 shrink-0"><DropDownEmoji selectedEmoji={newEmoji} setSelectedEmoji={setNewEmoji} /></div>
                                    <label className="flex-1 flex flex-col gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                                        Nombre
                                        <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={40} placeholder="Ej. Domicilios"
                                            className="rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-topi-500" />
                                    </label>
                                    <Button type="submit" size="sm" disabled={busy || !newName.trim()}>Crear y usar</Button>
                                </form>
                            )}
                            {sameMerchant.length > 0 && (
                                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                    <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)}
                                        className="rounded border-gray-300 text-topi-500 focus:ring-topi-500" />
                                    Aplicar a los otros {sameMerchant.length} de «{item.tx.description}»
                                </label>
                            )}
                        </div>
                    ) : (
                        <form className="flex items-center gap-2"
                            onSubmit={(e) => { e.preventDefault(); const n = Number(customInstallments); if (n >= 2 && n <= 120) chooseInstallments(n); }}>
                            {INSTALLMENT_OPTIONS.map(n => (
                                <Button key={n} size="sm" variant="secondary" disabled={busy} onClick={() => chooseInstallments(n)}
                                    aria-label={n === 1 ? 'Una sola cuota' : `${n} cuotas`} className="flex-1">{n}</Button>
                            ))}
                            <input type="number" inputMode="numeric" min="2" max="120" value={customInstallments} placeholder="Otra"
                                aria-label="Otra cantidad de cuotas" onChange={(e) => setCustomInstallments(e.target.value)}
                                className="h-8 w-16 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 text-sm text-gray-900 dark:text-gray-100" />
                            {Number(customInstallments) >= 2 && <Button type="submit" size="sm" disabled={busy}>Guardar</Button>}
                        </form>
                    )}
                </div>
            )}
        </Modal>
    );
};

const mapStateToProps = (state) => ({
    user_categories: state.CashFlow.user_categories,
    expenses_report: state.Reports.expenses_report,
});

export default connect(mapStateToProps, {
    update_transaction, create_category, get_user_categories, setAlert,
})(ReviewModal);
