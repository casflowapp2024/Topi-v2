import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import Card from '../../ui/Card';
import Skeleton from '../../ui/Skeleton';
import { BudgetStatusLabel, getBudgetStatus, getDailyAllowance, getMonthPace } from '../../ui/BudgetProgress';
import ProjectionChart from '../../charts/ProjectionChart';
import { daysInMonth, isCurrentMonth, metricValue, monthlyMetricAt } from '../../charts/chartTheme';
import { formatMoney } from '../../helpers';

const Headline = ({ label, value }) => (
  <p className="flex flex-col">
    <span className="text-sm text-ink-2 dark:text-gray-400">{label}</span>
    <span className="text-2xl font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
  </p>
);

// Sin presupuestos: a este ritmo, ¿cierras por encima o por debajo del mes anterior?
const vsLastMonth = (spent, history_dash, year, month) => {
  const prev = new Date(year, month - 2, 1);
  const at = (key) => monthlyMetricAt(history_dash?.monthly, key, prev.getFullYear(), prev.getMonth() + 1);
  const last = Math.abs(metricValue(at('budget_spent') ?? at('expense')));
  if (!isCurrentMonth(year, month)) return last > 0 ? { text: `El mes anterior gastaste ${formatMoney(last)}` } : null;
  const projected = (spent / new Date().getDate()) * daysInMonth(year, month);
  return { text: `A este ritmo cerrarías en ${formatMoney(projected)}${last > 0 ? ` · el mes anterior, ${formatMoney(last)}` : ''}` };
};

/**
 * Primera tarjeta del inicio: ¿cómo voy este mes? Lo usado (mtd_budget) es lo mismo que suma
 * Presupuestos: los gastos más lo movido a inversiones, que sale del dinero disponible sin ser gasto.
 */
const HomePaceCard = ({ history_dash, current_Month, current_Year, loading }) => {
  const year = Number(current_Year);
  const month = Number(current_Month);
  const budget = Math.abs(Number(history_dash?.expense_budget) || 0);
  const mtd = history_dash?.daily?.mtd_budget || history_dash?.daily?.mtd_expense || [];
  const spent = Math.abs(Number(mtd[mtd.length - 1]) || 0);
  const allowance = getDailyAllowance(budget, spent, year, month);
  const future = new Date(year, month - 1, 1) > new Date();
  const status = budget > 0 ? getBudgetStatus((spent / budget) * 100, { pace: getMonthPace(year, month) }) : null;

  let body;
  if (future) {
    body = <Headline label="Este mes aún no empieza" value={budget > 0 ? `${formatMoney(budget)} de presupuesto` : formatMoney(0)} />;
  } else if (budget > 0 && allowance) {
    body = (
      <>
        <Headline label="Hoy puedes gastar" value={formatMoney(allowance.perDay)} />
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2 dark:text-gray-400">
          <span>Quedan {formatMoney(allowance.left)} para {allowance.daysLeft} {allowance.daysLeft === 1 ? 'día' : 'días'}</span>
          <BudgetStatusLabel status={status} />
        </p>
      </>
    );
  } else if (budget > 0) {
    body = (
      <>
        <Headline label="Gastaste" value={formatMoney(spent)} />
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-2 dark:text-gray-400">
          <span>de {formatMoney(budget)}</span>
          <BudgetStatusLabel status={status} />
        </p>
      </>
    );
  } else {
    const compare = vsLastMonth(spent, history_dash, year, month);
    body = (
      <>
        <Headline label={allowance ? 'Gastado este mes' : 'Gastaste'} value={formatMoney(spent)} />
        {compare && <p className="text-xs text-ink-2 dark:text-gray-400">{compare.text}</p>}
        <Link to="budgets" className="text-xs font-medium text-topi-600 dark:text-indigo-300 hover:underline">Crear presupuesto</Link>
      </>
    );
  }

  return (
    <Card className="h-full flex flex-col gap-2" aria-label="Ritmo del mes">
      {!history_dash ? (
        <div className="flex flex-col gap-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-7 w-3/4" /><Skeleton className="h-[140px] w-full" /></div>
      ) : (
        <div aria-busy={loading} className={`flex-1 flex flex-col gap-1 min-w-0 transition-opacity duration-200 ${loading ? 'opacity-50' : ''}`}>
          {body}
          {!future && (
            <div className="relative flex-1 min-h-[140px] lg:min-h-[190px] mt-2">
              <div className="absolute inset-0"><ProjectionChart compact /></div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

const mapStateToProps = (state) => ({
  history_dash: state.Reports.history_dash,
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
});

export default connect(mapStateToProps)(HomePaceCard);
