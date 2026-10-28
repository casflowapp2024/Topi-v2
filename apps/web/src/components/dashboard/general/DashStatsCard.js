import { Fragment, useEffect, useState, useRef } from 'react';

//redux
import { connect } from 'react-redux';
import { get_financial_report } from '../../../redux/actions/reports';
import { get_savings_account } from '../../../redux/actions/reports';
//components
import DropDownAccount from './DropDownAccounts';
import { formatMoney, getPerc2 } from '../../helpers';
import FormatMoneyShowDecs from '../../FormatMoneyShowDecs';
import {
    ArrowDownRightIcon,
    ArrowUpRightIcon,
    ShoppingBagIcon,
    WalletIcon,
    SparklesIcon,
    BanknotesIcon,
    CreditCardIcon
} from '@heroicons/react/24/solid';

import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

import Skeleton from '../../ui/Skeleton';
import { color } from 'framer-motion';

const DashStatsCard = ({
    loadingReport,
    metric_id,
    metric_state,
    up_pos,
    down_pos,

}) => {


    //appear info
    const tooltips = [
        {
            id: 0, title: "Tu Balance", icon: <WalletIcon className='w-5 h-5' />, colorClass: "bg-[#5266EB] text-white",
            content: "Es el balance actual de tus cuentas de ahorro: todo lo que has recibido menos lo que has gastado hasta ahora."
        },
        {
            id: 1, title: "Tus Deudas", icon: <CreditCardIcon className='w-5 h-5' />, colorClass: "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200",
            content: "Es el total que debes en tus tarjetas de crédito."
        },
        {
            id: 2, title: "Ingresos Mensuales", icon: <SparklesIcon className='w-5 h-5' />, colorClass: "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200",
            content: "Este es el total que has recibido este mes en tus cuentas de ahorro, clasificado como ingresos."
        },
        {
            id: 3, title: "Gastos Mensuales", icon: <ShoppingBagIcon className='w-5 h-5' />, colorClass: "bg-white text-gray-700 dark:bg-gray-900 dark:text-gray-200",
            content: "Todo lo que has gastado este mes en tus cuentas de ahorro y crédito, excluyendo categorías de ingresos."
        },
    ];

    const [activeTooltip, setActiveTooltip] = useState(null);
    const timeoutRef = useRef(null);

    const appearUp = (id) => {
        clearTimeout(timeoutRef.current); // Clear hide timeout if hovering another
        setActiveTooltip(id); // Set active tooltip to the hovered one
    };


    const disappearInfo = () => {
        timeoutRef.current = setTimeout(() => setActiveTooltip(null), 200); // Delay hiding
    };

    return (

        <div className={`${tooltips[metric_id].colorClass} relative group w-1/2 h-[150px] md:p-4 p-2  border border-gray-200 rounded-2xl shadow dark:border-gray-700 transition-colors duration-300`}>
            {metric_state ?
                <div className='flex flex-col'>
                    {/* top card */}
                    <div className='h-[69px] flex flex-row border-b border-gray-400 dark:border-gray-600/50 items-center pb-3'>
                        <div className='h-8 w-8 flex justify-center items-center'>
                            {tooltips[metric_id].icon}
                        </div>
                        <div className='flex flex-col pl-2'>
                            <h3 className='text-md'>{tooltips[metric_id].title}</h3>
                            {parseFloat(metric_state.vs_past_month) > 0 ?

                                <div className='flex flex-row items-center'>
                                    <div className={`${up_pos ? 'bg-green-500' : 'bg-rose-500'} flex justify-center items-center mr-1  w-3 h-3 rounded-sm`}>
                                        <ArrowUpRightIcon className='w-3 h-3 text-white' />
                                    </div>
                                    <span className={`font-light text-[10px] ${metric_id === 0 ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{getPerc2(metric_state.vs_past_month)} más que el mes anterior.</span>
                                </div>
                                :
                                <>
                                    {parseFloat(metric_state.vs_past_month) < 0 ?
                                        <div className='flex flex-row items-center'>
                                            <div className={`${down_pos ? 'bg-green-500' : 'bg-rose-500'} flex justify-center items-center mr-1  w-3 h-3 rounded-sm`}>
                                                <ArrowDownRightIcon className='w-3 h-3 text-white' />
                                            </div>
                                            <span className={`font-light text-[10px] ${metric_id === 0 ? 'text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>{getPerc2(metric_state.vs_past_month)} menos que el mes anterior.</span>
                                        </div> :
                                        <>
                                        </>

                                    }
                                </>
                            }

                        </div>
                    </div>
                    {/* bottom card */}
                    <div className='h-[48px] flex flex-row justify-between items-center mt-4'>
                        {loadingReport && !metric_state ?
                            <Skeleton className="h-6 w-3/4 mt-3" />
                            : <>
                                {metric_state ?
                                    <div aria-busy={loadingReport} className={`flex flex-row justify-between w-full items-end transition-opacity duration-200 ${loadingReport ? 'opacity-50' : ''}`}>
                                        <FormatMoneyShowDecs
                                            numb={metric_state.value}
                                            showDecimals={true}
                                            intClass={"text-[14px] md:text-[16px] xl:text-[20px]"}
                                            decClass={"text-[12px] md:text-[14px] xl:text-[16px]"}
                                        />
                                        <div
                                            className='cursor-pointer w-6 h-6 flex justify-center items-center'
                                            onMouseOver={() => appearUp(metric_id)}
                                            onMouseLeave={disappearInfo}
                                        >
                                            <QuestionMarkCircleIcon className='w-5 h-5' />
                                        </div>
                                    </div>
                                    : <span className='no info'></span>
                                }
                            </>
                        }
                    </div>
                </div> :
                <div className="flex flex-col gap-3 h-full justify-center"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-6 w-3/4" /></div>
            }
            {/* info tooltip */}
            <div
                className={`absolute z-50 left-0 top-0 w-auto mt-1 mx-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg shadow-md dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800
            transition-all duration-300 transform ${activeTooltip === metric_id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                    }`}
            >
                <div class="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-lg dark:border-gray-600 dark:bg-gray-700">
                    <h3 class="font-semibold text-gray-900 dark:text-white">{tooltips[metric_id].title}</h3>
                </div>
                <div class="px-3 py-2">
                    <p>{tooltips[metric_id].content}</p>
                </div>
            </div>
        </div>

    );
};

const mapStateToProps = (state) => ({


});

export default connect(mapStateToProps, {


})(DashStatsCard);


