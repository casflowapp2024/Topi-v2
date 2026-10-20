import { useMemo } from 'react';
import { connect } from 'react-redux';
import { formatCurrency } from '../../helpers';
import { PlusIcon } from '@heroicons/react/20/solid';

const BudDashBudgetSummary = ({ user_categories, setOpenCreateBox }) => {
    // Calculate Totals
    const totalExpenseBudget = useMemo(() => {
        const allExpenseCategories = user_categories && user_categories.items
            ? user_categories.items.filter(cat => !cat.isDefault && !cat.income)
            : [];
        return allExpenseCategories.reduce((acc, cat) => acc + (cat.budget || 0), 0);
    }, [user_categories]);

    const totalIncomeBudget = useMemo(() => {
        const allIncomeCategories = user_categories && user_categories.items
            ? user_categories.items.filter(cat => !cat.isDefault && cat.income)
            : [];
        return allIncomeCategories.reduce((acc, cat) => acc + (cat.budget || 0), 0);
    }, [user_categories]);

    return (
        <div className="w-full bg-white rounded-2xl shadow-md p-3 dark:bg-gray-800 transition-colors duration-300">
            <div className="flex flex-row justify-between items-center bg-slate-50 dark:bg-gray-700/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700 transition-colors duration-300">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Presupuesto Gastos</span>
                    <span className="text-base font-bold text-red-600 dark:text-red-400">{formatCurrency(totalExpenseBudget)}</span>
                </div>
                <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-600"></div>
                <div className="flex flex-col text-right">
                    <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Presupuesto Ingresos</span>
                    <span className="text-base font-bold text-[#5266EB] dark:text-indigo-400">{formatCurrency(totalIncomeBudget)}</span>
                </div>
            </div>

            {/* <button
                onClick={() => setOpenCreateBox(true)}
                className="mt-3 w-full flex items-center justify-between gap-2 px-4 p-2 bg-[#5266EB] hover:bg-indigo-600 text-white rounded-xl transition-all duration-200 shadow-sm hover:shadow-md group"
            >
                <span className="text-sm font-semibold">Agregar Presupuesto</span>
                <div className="p-1 bg-white/20 rounded-lg group-hover:scale-110 transition-transform">
                    <PlusIcon className="w-4 h-4 text-white" />
                </div>
            </button> */}
        </div>
    );
};

const mapStateToProps = (state) => ({
    user_categories: state.CashFlow.user_categories,
});

export default connect(mapStateToProps)(BudDashBudgetSummary);
