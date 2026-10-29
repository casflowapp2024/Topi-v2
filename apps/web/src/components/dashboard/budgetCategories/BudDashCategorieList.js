import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Emoji } from 'emoji-picker-react';
import { PencilSquareIcon, ArrowsPointingOutIcon, PlusIcon, CheckIcon } from '@heroicons/react/20/solid';
import { ChartPieIcon } from '@heroicons/react/24/outline';
import { get_expenses_report, set_dash_category_activated } from '../../../redux/actions/reports';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
import BudgetProgress, { getMonthPace } from '../../ui/BudgetProgress';
import { SkeletonRows } from '../../ui/Skeleton';
import EmptyState from '../../ui/EmptyState';
import Button from '../../ui/Button';
import { Segmented } from '../../charts/ChartTabs';
import { capitalizeWords, formatMoney } from '../../helpers';
import FullBudgetsModal from './FullBudgetsModal';

/**
 * Lista de presupuestos por categoría (gastos o ingresos, según el interruptor de arriba).
 * Tocar una categoría la elige: la gráfica y los movimientos pasan a mostrarla. Tocarla otra vez
 * (o la ✕ de la gráfica) vuelve al total. No hay ninguna elegida al entrar.
 */
const BudDashCategorieList = ({
  get_expenses_report, expenses_report, income_report, set_dash_category_activated,
  active_report_tab, current_Month, current_Year, category_activated,
  handleOpenEditCat, setOpenCreateBox,
}) => {
  const monthPace = getMonthPace(current_Year, current_Month);
  const isIncome = active_report_tab !== 'Expenses';
  const [loadingReport, setLoadingReport] = useState(true);
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState('amount');

  useEffect(() => {
    if (!current_Year || !current_Month) return;
    setLoadingReport(true);
    get_expenses_report(`${current_Year}-${String(current_Month).padStart(2, '0')}-01`).then(() => setLoadingReport(false));
  }, [current_Month, current_Year, get_expenses_report]);

  const categories = useMemo(() => {
    const src = (isIncome ? income_report : expenses_report) || [];
    const list = src.map(r => ({
      ...r,
      amount: Math.abs(Number(r.value || 0)),
      budget: Math.abs(Number(r.budget || 0)),
      usage: Number(r.usage || 0),
    }));
    const key = sortKey === 'usage' ? 'usage' : 'amount';
    // Primero las que tienen movimiento, de mayor a menor; luego las vacías por presupuesto
    return list.sort((a, b) => ((b[key] > 0) - (a[key] > 0)) || (b[key] - a[key]) || (b.budget - a.budget));
  }, [isIncome, income_report, expenses_report, sortKey]);

  const selectedId = category_activated?.category_id;
  const toggle = (cat) => {
    const selecting = cat.category_id !== selectedId;
    set_dash_category_activated(selecting ? cat : null);
    // En móvil la gráfica queda debajo de la lista: al elegir, se trae a la vista para ver la reacción
    if (selecting && window.matchMedia?.('(max-width: 1023px)').matches) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => document.getElementById('budget-chart')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' }));
    }
  };

  return (
    <section className="lg:h-full lg:flex lg:flex-col bg-white rounded-2xl shadow-md dark:bg-gray-800 transition-colors duration-300" aria-label="Presupuestos por categoría">
      <header className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Categorías</h2>
          <p className="text-xs text-ink-2 dark:text-gray-400">Toca una para verla en detalle</p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" icon={PlusIcon} onClick={() => setOpenCreateBox(true)} aria-label="Agregar presupuesto">
            <span className="hidden sm:inline">Presupuesto</span>
          </Button>
          {!isIncome && (
            <button type="button" onClick={() => setIsFullModalOpen(true)} title="Panorama completo" aria-label="Panorama completo"
              className="p-2 rounded-xl text-gray-500 hover:text-topi-600 hover:bg-topi-50 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors">
              <ArrowsPointingOutIcon className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="px-4 pb-2 flex items-center justify-between">
        <span className="text-xs text-ink-2 dark:text-gray-400">Ordenar por</span>
        <Segmented label="Ordenar categorías" value={sortKey} onChange={setSortKey}
          options={[{ id: 'amount', label: 'Monto' }, { id: 'usage', label: '% usado' }]} />
      </div>

      <div aria-busy={loadingReport} className={`relative px-2 pb-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col transition-opacity duration-200 ${loadingReport && categories.length ? 'opacity-50' : ''}`}>
        {loadingReport && !categories.length ? (
          <SkeletonRows rows={5} withBar className="px-2" />
        ) : categories.length === 0 ? (
          <EmptyState compact icon={ChartPieIcon} title="Sin presupuestos este mes"
            description={`Crea un presupuesto de ${isIncome ? 'ingresos' : 'gastos'} para seguirlo aquí.`} />
        ) : (
          <ul className="flex flex-col gap-1 max-h-[264px] lg:max-h-none lg:flex-1 lg:min-h-0 overflow-y-auto overscroll-contain">
            {categories.map(cat => {
              const selected = cat.category_id === selectedId;
              return (
                <li key={cat.category_id}>
                  <div
                    role="button" tabIndex={0} aria-pressed={selected}
                    onClick={() => toggle(cat)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(cat); } }}
                    className={`group relative px-3 py-3 rounded-xl cursor-pointer select-none transition-colors active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${selected
                      ? 'bg-topi-50 dark:bg-indigo-500/15 ring-1 ring-topi-500/50'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center shrink-0">
                        {cat.emoji ? <Emoji unified={cat.emoji.toLowerCase()} emojiStyle="apple" size={16} /> : null}
                      </span>
                      <span className={`flex-1 min-w-0 truncate text-sm font-semibold ${selected ? 'text-topi-600 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-100'}`}>
                        {capitalizeWords(cat.name)}
                      </span>
                      {selected && <CheckIcon className="w-4 h-4 text-topi-500 shrink-0" aria-hidden="true" />}
                      <span className="text-right shrink-0">
                        <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                          <FormatMoneyShowDecs numb={cat.amount === 0 ? 0.000001 : cat.amount} showDecimals={true} intClass="text-sm" decClass="text-[10px]" />
                        </span>
                        {cat.budget > 0 && <span className="block text-xs text-ink-2 dark:text-gray-400 tabular-nums">de {formatMoney(cat.budget)}</span>}
                      </span>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); handleOpenEditCat(cat.category_id); }}
                        aria-label={`Editar ${cat.name}`}
                        className="p-1.5 -mr-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:hover:text-gray-100 transition-colors">
                        <PencilSquareIcon className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                    {cat.budget > 0 && (
                      <BudgetProgress usage={cat.usage} isIncome={isIncome} pace={monthPace} height="h-1.5" className="mt-2 pl-9" />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {/* En móvil la lista es corta: un degradado indica que hay más abajo */}
        {categories.length > 4 && (
          <div className="pointer-events-none absolute bottom-3 left-2 right-2 h-8 rounded-b-xl bg-gradient-to-t from-white dark:from-gray-800 lg:hidden" aria-hidden="true" />
        )}
      </div>

      <FullBudgetsModal isOpen={isFullModalOpen} onClose={() => setIsFullModalOpen(false)} categories={expenses_report || []} />
    </section>
  );
};

const mapStateToProps = state => ({
  current_Month: state.Reports.current_Month,
  current_Year: state.Reports.current_Year,
  expenses_report: state.Reports.expenses_report,
  income_report: state.Reports.income_report,
  category_activated: state.Reports.category_activated,
  active_report_tab: state.UI.active_report_tab,
});

export default connect(mapStateToProps, { get_expenses_report, set_dash_category_activated })(BudDashCategorieList);
