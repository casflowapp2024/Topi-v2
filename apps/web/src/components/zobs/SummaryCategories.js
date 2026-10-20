import React from 'react';
import { useSelector } from 'react-redux';
import { formatCurrency } from '../helpers';

const SummaryCategories = () => {
    const userCategories = useSelector(state => state.CashFlow.user_categories);

    if (!userCategories || !userCategories.items) {
        return null;
    }

    const items = userCategories.items;

    const incomeTotal = items
        .filter(item => !item.isDefault && item.income)
        .reduce((sum, item) => sum + (item.budget || 0), 0);

    const expenseTotal = items
        .filter(item => !item.isDefault && !item.income)
        .reduce((sum, item) => sum + (item.budget || 0), 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full my-4">
            {/* Income Card */}
            <div className="flex flex-col p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ingresos Planeados</span>
                </div>
                <span className="text-2xl font-black text-green-600">{formatCurrency(incomeTotal)}</span>
                {/* <p className="text-[10px] text-gray-400 mt-1 italic">Presupuesto mensual proyectado</p> */}
            </div>

            {/* Expense Card */}
            <div className="flex flex-col p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gastos Planeados</span>
                </div>
                <span className="text-2xl font-black text-red-600">{formatCurrency(expenseTotal)}</span>
                {/* <p className="text-[10px] text-gray-400 mt-1 italic">Límite mensual establecido</p> */}
            </div>
        </div>
    );
};

export default SummaryCategories;
