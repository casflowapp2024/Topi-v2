import React from 'react';
import { formatCurrency } from '../../helpers';


import { WalletIcon, FireIcon, BanknotesIcon } from '@heroicons/react/20/solid';

const SummaryCard = ({ title, value, icon, colorClass }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:shadow-lg transition-shadow duration-300">
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <div className={`p-1 rounded-full dark:${colorClass.replace('text-', 'bg-').replace('500', '500/20')}`}>
        {icon}
      </div>
    </div>
    <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
  </div>
);

const ArrowUpIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
const ArrowDownIcon = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>;


const AccSummaryCard = ({ acc, data }) => {
  const balance = data?.balance?.value ?? 0;
  const savings = data?.savings?.value ?? 0;
  const income = data?.income?.value ?? 0;
  const expenses = data?.expenses?.value ?? 0;

  return (
    <div>
      <h2 className="text-md font-bold mb-4 text-gray-800 dark:text-gray-100">Resumen de la cuenta</h2>
      <div className="grid grid-cols-2 gap-4">
        <SummaryCard
          title="Saldo final"
          value={formatCurrency(balance)}
          icon={<BanknotesIcon className="w-4 h-4" />}
          colorClass="text-[#5266EB]"
        />
        {acc?.type?.id === 4 ?
          <div></div> :
          <SummaryCard
            title="Ahorro"
            value={formatCurrency(savings)}
            icon={<FireIcon className="w-4 h-4" />}
            colorClass="text-[#5266EB]"
          />
        }
        {acc?.type?.id === 4 ?
          <SummaryCard
            title="Pagos"
            value={formatCurrency(income)}
            icon={<ArrowUpIcon className="w-4 h-4" />}
            colorClass="text-green-500"
          /> :
          <SummaryCard
            title="Ingresos"
            value={formatCurrency(income)}
            icon={<ArrowUpIcon className="w-4 h-4" />}
            colorClass="text-green-500"
          />
        }
        <SummaryCard
          title="Gastos"
          value={formatCurrency(expenses)}
          icon={<ArrowDownIcon className="w-4 h-4" />}
          colorClass="text-red-500"
        />
      </div>
    </div>
  );
};

export default AccSummaryCard;