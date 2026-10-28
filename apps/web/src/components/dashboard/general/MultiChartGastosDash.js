import { use, useEffect, useState } from 'react'
import moment from  'moment'
//redux
import { connect } from 'react-redux'

//components
import { formatCurrency, parseDatetoDatetimeBrow, formatCurrency2, getPerc0, getColorByValue, getPercPlus} from '../../helpers';

//icons
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function MultiChartGastosDash({
    //props
    monthlyActivated,
    dailyActivated,
    cummulated,
    windowContext,
    by = "all",
    //reduxstates
    expense_budget,
    day_date,
    daily_expense,
    inst_daily_expense,
    month,
    monthly_expense,
    //by category
    cat_expense_budget,
    cat_months,
    cat_monthly_expense,
    //date fitlers
    current_Year,
    current_Month
}) {


    const [dataToPlot, setDataToPlot] = useState(null)
    const [budgetToUse, setBudgetToUse] = useState(expense_budget)

    useEffect(() => {
        if (by === "category"){
            setBudgetToUse(cat_expense_budget)
        }else{
            setBudgetToUse(expense_budget)
        }
    }, [by, expense_budget, cat_expense_budget]);

    
    useEffect(() => {

            let formattedActual =  [{
                    date: new Date(current_Year, current_Month - 1, 1),
                    value: 0,
                    dif: 0,
                    show: 0,
                    left: 0,
                    per_show: getPercPlus(0),
                    color_per: getColorByValue(0)}];

            let months_serie , expense_serie ;

            if (by === "category"){
                months_serie = cat_months
                expense_serie = cat_monthly_expense
            }else{
                months_serie = month
                expense_serie = monthly_expense
            }
            
    
            //console.log("not formatted", monthly_expense, month);
    
            if (expense_serie && monthlyActivated && months_serie && months_serie.length>0) {
            formattedActual = months_serie.map((m, i) => ({
                date: new Date(current_Year, m - 1, 1), // ✅ Safari-safe
                value: expense_serie[i].value,
                show: -expense_serie[i].value,
                //dif: monthly_income[i].diff,
                //per_show: getPercPlus(monthly_income[i].percentage),
                //color_per: getColorByValue(monthly_income[i].diff),
                left: getPerc0(expense_serie[i].usage)
            }));
            } else if (daily_expense && dailyActivated && !cummulated && day_date && day_date.length>0) {
                formattedActual = day_date.map((d, i) => ({
                    date: parseDatetoDatetimeBrow(d, "YYYY-MM-DD"), // ✅ Safari-safe
                    show: -daily_expense[i],
                    value: daily_expense[i],

                }));
            } else if (daily_expense && dailyActivated && cummulated && day_date && day_date.length>0) {
                formattedActual = day_date.map((d, i) => ({
                    date: parseDatetoDatetimeBrow(d, "YYYY-MM-DD"), // ✅ Safari-safe
                    show: -inst_daily_expense[i],
                    value: inst_daily_expense[i],

                }));
            }
            setDataToPlot(formattedActual);
            //console.log("formattedActual", formattedActual);
        }, [monthlyActivated, dailyActivated, cat_expense_budget, daily_expense, cummulated, by]);
    
    const [activeIndex, setActiveIndex] = useState(null);
    //#e11d48
    return (
        <div className={`${windowContext==="dashboard"? 'h-[220px]' : 'h-[150px]'} w-[370px] md:w-[400px]  xl:w-[500px]`}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
            width={420}
            height={300}
            data={dataToPlot}
            margin={{
                top: 30,
                right: 25,
                left: 0,
                bottom: 1,
            }}
            onMouseMove={state => {
                if (state && state.activeTooltipIndex !== undefined && state.activeTooltipIndex !== null) {
                setActiveIndex(state.activeTooltipIndex);
                }
            }}
            onMouseLeave={() => setActiveIndex(null)}
            
            >
            <XAxis
                dataKey="date"
                tickFormatter={(date) => {
                                    if (monthlyActivated) {
                                    return moment(date).locale("es").format('MMM'); // monthly format
                                    } else if (dailyActivated) {
                                    return moment(date).locale("es").format('D'); // daily format
                                    }
                                    return moment(date).locale("es").format('D'); // fallback
                                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                domain={['auto', 'auto']}
                tick={{ fontSize: 12 }}
            />
            <CartesianGrid vertical={false} />
            <YAxis width={44} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickCount={4} tickFormatter={(v) => formatCurrency2(v)} />
            <Tooltip
            cursor={false}
            content={({ active, payload }) => {
            if (active && payload && payload.length) {
                return (
                <div className="flex flex-col gap-0.5 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
                    {monthlyActivated?
                    <div className='flex flex-col'>
                        {/* <span className=''>Mes: {moment(payload[0].payload.date).format('MMM')}</span> */}
                        <span className='text-ink-2 dark:text-gray-400'>Presupuesto: {formatCurrency(budgetToUse)}</span>
                        <div>
                            <span className='font-semibold text-money-out dark:text-money-out-dark'>Gastos: {formatCurrency(payload[0].payload.value)}</span> 
                            {/* (<span style={{ color: payload[0].payload.color_per }}>{payload[0].payload.per_show}</span>) */}
                        </div>
                        <span className=''>Gastados: {payload[0].payload.left}</span>
                        {/* <span className=''>Dif: {formatCurrency(payload[0].payload.dif)}</span> */}
                    </div>
                    :
                    <>
                        {/* <span className=''>Día: {moment(payload[0].payload.date).format('MMM DD')}</span> */}
                        <span className='text-ink-2 dark:text-gray-400'>Presupuesto: {formatCurrency(budgetToUse)}</span>
                        <span className='font-semibold text-money-out dark:text-money-out-dark'>Gastos: {formatCurrency(payload[0].payload.value)}</span>
                    </>
                    }
                </div>
                );
            }
            return null;
            }}
            
            
            />
            <Bar
                dataKey="show"
                fill="#F2664A"
                barSize={24} // Adjust width here
                radius={[6, 6, 0, 0]} // Rounded top corners
                //onMouseOver={(_, index) => setActiveIndex(index)}
                //onMouseOut={() => setActiveIndex(null)}
                shape={(props) => (
                    <Rectangle
                    {...props}
                    fillOpacity={activeIndex === null || props.index === activeIndex ? 1 : 0.45}
                    fill="#F2664A"
                    radius={[6, 6, 0, 0]}
                    />
                
                )}

                label={({ x, y, width, value, index }) => {
                    // Only show label for the last bar
                    if (index === dataToPlot.length - 1 && value !== 0) {
                    return (
                        <text
                        x={x + width / 2}
                        y={value >= 0 ? y - 8 : y + 20}
                        textAnchor="middle"
                        className="topi-chart-value"
                        fontWeight="bold"
                        fontSize={13}
                        >
                        {formatCurrency2(value)}
                        </text>
                    );
                    }
                    return null;
                }}
                />
                {dataToPlot && dataToPlot.length > 0 && (
                
                <ReferenceLine
                y={budgetToUse}
                className="topi-budget-line"
                stroke="#8A90A8"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                ifOverflow={dailyActivated && !cummulated ? "discard" : "extendDomain"}
                label={{ value: "Presupuesto", position: "insideTopLeft", className: "topi-budget-label", fontSize: 11, fontWeight: 600 }}
                >
                {/* <Label
                    value={`${formatCurrency(expense_budget)}`}
                    position="right"
                    fill="#fcd34d"
                    fontWeight="bold"
                    fontSize={10}
                    offset={10}
                />*/}
                </ReferenceLine> 
                    
                
                
            )}

            </BarChart>
        </ResponsiveContainer>
        </div>
  );
}

  const mapStateToProps = state => ({
    daily_expense: state.Reports.history_dash.daily.expense,
    inst_daily_expense: state.Reports.history_dash.daily.mtd_expense,
    monthly_expense: state.Reports.history_dash.monthly.expense,
    monthly_expense_dif: state.Reports.history_dash.monthly.expense_diff,
    expense_budget: state.Reports.history_dash.expense_budget,
    day_date: state.Reports.history_dash.daily.date,
    month: state.Reports.history_dash.monthly.month,
    //by category
    cat_expense_budget: state.Reports.history_category.budget,
    cat_monthly_expense: state.Reports.history_category.monthly.expense,
    cat_months: state.Reports.history_category.monthly.month,

    //date fitlers
    current_Year: state.Reports.current_Year,
    current_Month: state.Reports.current_Month,
  })
  
  export default connect(mapStateToProps,{

  
  }) (MultiChartGastosDash)
