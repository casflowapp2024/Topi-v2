import { use, useEffect, useState } from 'react'
import moment from 'moment'
//redux
import { connect } from 'react-redux'
import { get_history_dash, get_history_category_by_month } from '../../../redux/actions/reports';
//components
import { formatMoney } from '../../helpers';
import MultiChartBalanceDash from './MultiChartBalanceDash';
import MultiChartGastosDash from './MultiChartGastosDash';
import MultiChartIncomesDash from './MultiChartIncomesDash';
import MultiChartSavingsDash from './MultiChartSavingsDash';

//icons
import { SkeletonChart } from '../../ui/Skeleton';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';


function MultiChartDash({
    get_history_dash,
    get_history_category_by_month,
    history_balance,
    history_dash,
    history_category,
    current_Month,
    current_Year,
}) {
    useEffect(() => {
        const date_filter = `${current_Year}-${current_Month.toString().padStart(2, '0')}`
        get_history_dash(date_filter);
        get_history_category_by_month(1, date_filter);
    }, [current_Month, current_Year]);

    //change tab
    const [balanceActivated, setBalanceActivated] = useState(true)
    const [incomesActivate, setIncomesActivated] = useState(false)
    const [expensesActivated, setExpensesActivated] = useState(false)
    const [savingsActivated, setSavingsActivated] = useState(false)
    const [cummulated, setCummulated] = useState(false)

    const onChangeTab = (tab) => {
        if (tab === 1) {
            setBalanceActivated(true)
            setIncomesActivated(false)
            setExpensesActivated(false)
            setSavingsActivated(false)
            setCummulated(false)
        } else if (tab === 2) {
            setBalanceActivated(false)
            setIncomesActivated(true)
            setExpensesActivated(false)
            setSavingsActivated(false)
        } else if (tab === 3) {
            setBalanceActivated(false)
            setIncomesActivated(false)
            setExpensesActivated(true)
            setSavingsActivated(false)
        } else if (tab === 4) {
            setBalanceActivated(false)
            setIncomesActivated(false)
            setExpensesActivated(false)
            setSavingsActivated(true)
            setCummulated(false)
        }
    };
    //change period

    const [monthlyActivated, setMonthlyActivated] = useState(true)
    const [dailyActivated, setDaylyActivated] = useState(false)

    const onChangePeriod = (period) => {
        if (period === 1) {
            setMonthlyActivated(true)
            setDaylyActivated(false)
            setCummulated(false)
        } else if (period === 2) {
            setMonthlyActivated(false)
            setDaylyActivated(true)
        }
    };


    return (

        <div className="h-[310px] sm:h-[300px] flex flex-col items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow overflow-hidden transition-colors duration-300">

            {/* Navigation Tabs */}
            <div className="px-4 w-full flex flex-row justify-between gap-4 text-sm font-semibold border-b border-gray-200 dark:border-gray-700">
                <span className={`${balanceActivated ? "border-b-2 border-[#5266EB] text-[#5266EB]" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"} pt-3 py-1 transition-colors cursor-pointer w-1/4 text-center`}
                    onClick={() => onChangeTab(1)}
                >Balance</span>
                {/* <span className="text-gray-500 cursor-pointer">VERIFICACIÓN</span> */}
                <span className={`${incomesActivate ? "border-b-2 border-[#5266EB] text-[#5266EB]" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"} pt-3 py-1 transition-colors cursor-pointer w-1/4 text-center`}
                    onClick={() => onChangeTab(2)}
                >Ingresos</span>
                <span className={`${expensesActivated ? "border-b-2 border-[#5266EB] text-[#5266EB]" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"} pt-3 py-1 transition-colors cursor-pointer w-1/4 text-center`}
                    onClick={() => onChangeTab(3)}
                >Gastos</span>
                <span className={`${savingsActivated ? "border-b-2 border-[#5266EB] text-[#5266EB]" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"} pt-3 py-1 transition-colors cursor-pointer w-1/4 text-center`}
                    onClick={() => onChangeTab(4)}
                >Ahorro</span>
                {/* <span className="text-gray-500 cursor-pointer">LÍMITES</span> */}
            </div>

            {history_dash && history_category ?
                <>
                    {balanceActivated ?
                        <MultiChartBalanceDash
                            monthlyActivated={monthlyActivated}
                            dailyActivated={dailyActivated}
                        /> : <></>
                    }
                    {incomesActivate ?
                        <MultiChartIncomesDash
                            monthlyActivated={monthlyActivated}
                            dailyActivated={dailyActivated}
                            cummulated={cummulated}
                        /> : <></>
                    }
                    {expensesActivated ?
                        <MultiChartGastosDash
                            monthlyActivated={monthlyActivated}
                            dailyActivated={dailyActivated}
                            cummulated={cummulated}
                            windowContext="dashboard"
                        /> : <></>
                    }

                    {savingsActivated ?
                        <MultiChartSavingsDash
                            monthlyActivated={monthlyActivated}
                            dailyActivated={dailyActivated}
                        /> : <></>
                    }

                </> :
                <div className="flex-1 w-full"><SkeletonChart /></div>

            }

            <div className='w-full flex flex-row justify-around text-sm border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 pt-1'>

                <span className={`${monthlyActivated ? "border-b-2 border-[#5266EB] text-[#5266EB] dark:text-[#7f8df2]" : "text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"} py-1 transition-colors w-[40%] text-center`}
                    onClick={() => onChangePeriod(1)}
                >Mensual</span>
                {/* <span className="text-gray-500 cursor-pointer">VERIFICACIÓN</span> */}
                {incomesActivate || expensesActivated ?
                    <div className={`${dailyActivated ? "border-b-2 border-[#5266EB] text-[#5266EB] dark:text-[#7f8df2]" : "text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"} py-1 transition-colors w-[40%] text-center flex flex-row justify-center items-center gap-3`}
                        onClick={() => onChangePeriod(2)}>
                        {dailyActivated ?
                            <div
                                className='cursor-pointer hover:text-[#5266EB] dark:hover:text-[#7f8df2] transition-colors'
                                onClick={() => setCummulated(!cummulated)}
                            >
                                <ChevronLeftIcon className='w-4 h-4' />
                            </div> : <></>
                        }
                        {cummulated ?
                            <span className='flex-inline'>Diario Acum.</span> :
                            <span>Diario</span>
                        }
                        {dailyActivated ?
                            <div
                                className='cursor-pointer hover:text-[#5266EB] dark:hover:text-[#7f8df2] transition-colors'
                                onClick={() => setCummulated(!cummulated)}>
                                <ChevronRightIcon className='w-4 h-4' />

                            </div> : <></>
                        }
                    </div> :
                    <div className={`${dailyActivated ? "border-b-2 border-[#5266EB] text-[#5266EB] dark:text-[#7f8df2]" : "text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"} py-1 transition-colors w-[40%] text-center`}
                        onClick={() => onChangePeriod(2)}>
                        <span>Diario</span>
                    </div>
                }
            </div>
        </div>

    )
}


const mapStateToProps = state => ({
    user_balances: state.CashFlow.user_balances,
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    history_balance: state.Reports.history_balance,
    history_dash: state.Reports.history_dash,
    history_category: state.Reports.history_category,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,


})

export default connect(mapStateToProps, {
    get_history_dash,
    get_history_category_by_month

})(MultiChartDash)
