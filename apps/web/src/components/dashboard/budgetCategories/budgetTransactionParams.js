import { parseDatetimetoDateStrFormat } from '../../helpers';

/**
 * Filtros de los movimientos que muestra Presupuestos: los de la categoría elegida o, sin categoría,
 * los del mes del lado que se está viendo (gastos o ingresos). Lo usan la vista y el detalle de una
 * transacción al recargar después de un cambio, para que pidan exactamente lo mismo.
 */
export const budgetTransactionParams = ({ category_activated, active_report_tab, current_Year, current_Month }) => {
    const params = [];
    if (category_activated?.category_id != null) params.push(`categories=${[category_activated.category_id]}`);
    else params.push(`expense=${active_report_tab === 'Expenses'}`);
    params.push(`init_date=${parseDatetimetoDateStrFormat(new Date(current_Year, current_Month - 1, 1), "YYYY-MM-DD HH:mm:ss Z")}`);
    params.push(`end_date=${parseDatetimetoDateStrFormat(new Date(current_Year, current_Month, 0), "YYYY-MM-DD HH:mm:ss Z")}`);
    return params.join("&");
};
