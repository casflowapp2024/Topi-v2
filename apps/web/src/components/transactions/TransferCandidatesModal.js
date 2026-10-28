import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, ArrowsRightLeftIcon, ArrowRightIcon } from '@heroicons/react/24/solid';
import moment from 'moment-timezone';
import { connect } from 'react-redux';
import { get_user_transactions } from '../../redux/actions/cashflow';
import { get_net_worth } from '../../redux/actions/fx';
import { setAlert } from '../../redux/actions/alert';
import { link_transfer, dismiss_transfer_candidate } from '../../redux/actions/transfers';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import { formatMoney } from '../helpers';

const CONFIDENCE = {
    high: { label: 'Muy probable', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    medium: { label: 'Probable', className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    low: { label: 'Entre monedas', className: 'bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-gray-200' },
};

const pairKey = (c) => `${c.out_transaction_id}-${c.in_transaction_id}`;

// Las parejas "muy probables" sin ambigüedad: ninguna de sus dos transacciones aparece en otra pareja
export const unambiguousHigh = (candidates) => {
    const uses = new Map();
    candidates.forEach(c => [c.out_transaction_id, c.in_transaction_id].forEach(id => uses.set(id, (uses.get(id) || 0) + 1)));
    return candidates.filter(c => c.confidence === 'high'
        && uses.get(c.out_transaction_id) === 1 && uses.get(c.in_transaction_id) === 1);
};

// Bandeja de posibles transferencias: parejas salida/entrada entre cuentas propias que la API
// encontró y que no están ligadas ni descartadas. Ligar las saca de ingresos y gastos.
const TransferCandidatesModal = ({ open, onClose, candidates, setCandidates, user_accounts, default_limit,
    get_user_transactions, get_net_worth, setAlert }) => {
    const accounts = useMemo(() => user_accounts?.items || [], [user_accounts]);
    const [busy, setBusy] = useState(null); // clave de la pareja en curso o 'bulk'
    const [changed, setChanged] = useState(false);

    useEffect(() => { if (open) setChanged(false); }, [open]);

    const accountName = (id) => {
        const a = accounts.find(x => String(x.id) === String(id));
        return a ? `${a.name} ••${a.last_four_digits}` : 'Cuenta';
    };
    // al ligar, las otras parejas con alguna de esas transacciones dejan de ser posibles
    const removeUsing = (c) => setCandidates(list => list.filter(x =>
        x.out_transaction_id !== c.out_transaction_id && x.in_transaction_id !== c.in_transaction_id
        && x.out_transaction_id !== c.in_transaction_id && x.in_transaction_id !== c.out_transaction_id));

    const close = () => {
        if (changed) {
            get_user_transactions(0, default_limit);
            get_net_worth();
        }
        onClose();
    };

    const link = async (c) => {
        setBusy(pairKey(c));
        const result = await link_transfer(c.out_transaction_id, { counterpartTransactionId: c.in_transaction_id });
        setBusy(null);
        if (!result.ok) {
            setAlert('No se pudo ligar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        removeUsing(c);
        setChanged(true);
    };

    const dismiss = async (c) => {
        setBusy(pairKey(c));
        const result = await dismiss_transfer_candidate(c.out_transaction_id, c.in_transaction_id);
        setBusy(null);
        if (!result.ok) {
            setAlert('No se pudo descartar, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setCandidates(list => list.filter(x => pairKey(x) !== pairKey(c)));
    };

    const bulk = unambiguousHigh(candidates || []);
    const linkAllHigh = async () => {
        setBusy('bulk');
        let linked = 0;
        for (const c of bulk) {
            const result = await link_transfer(c.out_transaction_id, { counterpartTransactionId: c.in_transaction_id });
            if (result.ok) {
                linked++;
                removeUsing(c);
            }
        }
        setBusy(null);
        setChanged(changed || linked > 0);
        setAlert(`${linked} de ${bulk.length} transferencias ligadas.`, linked === bulk.length, '', '', 3000);
    };

    const leg = (sign, amount, currency, accountId, date, description) => (
        <div className="min-w-0 flex-1">
            <p className={`font-semibold ${sign === '-' ? 'text-gray-900 dark:text-white' : 'text-money-in dark:text-money-in-dark'}`}>
                {sign}{formatMoney(amount, currency)}
            </p>
            <p className="truncate text-xs text-gray-600 dark:text-gray-300">{accountName(accountId)}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{moment(date).format('DD-MM-YYYY')} · {description}</p>
        </div>
    );

    return (
        <Dialog open={open} onClose={close} className="relative z-40 font-Inter">
            <div className="fixed inset-0 bg-gray-900/50" aria-hidden="true" />
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-end sm:items-center justify-center p-4">
                    <DialogPanel className="w-full max-w-2xl rounded-3xl bg-white dark:bg-[#151C2C] p-5 shadow-2xl">
                        <div className="flex items-center justify-between mb-2">
                            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
                                <ArrowsRightLeftIcon className="w-5 h-5 text-topi-500" aria-hidden="true" />
                                Posibles transferencias
                            </DialogTitle>
                            <button type="button" onClick={close} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <XMarkIcon className="w-6 h-6" aria-hidden="true" />
                                <span className="sr-only">Cerrar</span>
                            </button>
                        </div>
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                            Salidas y entradas entre tus cuentas que parecen el mismo dinero. Al ligarlas dejan de contar
                            como ingreso y gasto; siguen en el saldo de cada cuenta y en el presupuesto de su categoría.
                        </p>

                        {candidates === null ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">Buscando…</p>
                        ) : candidates.length === 0 ? (
                            <EmptyState title="No hay posibles transferencias" description="Cuando aparezcan movimientos que parezcan pasar de una cuenta a otra, los verás aquí." />
                        ) : (
                            <>
                                {bulk.length > 1 && (
                                    <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-200">
                                        <span>{bulk.length} son muy probables y no se cruzan con otras.</span>
                                        <Button size="sm" onClick={linkAllHigh} loading={busy === 'bulk'} disabled={busy !== null}>Ligar esas {bulk.length}</Button>
                                    </div>
                                )}
                                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                                    {candidates.map(c => (
                                        <li key={pairKey(c)} className="py-3">
                                            <div className="flex items-center gap-2">
                                                {leg('-', c.out_amount, c.out_currency, c.out_account_id, c.out_date, c.out_description)}
                                                <ArrowRightIcon className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                                                {leg('+', c.in_amount, c.in_currency, c.in_account_id, c.in_date, c.in_description)}
                                            </div>
                                            <div className="mt-2 flex items-center justify-between gap-2">
                                                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${(CONFIDENCE[c.confidence] || CONFIDENCE.low).className}`}>
                                                    {(CONFIDENCE[c.confidence] || CONFIDENCE.low).label}
                                                </span>
                                                <div className="flex gap-2">
                                                    <Button variant="secondary" size="sm" onClick={() => dismiss(c)} disabled={busy !== null}>No es</Button>
                                                    <Button size="sm" icon={ArrowsRightLeftIcon} onClick={() => link(c)}
                                                        loading={busy === pairKey(c)} disabled={busy !== null}>Ligar</Button>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
};

const mapStateToProps = state => ({
    user_accounts: state.CashFlow.user_accounts,
    default_limit: state.CashFlow.user_transactions.default_limit,
});

export default connect(mapStateToProps, { get_user_transactions, get_net_worth, setAlert })(TransferCandidatesModal);
