import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import HomePaceCard from '../../dashboard/general/HomePaceCard';
import HomeFlowCard from '../../dashboard/general/HomeFlowCard';
import HomeNetWorthCard from '../../dashboard/general/HomeNetWorthCard';
import BudgetOverview from '../../dashboard/budgetCategories/BudgetOverview';
import BudDashCategorieList from '../../dashboard/budgetCategories/BudDashCategorieList';
import NetWorthChart from '../../charts/NetWorthChart';
import { TransactionRow, TX_COLUMNS } from '../../../containers/Transactions';
import { groupByDay, dayLabel, dayNet } from '../../transactions/transactionDays';
import { formatMoney } from '../../helpers';
import { buildDemoState, buildDemoTransactions } from './demoState';

/**
 * Vitrina de la landing (plan/28 §10): los componentes REALES de la app con datos de ejemplo. Este archivo es un
 * trozo aparte (React.lazy en QuestionsDemo): trae Redux de la app, recharts y moment, y solo se descarga cuando la
 * vitrina entra en pantalla. Nada de esto va al bundle principal ni al HTML prerenderizado.
 *
 * - Store propio con el estado de ejemplo. Las acciones con thunk que los componentes piden al montarse no corren
 *   (devuelven una promesa resuelta con true, como un pedido que salió bien): nada llama a la API.
 * - Mientras la vitrina está montada, axios rechaza cualquier pedido que no sea público: un visitante sin sesión
 *   nunca le pega a la API privada aunque algún componente pida algo directo.
 * - Cada escena se centra en vertical y, si no cabe, se reduce lo justo (Fit).
 * - Todo va inerte: se ve, pero no se puede tocar ni navegar.
 */

const swallowThunks = () => (next) => (action) => (typeof action === 'function' ? Promise.resolve(true) : next(action));
const reducer = (state, action) => (action.type === 'demo/tab' ? { ...state, UI: { ...state.UI, active_report_tab: action.payload } } : state);
const store = createStore(reducer, buildDemoState(), applyMiddleware(swallowThunks));

const blockPrivate = (config) => {
  if (String(config.url || '').includes('/public/')) return config;
  return Promise.reject(new axios.Cancel('vitrina de la landing: sin llamadas privadas'));
};

const History = () => {
  const days = groupByDay(buildDemoTransactions()).slice(0, 3);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <span className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-gray-600 px-3 flex items-center text-sm text-ink-2 dark:text-gray-400">Buscar movimientos…</span>
      </div>
      {days.map(({ date, items }) => {
        const net = dayNet(items);
        return (
          <section key={date} className="border-t border-gray-200 dark:border-gray-700 first:border-t-0">
            <div className={`px-3 md:px-4 py-1.5 flex items-center justify-between gap-2 ${TX_COLUMNS} bg-gray-50 dark:bg-gray-900`}>
              <h3 className="lg:col-span-2 text-xs md:text-sm font-semibold text-ink-2 dark:text-gray-300">{dayLabel(date)}</h3>
              {net !== null && (
                <span className={`lg:col-start-3 lg:text-right text-xs md:text-sm font-semibold tabular-nums ${net > 0 ? 'text-money-in dark:text-money-in-dark' : 'text-money-out dark:text-money-out-dark'}`}>
                  {net > 0 ? '+' : ''}{formatMoney(net)}
                </span>
              )}
            </div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((tx) => <li key={tx.id}><TransactionRow tx={tx} onOpen={() => {}} account={tx.account} /></li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

// Presupuestos: el resumen y la lista de la página Presupuestos alternan solos entre Gastos e Ingresos
const Budgets = () => {
  useEffect(() => {
    store.dispatch({ type: 'demo/tab', payload: 'Expenses' });
    const t = setTimeout(() => store.dispatch({ type: 'demo/tab', payload: 'Income' }), 2800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="grid gap-3 lg:grid-cols-2 lg:items-start lg:w-[640px] [&>*]:min-w-0">
      <BudgetOverview />
      <BudDashCategorieList />
    </div>
  );
};

// Centra la escena en el espacio disponible y, si es más alta o más ancha (una escena puede pedir su ancho, como
// Presupuestos a 640 px), la reduce lo justo para que quepa completa. La escala solo baja dentro de una escena: al
// pasar de Gastos a Ingresos no cambia de tamaño.
const Fit = ({ children }) => {
  const box = useRef(null);
  const inner = useRef(null);
  const [fit, setFit] = useState({ scale: 1, top: 0, left: 0, width: null });
  useLayoutEffect(() => {
    const measure = () => {
      if (!box.current || !inner.current) return;
      const availH = box.current.clientHeight;
      const availW = box.current.clientWidth;
      const h = inner.current.offsetHeight;
      const w = Math.max(availW, inner.current.scrollWidth);
      setFit((prev) => {
        const scale = Math.min(prev.scale, h > availH ? Math.max(0.6, availH / h) : 1, w > availW ? availW / w : 1);
        return { scale, top: Math.max(0, (availH - h * scale) / 2), left: (availW - w * scale) / 2, width: w > availW ? w : null };
      });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(box.current); ro.observe(inner.current); }
    return () => ro?.disconnect();
  }, []);
  const wide = fit.width !== null;
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden">
      <div ref={inner} className="absolute"
        style={{
          top: fit.top, left: wide ? fit.left : 0, right: wide ? 'auto' : 0, width: wide ? fit.width : undefined,
          transformOrigin: wide ? 'top left' : 'top center', transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined,
        }}>
        {children}
      </div>
    </div>
  );
};

const SCENES = {
  falta: () => <div className="h-[380px]"><HomePaceCard /></div>,
  flujo: () => <div className="h-[300px]"><HomeFlowCard /></div>,
  presupuestos: Budgets,
  historial: History,
  patrimonio: () => (
    <div className="flex flex-col gap-3">
      <HomeNetWorthCard />
      <div className="h-[220px] bg-white dark:bg-gray-800 rounded-2xl shadow p-3"><NetWorthChart /></div>
    </div>
  ),
};

const DemoScenes = ({ id }) => {
  // el bloqueo se pone al primer render (antes de los efectos de los hijos) y se quita al desmontar
  const [guard] = useState(() => axios.interceptors.request.use(blockPrivate));
  useEffect(() => () => axios.interceptors.request.eject(guard), [guard]);
  const Scene = SCENES[id] || SCENES.falta;
  return (
    <Provider store={store}>
      <div inert className="qd-enter h-full pointer-events-none select-none">
        <Fit><Scene /></Fit>
      </div>
    </Provider>
  );
};

export default DemoScenes;
