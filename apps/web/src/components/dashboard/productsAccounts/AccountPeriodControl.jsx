import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import 'moment/locale/es';
import { set_init_date_account_activated, set_end_date_account_activated } from '../../../redux/actions/reports';
import { fetch_credit_cards } from '../../../redux/actions/creditCards';
import RangePill from '../../ui/RangePill';
import PeriodSelector from '../../navigation/PeriodSelector';
import Chip from '../../ui/Chip';
import { Segmented } from '../../charts/ChartTabs';
import { isCreditAccount } from '../../helpers';

const DAY = 'YYYY-MM-DD';
const fmt = (d) => moment(d).locale('es').format('D MMM');

// Ciclos de facturación de una tarjeta a partir de su día de corte: el actual va del día siguiente
// al último corte hasta el próximo corte; el anterior, del corte previo al último.
export const billingCycles = (statementDay, today = moment()) => {
  if (!statementDay) return null;
  const clampDay = (m) => m.clone().date(Math.min(Number(statementDay), m.daysInMonth()));
  let last = clampDay(today.clone());
  if (last.isAfter(today, 'day')) last = clampDay(today.clone().subtract(1, 'month'));
  const next = clampDay(last.clone().add(1, 'month'));
  const prev = clampDay(last.clone().subtract(1, 'month'));
  return {
    current: { from: last.clone().add(1, 'day'), to: next },
    previous: { from: prev.clone().add(1, 'day'), to: last },
  };
};

/**
 * Periodo del detalle de una cuenta. Tres formas:
 *  - Mes: el mes del selector global (igual que en Inicio y Presupuestos)
 *  - Corte (solo tarjetas con día de corte): ciclo actual o anterior, para cuadrar con el extracto
 *  - Rango: fechas libres
 * Escribe el rango en el store (iniDate/endDate de la cuenta), que es lo que leen el resumen y los movimientos.
 */
const AccountPeriodControl = ({
  account, current_Month, current_Year, iniDate_account_dash, endDate_account_dash,
  set_init_date_account_activated, set_end_date_account_activated,
}) => {
  const credit = isCreditAccount(account);
  const [mode, setMode] = useState('month');
  const [card, setCard] = useState(null);
  const [cycle, setCycle] = useState('current');

  useEffect(() => {
    setCard(null);
    if (credit) fetch_credit_cards().then(list => setCard((list || []).find(c => c.account_id === account.id) || {}));
  }, [credit, account?.id]);
  const cycles = useMemo(() => billingCycles(card?.statement_day), [card]);

  // Tarjetas con corte configurado abren en "Corte"; las demás en "Mes"
  useEffect(() => { setMode(credit && cycles ? 'cycle' : 'month'); setCycle('current'); }, [account?.id, credit, cycles]);

  const setRange = (from, to) => {
    set_init_date_account_activated(moment(from).format(DAY));
    set_end_date_account_activated(moment(to).format(DAY));
  };
  useEffect(() => {
    if (mode === 'month') {
      setRange(new Date(current_Year, current_Month - 1, 1), new Date(current_Year, current_Month, 0));
    } else if (mode === 'cycle' && cycles) {
      const c = cycles[cycle];
      setRange(c.from, c.to);
    }
  }, [mode, cycle, cycles, current_Month, current_Year]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = [
    { id: 'month', label: 'Mes' },
    ...(credit && cycles ? [{ id: 'cycle', label: 'Corte' }] : []),
    { id: 'range', label: 'Rango' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Periodo" value={mode} onChange={setMode} options={options} />
      {mode === 'month' && <PeriodSelector compact />}
      {mode === 'cycle' && cycles && (
        <div className="flex gap-2">
          <Chip selected={cycle === 'current'} onClick={() => setCycle('current')}
            title={`${fmt(cycles.current.from)} – ${fmt(cycles.current.to)}`}>Actual</Chip>
          <Chip selected={cycle === 'previous'} onClick={() => setCycle('previous')}
            title={`${fmt(cycles.previous.from)} – ${fmt(cycles.previous.to)}`}>Anterior</Chip>
        </div>
      )}
      {mode === 'range' && (
        <RangePill
          from={iniDate_account_dash}
          to={endDate_account_dash}
          onChange={(from, to) => {
            if (from) set_init_date_account_activated(from);
            if (to) set_end_date_account_activated(to);
          }}
        />
      )}
      {credit && !cycles && card && (
        <span className="text-xs text-ink-2 dark:text-gray-400">Configura el día de corte para ver por ciclo de facturación.</span>
      )}
    </div>
  );
};

const mapStateToProps = state => ({
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
  iniDate_account_dash: state.Reports.iniDate_account_dash,
  endDate_account_dash: state.Reports.endDate_account_dash,
});

export default connect(mapStateToProps, { set_init_date_account_activated, set_end_date_account_activated })(AccountPeriodControl);
