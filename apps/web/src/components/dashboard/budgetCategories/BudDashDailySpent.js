import { useEffect, useState } from 'react'
import moment from 'moment'
//redux
import { connect } from 'react-redux'

//components
import { formatMoney, parseDatetoDatetimeBrow, formatMoneyCompact, getPerc0, getColorByValue, getPercPlus } from '../../helpers';
import MultiChartGastosDash from '../general/MultiChartGastosDash';
import { ThreeDots } from 'react-loader-spinner';
//icons
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';

function BudDashDailySpent({

    history_dash,
    history_category,
    category_activated,
    activeChartTab,
    setActiveChartTab
}) {

    const [totalExpensesActivated, setTotalExpensesActivated] = useState(true)
    const [categoryExpensesAct, setCategoryExpensesAct] = useState(false)
    const [cummulated, setCummulated] = useState(false)

    useEffect(() => {
        if (activeChartTab === 1) {
            setTotalExpensesActivated(true)
            setCategoryExpensesAct(false)
            setCummulated(false)
        } else if (activeChartTab === 2) {
            setTotalExpensesActivated(false)
            setCategoryExpensesAct(true)
            setMonthlyActivated(true)
            setDaylyActivated(false)
            setCummulated(false)
        }
    }, [activeChartTab]);

    const onChangeTab = (tab) => {
        if (setActiveChartTab) {
            setActiveChartTab(tab);
        } else {
            // Fallback for internal state if props are not provided
            if (tab === 1) {
                setTotalExpensesActivated(true)
                setCategoryExpensesAct(false)
                setCummulated(false)
            } else if (tab === 2) {
                setTotalExpensesActivated(false)
                setCategoryExpensesAct(true)
                setMonthlyActivated(true)
                setDaylyActivated(false)
                setCummulated(false)
            }
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


    //#e11d48
    return (

        <div className="h-[220px] sm:h-[228px] flex flex-col items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow overflow-hidden transition-colors duration-300">

            {/* TOTAL POR CATEGORIA */}

            <div className="px-4 w-full flex flex-row justify-around gap-4 items-center text-xs md:text-sm font-semibold border-b border-gray-100 dark:border-gray-700 transition-colors duration-300">
                <div className={`${totalExpensesActivated ? "border-b-2 border-[#5266EB] text-[#5266EB] dark:text-[#7f8df2]" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"} h-full pd-2 md:pt-3 py-1 cursor-pointer w-1/2 text-center flex items-center justify-center transition-colors`}
                    onClick={() => onChangeTab(1)}
                >
                    <span>Gasto Total</span>
                </div>
                <div className={`${categoryExpensesAct ? "border-b-2 border-[#5266EB] text-[#5266EB] dark:text-[#7f8df2]" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"} h-full pd-2 md:pt-3 py-1  cursor-pointer w-1/2 text-center flex items-center justify-center transition-colors`}
                    onClick={() => onChangeTab(2)}
                >
                    <span>Gasto - {category_activated?.name}</span>
                </div>
            </div>

            {/* GRAFICA */}

            {history_dash && history_category ?
                <>

                    {totalExpensesActivated ?
                        <MultiChartGastosDash
                            monthlyActivated={monthlyActivated}
                            dailyActivated={dailyActivated}
                            cummulated={cummulated}
                            windowContext="presupuestos"
                        /> : <></>
                    }
                    {categoryExpensesAct ?
                        <MultiChartGastosDash
                            monthlyActivated={monthlyActivated}
                            dailyActivated={dailyActivated}
                            cummulated={cummulated}
                            by="category"
                            windowContext="presupuestos"
                        />
                        : <></>
                    }

                </> :
                <div className='text-gray-500 flex justify-center items-center'>
                    <ThreeDots
                        height="40"
                        width="40"
                        color="#6b7280"
                        ariaLabel="loading"
                    />
                </div>

            }



            {/* MES / DIARIO */}

            <div className='w-full flex flex-row justify-around text-xs md:text-sm border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 pt-1 transition-colors duration-300'>

                <span className={`${monthlyActivated ? "border-b-2 border-[#5266EB] text-[#5266EB] dark:text-[#7f8df2]" : "text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200"} py-1 transition-colors w-[40%] text-center`}
                    onClick={() => onChangePeriod(1)}
                >Mensual</span>
                {/* <span className="text-gray-500 cursor-pointer">VERIFICACIÓN</span> */}


                {!categoryExpensesAct &&
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
                    </div>
                }


            </div>


        </div>
    );
}

const mapStateToProps = state => ({
    daily_expense: state.Reports.history_dash.daily.expense,
    inst_daily_expense: state.Reports.history_dash.daily.mtd_expense,
    expense_budget: state.Reports.history_dash.expense_budget,
    day_date: state.Reports.history_dash.daily.date,
    month: state.Reports.history_dash.monthly.month,
    current_Month: state.Reports.current_Month,
    current_Year: state.Reports.current_Year,
    history_dash: state.Reports.history_dash,
    history_category: state.Reports.history_category,
    category_activated: state.Reports.category_activated
})

export default connect(mapStateToProps, {


})(BudDashDailySpent)
