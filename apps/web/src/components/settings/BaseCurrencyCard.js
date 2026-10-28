import { useState } from 'react';
import { connect } from 'react-redux';
import { BanknotesIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { setAlert } from '../../redux/actions/alert';
import { change_base_currency } from '../../redux/actions/currency';
import Button from '../ui/Button';
import { formatMoney, getBaseCurrency, currencyOptions } from '../helpers';

const fieldClass = 'bg-gray-50 p-2 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full dark:bg-gray-700 dark:border-gray-600 dark:text-white';

// Moneda principal (base) del usuario: en ella se suman los reportes y el patrimonio. Cambiarla
// recalcula todos los movimientos con la tasa de su fecha; primero muestra la vista previa.
const BaseCurrencyCard = ({ user_extra, setAlert }) => {
    const current = user_extra?.base_currency || getBaseCurrency();
    const [currency, setCurrency] = useState(current);
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);

    const choose = async (code) => {
        setCurrency(code);
        setPreview(null);
        if (code === current) return;
        setBusy(true);
        const result = await change_base_currency({ currency: code });
        setBusy(false);
        if (!result.ok) {
            setAlert('No se pudo calcular el cambio, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            setCurrency(current);
            return;
        }
        setPreview(result.data);
    };

    const apply = async () => {
        setBusy(true);
        const result = await change_base_currency({ currency, apply: true });
        if (!result.ok) {
            setBusy(false);
            setAlert('No se pudo cambiar la moneda principal, intenta de nuevo.', false, 'text-white', 'bg-red-500', 4000);
            return;
        }
        setAlert(`Tu moneda principal ahora es ${currency}. Recargando…`, true, '', '', 2000);
        // todos los reportes, saldos y montos cambian de moneda: se recarga la app
        setTimeout(() => window.location.reload(), 1200);
    };

    return (
        <div className="md:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm space-y-3">
            <div className="flex items-start gap-3">
                <BanknotesIcon className="w-5 h-5 mt-0.5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                <div className="flex-1">
                    <label htmlFor="baseCurrency" className="block text-sm font-semibold text-gray-800 dark:text-gray-200">Moneda principal</label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        En ella se suman tus ingresos, gastos, presupuestos y patrimonio. Cada cuenta conserva su propia moneda.
                    </p>
                    <select id="baseCurrency" value={currency} onChange={e => choose(e.target.value)} disabled={busy} className={fieldClass}>
                        {currencyOptions().map(c => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                    </select>
                </div>
            </div>
            {busy && !preview && <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">Calculando…</p>}
            {preview && (
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200" aria-live="polite">
                    <p>
                        {preview.transactions === 1 ? 'Se recalcula 1 movimiento' : `Se recalculan ${preview.transactions} movimientos`} con la tasa de su fecha. Tu patrimonio de hoy:
                        {' '}<b>{formatMoney(preview.net_worth_before, preview.old_currency)}</b> → <b>{formatMoney(preview.net_worth_after, preview.new_currency)}</b>.
                    </p>
                    {preview.replaced_rates > 0 && (
                        <p className="flex gap-2 text-xs rounded-lg p-2 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {preview.replaced_rates === 1 ? '1 tasa que editaste a mano se reemplaza' : `${preview.replaced_rates} tasas que editaste a mano se reemplazan`} por la del mercado.
                        </p>
                    )}
                    {preview.missing_rates > 0 && (
                        <p className="flex gap-2 text-xs rounded-lg p-2 bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {preview.missing_rates === 1 ? '1 movimiento queda' : `${preview.missing_rates} movimientos quedan`} sin valor en {preview.new_currency} hasta que llegue su tasa.
                        </p>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => { setCurrency(current); setPreview(null); }} disabled={busy}>Cancelar</Button>
                        <Button size="sm" onClick={apply} loading={busy}>Cambiar a {preview.new_currency}</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const mapStateToProps = state => ({
    user_extra: state.Auth.user_extra_data,
});

export default connect(mapStateToProps, { setAlert })(BaseCurrencyCard);
