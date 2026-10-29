import { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import moment from 'moment';
import { Emoji } from 'emoji-picker-react';
import Sheet from '../ui/Sheet';
import Chip from '../ui/Chip';
import Button from '../ui/Button';
import { Segmented } from '../charts/ChartTabs';
import { RangeDateSelector } from '../ui/RangeDateSelector.tsx';
import { capitalizeWords, isOpenAccount } from '../helpers';
import { filtersFromState } from '../../redux/actions/cashflow';

const DAY = 'YYYY-MM-DD';
const PRESETS = [
  { id: 'month', label: 'Este mes', range: () => [moment().startOf('month'), moment()] },
  { id: 'last', label: 'Mes pasado', range: () => [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')] },
  { id: '30', label: 'Últimos 30 días', range: () => [moment().subtract(29, 'days'), moment()] },
  { id: 'year', label: 'Este año', range: () => [moment().startOf('year'), moment()] },
];

const Section = ({ title, action, children }) => (
  <section className="py-3 first:pt-0">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-2 dark:text-gray-400">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

// Cuántos filtros del panel hay activos (para el número del botón "Filtros")
export const countPanelFilters = (f = {}) =>
  (f.categorie_ids?.length ? 1 : 0) + (f.accounts_ids?.length ? 1 : 0) + (f.iniDate || f.endDate ? 1 : 0)
  + (f.expence === true || f.expence === false ? 1 : 0);

/**
 * Panel de filtros de Transacciones: tipo, fechas (con atajos), cuentas y categorías.
 * Trabaja sobre un borrador y aplica todo junto con "Ver resultados".
 */
const TransactionFilterSheet = ({ open, onClose, onApply, trans_filters_activated, user_categories, user_accounts }) => {
  const [draft, setDraft] = useState(() => filtersFromState(trans_filters_activated));
  const [catQuery, setCatQuery] = useState('');
  useEffect(() => { if (open) { setDraft(filtersFromState(trans_filters_activated)); setCatQuery(''); } }, [open, trans_filters_activated]);

  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const toggleIn = (key, id) => setDraft(d => {
    const list = Array.isArray(d[key]) ? d[key] : [];
    return { ...d, [key]: list.includes(id) ? list.filter(x => x !== id) : [...list, id] };
  });

  const accounts = useMemo(() => {
    const items = user_accounts?.items || [];
    return [...items.filter(isOpenAccount), ...items.filter(a => !isOpenAccount(a))];
  }, [user_accounts]);
  const categories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    return (user_categories?.items || []).filter(c => !q || c.name.toLowerCase().includes(q));
  }, [user_categories, catQuery]);

  const activePreset = PRESETS.find(p => {
    const [a, b] = p.range();
    return draft.iniDate === a.format(DAY) && draft.endDate === b.format(DAY);
  })?.id;

  const range = draft.iniDate ? { from: moment(draft.iniDate, DAY).toDate(), to: draft.endDate ? moment(draft.endDate, DAY).toDate() : undefined } : undefined;
  const type = draft.expenseFilter === true ? 'expense' : draft.expenseFilter === false ? 'income' : 'all';

  const clearPanel = () => set({ selectedCategories: [], selectedAccounts: [], iniDate: '', endDate: '', expenseFilter: '' });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtros"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={clearPanel}>Limpiar</Button>
          <Button className="flex-[2]" onClick={() => onApply(draft)}>Ver resultados</Button>
        </div>
      }
    >
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <Section title="Tipo">
          <Segmented label="Tipo de movimiento" value={type}
            onChange={(v) => set({ expenseFilter: v === 'expense' ? true : v === 'income' ? false : '' })}
            options={[{ id: 'all', label: 'Todos' }, { id: 'expense', label: 'Gastos' }, { id: 'income', label: 'Ingresos' }]} />
        </Section>

        <Section title="Fecha" action={(draft.iniDate || draft.endDate) &&
          <button type="button" className="text-xs font-medium text-topi-600 dark:text-indigo-300" onClick={() => set({ iniDate: '', endDate: '' })}>Quitar</button>}>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map(p => (
              <Chip key={p.id} selected={activePreset === p.id}
                onClick={() => { const [a, b] = p.range(); set({ iniDate: a.format(DAY), endDate: b.format(DAY) }); }}>
                {p.label}
              </Chip>
            ))}
          </div>
          <RangeDateSelector
            value={range}
            onChange={(r) => set({ iniDate: r?.from ? moment(r.from).format(DAY) : '', endDate: r?.to ? moment(r.to).format(DAY) : '' })}
          />
        </Section>

        <Section title="Cuentas" action={draft.selectedAccounts?.length > 0 &&
          <button type="button" className="text-xs font-medium text-topi-600 dark:text-indigo-300" onClick={() => set({ selectedAccounts: [] })}>Quitar</button>}>
          <div className="flex flex-wrap gap-2">
            {accounts.map(a => (
              <Chip key={a.id} selected={draft.selectedAccounts?.includes(a.id)} onClick={() => toggleIn('selectedAccounts', a.id)}
                className={isOpenAccount(a) ? '' : 'opacity-70'}>
                {a.name}{!isOpenAccount(a) && ' · cerrada'}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Categorías" action={draft.selectedCategories?.length > 0 &&
          <button type="button" className="text-xs font-medium text-topi-600 dark:text-indigo-300" onClick={() => set({ selectedCategories: [] })}>Quitar</button>}>
          {(user_categories?.items?.length || 0) > 10 && (
            <input
              type="search"
              value={catQuery}
              onChange={(e) => setCatQuery(e.target.value)}
              placeholder="Buscar categoría"
              aria-label="Buscar categoría"
              className="w-full mb-3 px-3 py-2 rounded-xl text-sm bg-gray-50 border border-gray-200 text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-topi-500"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <Chip key={c.id} selected={draft.selectedCategories?.includes(c.id)} onClick={() => toggleIn('selectedCategories', c.id)}>
                {c.emoji && <Emoji unified={c.emoji.toLowerCase()} emojiStyle="apple" size={14} />}
                {capitalizeWords(c.name)}
              </Chip>
            ))}
            {categories.length === 0 && <p className="text-sm text-ink-2 dark:text-gray-400">No hay categorías con ese nombre.</p>}
          </div>
        </Section>
      </div>
    </Sheet>
  );
};

const mapStateToProps = (state) => ({
  trans_filters_activated: state.CashFlow.trans_filters_activated,
  user_categories: state.CashFlow.user_categories,
  user_accounts: state.CashFlow.user_accounts,
});

export default connect(mapStateToProps)(TransactionFilterSheet);
