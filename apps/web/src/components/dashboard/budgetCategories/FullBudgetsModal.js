import React, { useMemo } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency, capitalizeWords } from '../../helpers';
import { Emoji } from "emoji-picker-react";

const FullBudgetsModal = ({ isOpen, onClose, categories }) => {
    const totalBudget = useMemo(() => {
        return categories.reduce((sum, cat) => sum + (Math.abs(cat.budget) || 0), 0);
    }, [categories]);

    const sortedByBudget = useMemo(() => {
        return [...categories].sort((a, b) => Math.abs(b.budget || 0) - Math.abs(a.budget || 0));
    }, [categories]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-white dark:bg-gray-900 flex flex-col animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Panorama de Presupuestos</h2>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                >
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="max-w-5xl mx-auto">
                    {/* Total Summary Card */}
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-6 md:p-10 mb-8 flex flex-col items-center justify-center text-center shadow-sm">
                        <span className="text-sm md:text-base font-medium text-indigo-600 dark:text-indigo-400 mb-2 uppercase tracking-wider">
                            Presupuesto Total
                        </span>
                        <span className="text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                            {formatCurrency(totalBudget)}
                        </span>
                    </div>

                    {/* Grid of Categories */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {sortedByBudget.map((category) => (
                            <div
                                key={category.category_id}
                                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 flex items-center shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="flex items-center justify-center w-14 h-14 bg-gray-50 dark:bg-gray-700/50 rounded-full mr-4 shrink-0">
                                    {category.emoji && category.emoji !== "" ? (
                                        <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={28} />
                                    ) : (
                                        <span className="text-2xl">📁</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate" title={capitalizeWords(category.name)}>
                                        {capitalizeWords(category.name)}
                                    </h3>
                                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                        {formatCurrency(Math.abs(category.budget || 0))}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FullBudgetsModal;
