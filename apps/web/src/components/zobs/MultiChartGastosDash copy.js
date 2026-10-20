import { useEffect, useState } from 'react'
import moment from  'moment'
//redux
import { connect } from 'react-redux'

//components
import { formatCurrency, parseDate1, formatCurrency2, getPerc0 } from '../helpers';

//icons
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function MultiChartGastosDash({
    monthlyActivated,
    dailyActivated,
    daily_expense,
    inst_daily_expense,
    monthly_expense,
    day_date,
    month,
    current_Year,
    expense_budget,
    current_Month
}) {


    const [dataToPlot, setDataToPlot] = useState(null)

    
    useEffect(() => {
            moment.locale('es');
            let formattedActual = [];
    
            console.log("not formatted", monthly_expense, month);
    
            if (monthly_expense && monthlyActivated) {
            formattedActual = month.map((m, i) => ({
                date: new Date(current_Year, m - 1, 1), // ✅ Safari-safe
                value: monthly_expense[i].value,
                show_cum: -monthly_expense[i].value,
                //dif: monthly_income[i].diff,
                //per_show: getPercPlus(monthly_income[i].percentage),
                //color_per: getColorByValue(monthly_income[i].diff),
                left: getPerc0(monthly_expense[i].usage)
            }));
            } else if (daily_expense && dailyActivated) {
                formattedActual = day_date.map((d, i) => ({
                    date: parseDate1(d, "YYYY-MM-DD"), // ✅ Safari-safe
                    show_cum: -(daily_expense[i]-inst_daily_expense[i]),
                    value_cum: daily_expense[i],
                    show_inst: -inst_daily_expense[i],
                    value: inst_daily_expense[i],

                }));
            }
    
            setDataToPlot(formattedActual);
            console.log("formattedActual", formattedActual);
        }, [monthlyActivated, dailyActivated, daily_expense]);
    
    const [activeIndex, setActiveIndex] = useState(null);
    //#e11d48
    return (
        <div className='h-[220px] w-[370px] md:w-[400px]  xl:w-[500px]'>

            <ResponsiveContainer width="100%" height="100%">
            <BarChart
            width={420}
            height={300}
            data={dataToPlot}
            margin={{
                top: 30,
                right: 18,
                left: 18,
                bottom: 5,
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
            <Tooltip
            cursor={false}
            content={({ active, payload }) => {
            if (active && payload && payload.length) {
                return (
                <div className="flex flex-col text-xs bg-white border border-gray-300 rounded-lg p-2">
                    {monthlyActivated?
                    <div className='flex flex-col'>
                        {/* <span className=''>Mes: {moment(payload[0].payload.date).format('MMM')}</span> */}
                        <span className='text-[#fcd34d]'>Presupuesto: {formatCurrency(expense_budget)}</span>
                        <div className='text-gray-300'>
                            <span className='text-[#eb7852]'>Gastos: {formatCurrency(payload[0].payload.value)}</span> 
                            {/* (<span className={`text-[${payload[0].payload.color_per}]`}>{payload[0].payload.per_show}</span>) */}
                        </div>
                        
                        <span className=''>Gastados: {payload[0].payload.left}</span>
                        {/* <span className=''>Dif: {formatCurrency(payload[0].payload.dif)}</span> */}
                    </div>
                    :
                    <>
                        {/* <span className=''>Día: {moment(payload[0].payload.date).format('MMM DD')}</span> */}
                        <span className='text-[#fcd34d]'>Presupuesto: {formatCurrency(expense_budget)}</span>
                        <span className='text-[#eb7852]'>Gasto accumulado: {formatCurrency(payload[0].payload.value_cum)}</span>
                        <span className='text-[#5266eb]'>Gasto: {formatCurrency(payload[0].payload.value)}</span>
                    
                    </>

                    }
                    
                    
                </div>
                );
            }
            return null;
            }}
        
            />

            {dailyActivated && (
                <Bar
                    dataKey="show_inst"
                    stackId="a"
                    fill="#5266eb"
                    barSize={24} // Adjust width here
                    radius={[1.5, 1.5, 0, 0]} // Rounded top corners
                    //onMouseOver={(_, index) => setActiveIndex(index)}
                    //onMouseOut={() => setActiveIndex(null)}
                    shape={(props) => (
                        <Rectangle
                        {...props}
                        stroke={props.index === activeIndex ? "#5266eb" : ""} // Border color
                        strokeWidth={2}  // Border width
                        fill="#5266eb"
                        radius={[1.5, 1.5, 0, 0]}
                        opacity={1}
                        />
                    
                    )}
                />
            )}
                

            
            <Bar
                dataKey="show_cum"
                stackId="a"
                fill="#eb7852"
                barSize={24} // slightly wider so it shows behind
                radius={[6, 6, 0, 0]}
                opacity={1} // make it transparent so overlap is visible
                shape={(props) => (
                        <Rectangle
                        {...props}
                        stroke={props.index === activeIndex ? "#eb7852" : ""} // Border color
                        strokeWidth={2}  // Border width
                        fill="#eb7852"
                        radius={[6, 6, 0, 0]}
                        
                        />
                    
                    )}
                label={({ x, y, width, value, index }) => {
                    // Only show label for the last bar
                    if (index === dataToPlot.length - 1) {
                    return (
                        <text
                        x={x + width / 2}
                        y={y -8}
                        textAnchor="middle"
                        fill="#5266eb"
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
                y={expense_budget}
                stroke="#fcd34d"
                strokeWidth={2}
                strokeDasharray="10 4"
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
    daily_expense: state.Reports.history_dash.daily.mtd_expense,
    inst_daily_expense: state.Reports.history_dash.daily.expense,
    monthly_expense: state.Reports.history_dash.monthly.expense,
    monthly_expense_dif: state.Reports.history_dash.monthly.expense_diff,
    expense_budget: state.Reports.history_dash.expense_budget,
    day_date: state.Reports.history_dash.daily.date,
    month: state.Reports.history_dash.monthly.month,
    current_Year: state.Reports.current_Year,
    current_Month: state.Reports.current_Month,
    
    

  })
  
  export default connect(mapStateToProps,{

  
  }) (MultiChartGastosDash)
