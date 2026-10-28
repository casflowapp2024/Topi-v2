import { useState } from 'react';
import { connect } from 'react-redux';
import { update_transaction, update_transaction_local } from '../../redux/actions/cashflow';
import { setAlert } from '../../redux/actions/alert';
import { formatMoney, getBaseCurrency, getCurrency } from '../helpers';

const SOURCE_LABELS = {
    SFC_TRM: 'TRM oficial (Superfinanciera)',
    ECB: 'Banco Central Europeo',
    manual: 'tasa cargada por Topi',
    user: 'editada por ti',
    transfer: 'tasa de la transferencia',
    migration: 'migración',
    conversion: 'conversión de moneda de la cuenta',
    identity: 'misma moneda',
};

export const fxSourceLabel = (source) =>
    (source || '').split('+').map(s => SOURCE_LABELS[s] || s).filter(Boolean).join(' + ');

// Tasa de cambio de una transacción en otra moneda y su edición manual (fx_rate_source = 'user').
const FxRateEditor = ({ detailInfo, setDetailInfo, contextWindow, update_transaction, update_transaction_local, setAlert }) => {
    const baseCurrency = getBaseCurrency();
    const [editing, setEditing] = useState(false);
    const [rate, setRate] = useState('');
    const [saving, setSaving] = useState(false);

    if (!detailInfo || !detailInfo.currency || detailInfo.currency === baseCurrency) return null;

    const currency = detailInfo.currency;
    const parsed = Number(String(rate).replace(',', '.'));
    const valid = Number.isFinite(parsed) && parsed > 0;

    const startEditing = () => {
        setRate(detailInfo.fx_rate || '');
        setEditing(true);
    };

    const save = async (e) => {
        e.preventDefault();
        if (!valid) return;
        setSaving(true);
        const ok = await update_transaction(
            detailInfo.id,
            detailInfo.category.id,
            detailInfo.account.id,
            detailInfo.description,
            detailInfo.expense,
            detailInfo.amount,
            detailInfo.date,
            true,
            false,
            String(parsed),
        );
        setSaving(false);
        if (!ok) {
            setAlert('No se pudo guardar la tasa, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        const changes = {
            fx_rate: String(parsed),
            fx_rate_source: 'user',
            amount_base: String(Math.round(Number(detailInfo.amount) * parsed * 10000) / 10000),
        };
        setDetailInfo({ ...detailInfo, ...changes });
        update_transaction_local(detailInfo.id, changes, contextWindow);
        setEditing(false);
        setAlert('Tasa actualizada.', true, '', '', 2500);
    };

    return (
        <section aria-label="Tasa de cambio" className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="text-gray-600 dark:text-gray-300">
                    {detailInfo.fx_rate ? (
                        <>
                            <p>
                                1 {getCurrency(currency).symbol} = <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatMoney(detailInfo.fx_rate, baseCurrency, { decimals: 2 })}</span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Fuente: {fxSourceLabel(detailInfo.fx_rate_source)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Equivale a {formatMoney(detailInfo.amount_base, baseCurrency)}
                            </p>
                        </>
                    ) : (
                        <p>Aún no hay tasa {currency}→{baseCurrency} para esta fecha; se completa sola cuando llegue.</p>
                    )}
                </div>
                {!editing && (
                    <button type="button" onClick={startEditing}
                        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-[#5266EB] hover:bg-slate-50 dark:hover:bg-gray-800">
                        Editar tasa
                    </button>
                )}
            </div>
            {editing && (
                <form onSubmit={save} className="mt-3 flex items-end gap-2">
                    <label className="flex-1 text-xs text-gray-600 dark:text-gray-300">
                        {baseCurrency} por 1 {currency}
                        <input
                            type="text"
                            inputMode="decimal"
                            value={rate}
                            onChange={e => setRate(e.target.value)}
                            aria-label={`Tasa: ${getCurrency(baseCurrency).name} por 1 ${getCurrency(currency).name}`}
                            aria-invalid={!valid}
                            className="mt-1 block w-full rounded-lg border border-gray-300 bg-gray-50 px-2 py-1.5 text-right text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                    </label>
                    <button type="submit" disabled={!valid || saving}
                        className="rounded-lg bg-[#5266EB] px-3 py-2 text-xs font-medium text-white disabled:opacity-50">
                        {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => setEditing(false)}
                        className="rounded-lg px-3 py-2 text-xs font-medium text-gray-600 hover:bg-slate-50 dark:text-gray-300 dark:hover:bg-gray-800">
                        Cancelar
                    </button>
                </form>
            )}
            {editing && valid && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
                    Quedaría en {formatMoney(Number(detailInfo.amount) * parsed, baseCurrency)}
                </p>
            )}
        </section>
    );
};

export default connect(null, { update_transaction, update_transaction_local, setAlert })(FxRateEditor);
