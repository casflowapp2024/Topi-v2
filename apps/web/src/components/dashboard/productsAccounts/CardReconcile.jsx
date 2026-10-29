import { useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment-timezone';
import { Emoji } from 'emoji-picker-react';
import { create_transaction } from '../../../redux/actions/cashflow';
import { setAlert } from '../../../redux/actions/alert';
import InputMoneyInt2Decs from '../../InputMoneyInt2Decs';
import Button from '../../ui/Button';
import Chip from '../../ui/Chip';
import { formatMoney, formatedCurrToNumber, capitalizeWords, parseDatetimetoDateStrFormat } from '../../helpers';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Ajustar el saldo de una tarjeta con lo que dice el banco.
 * Lo registrado en Topi puede quedarse corto: intereses, cuota de manejo o seguros que nunca
 * llegaron por correo. Con la deuda real de hoy se calcula la diferencia y se registra como un
 * gasto de la tarjeta (Intereses / Comisiones), en la fecha que elijas. Si en Topi hay más deuda
 * que en el banco, lo que falta es un pago: eso se registra como transferencia, no como gasto.
 *   balance: saldo registrado de la cuenta (negativo = deuda; positivo = pagado de más)
 */
const CardReconcile = ({ account, balance, card, user_categories, create_transaction, setAlert, onDone, onCancel }) => {
  const currency = account?.currency || 'COP';
  const recordedDebt = -Number(balance || 0); // deuda registrada (negativa si se pagó de más)
  const [bankDebt, setBankDebt] = useState(Math.max(0, recordedDebt));
  const [saving, setSaving] = useState(false);

  const expenseCats = useMemo(() => (user_categories?.items || []).filter(c => !c.income), [user_categories]);
  const suggested = useMemo(() => ['intereses', 'comisiones']
    .map(n => expenseCats.find(c => norm(c.name) === n)).filter(Boolean), [expenseCats]);
  const [categoryId, setCategoryId] = useState(() => suggested[0]?.id ?? expenseCats[0]?.id ?? '');

  const lastStatement = card?.last_statement ? moment(card.last_statement) : null;
  const [when, setWhen] = useState('today');

  const bank = Number(formatedCurrToNumber(String(bankDebt))) || 0;
  const diff = Math.round((bank - recordedDebt) * 100) / 100; // > 0: cargos sin registrar

  const save = async () => {
    if (!(diff > 0) || !categoryId) return;
    setSaving(true);
    const date = when === 'statement' && lastStatement ? lastStatement.clone().hour(12).toDate() : new Date();
    const cat = expenseCats.find(c => c.id === Number(categoryId));
    const ok = await create_transaction(
      Number(categoryId), account.id,
      `Ajuste con el banco: ${cat ? capitalizeWords(cat.name).toLowerCase() : 'cargos'} no registrados`,
      true, diff, parseDatetimetoDateStrFormat(date, 'YYYY-MM-DD HH:mm:ss Z'),
    );
    setSaving(false);
    if (ok) {
      setAlert(`Registramos ${formatMoney(diff, currency)} como gasto de la tarjeta.`, true, '', '', 3000);
      onDone && onDone();
    } else {
      setAlert('No se pudo registrar el ajuste. Intenta de nuevo.', false, 'text-white', 'bg-red-500', 5000);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
      <div>
        <label htmlFor="bankDebt" className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">
          ¿Cuánto debes hoy según tu banco? ({currency})
        </label>
        <InputMoneyInt2Decs id="bankDebt" name="bankDebt" currency={currency} ariaLabel="Deuda según el banco"
          number={bankDebt} onChangeCreate={e => setBankDebt(e.target.value)} />
        <p className="mt-1 text-xs text-ink-2 dark:text-gray-400">
          Lo ves en la app del banco. Si ya pagaste todo, es 0. En Topi tienes registrado {recordedDebt >= 0
            ? <>una deuda de <b>{formatMoney(recordedDebt, currency)}</b></>
            : <><b>{formatMoney(-recordedDebt, currency)}</b> pagados de más</>}.
        </p>
      </div>

      {diff > 0 ? (
        <>
          <p className="text-sm text-gray-800 dark:text-gray-100">
            Faltan <b className="text-money-out dark:text-money-out-dark">{formatMoney(diff, currency)}</b> en cargos que no llegaron por correo
            (intereses, cuota de manejo, seguros). Se registran como un gasto de esta tarjeta.
          </p>
          <div>
            <span className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Categoría</span>
            <div className="flex flex-wrap gap-2">
              {suggested.map(c => (
                <Chip key={c.id} selected={Number(categoryId) === c.id} onClick={() => setCategoryId(c.id)}>
                  {c.emoji && <Emoji unified={c.emoji.toLowerCase()} emojiStyle="apple" size={14} />}{capitalizeWords(c.name)}
                </Chip>
              ))}
              <select value={suggested.some(c => c.id === Number(categoryId)) ? '' : categoryId}
                onChange={e => e.target.value && setCategoryId(Number(e.target.value))}
                aria-label="Otra categoría"
                className="h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 px-3">
                <option value="">{suggested.length ? 'Otra…' : 'Elige una categoría'}</option>
                {expenseCats.filter(c => !suggested.includes(c)).map(c => <option key={c.id} value={c.id}>{capitalizeWords(c.name)}</option>)}
              </select>
            </div>
            <p className="mt-1 text-xs text-ink-2 dark:text-gray-400">¿Fueron intereses y cuota de manejo? Registra una parte y repite con la otra.</p>
          </div>
          <div>
            <span className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">Fecha del gasto</span>
            <div className="flex flex-wrap gap-2">
              <Chip selected={when === 'today'} onClick={() => setWhen('today')}>Hoy</Chip>
              {lastStatement && <Chip selected={when === 'statement'} onClick={() => setWhen('statement')}>Último corte ({lastStatement.format('DD MMM')})</Chip>}
            </div>
            <p className="mt-1 text-xs text-ink-2 dark:text-gray-400">
              Es un acumulado: no siempre se sabe a qué mes corresponde cada cargo. Cuenta en los gastos del mes de esa fecha.
            </p>
          </div>
        </>
      ) : diff < 0 ? (
        <p className="text-sm text-gray-800 dark:text-gray-100">
          En Topi tienes <b>{formatMoney(-diff, currency)}</b> más de deuda que en tu banco. Probablemente falta registrar un pago:
          créalo en Transacciones → Nuevo → Transferencia, desde la cuenta con la que pagaste.
        </p>
      ) : (
        <p className="text-sm text-money-in dark:text-money-in-dark font-medium">Cuadra con tu banco. No hay nada que ajustar.</p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancelar</Button>
        {diff > 0 && (
          <Button size="sm" loading={saving} disabled={!categoryId} onClick={save}>
            Registrar gasto de {formatMoney(diff, currency)}
          </Button>
        )}
      </div>
    </div>
  );
};

const mapStateToProps = state => ({ user_categories: state.CashFlow.user_categories });
export default connect(mapStateToProps, { create_transaction, setAlert })(CardReconcile);
