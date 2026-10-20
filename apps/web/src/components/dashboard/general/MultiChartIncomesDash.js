import { useEffect, useState } from 'react'
import moment from  'moment'
//redux
import { connect } from 'react-redux'
//components
import { formatCurrency, formatCurrency2, parseDatetoDatetimeBrow, getColorByValue, getPercPlus, getPerc0 } from '../../helpers';
//icons
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function MultiChartIncomesDash({
    monthlyActivated,
    dailyActivated,
    cummulated,
    daily_income,
    inst_daily_income,
    monthly_income,
    day_date,
    month,
    current_Year,
    current_Month,
    income_budget
}) {

    const [dataToPlot, setDataToPlot] = useState(null)

    useEffect(() => {
            //moment.locale('es');
            let formattedActual =  [{
                    date: new Date(current_Year, current_Month - 1, 1),
                    value: 0,
                    dif: 0,
                    left: 0,
                    per_show: getPercPlus(0),
                    color_per: getColorByValue(0)}];
                
            //console.log(formattedActual)
    
            //console.log("not formatted", monthly_income, month);
    
            if (monthly_income && monthlyActivated && month && month.length>0) {
                formattedActual = month.map((m, i) => ({
                    date: new Date(current_Year, m - 1, 1), // ✅ Safari-safe
                    value: monthly_income[i].value,
                    //dif: monthly_income[i].diff,
                    //per_show: getPercPlus(monthly_income[i].percentage),
                    //color_per: getColorByValue(monthly_income[i].diff),
                    left: getPerc0(monthly_income[i].usage)
                }));
            } else if (daily_income && dailyActivated && !cummulated && day_date && day_date.length>0) {
                formattedActual = day_date.map((d, i) => ({
                    date: parseDatetoDatetimeBrow(d, "YYYY-MM-DD"),
                    value: inst_daily_income[i],
                }));
            } else if (daily_income && dailyActivated && cummulated && day_date && day_date.length>0) {
                formattedActual = day_date.map((d, i) => ({
                    date: parseDatetoDatetimeBrow(d, "YYYY-MM-DD"), // ✅ Safari-safe
                    value: daily_income[i],

                }));
            }
            setDataToPlot(formattedActual);
            //console.log("formattedActual", formattedActual);
        }, [monthlyActivated, dailyActivated, daily_income, cummulated]);
    
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
                right: 20,
                left: 20,
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
                                    //console.log(moment(date))
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
                        <span className='text-[#fcd34d]'>Presupuesto: {formatCurrency(income_budget)}</span>
                        <div className='text-gray-300'>
                            <span className='text-[#30a349]'>Ingresos: {formatCurrency(payload[0].payload.value)}</span> 
                            {/* (<span className={`text-[${payload[0].payload.color_per}]`}>{payload[0].payload.per_show}</span>) */}
                        </div>
                        <span className=''>Recibidos: {payload[0].payload.left}</span>
                        {/* <span className=''>Dif: {formatCurrency(payload[0].payload.dif)}</span> */}
                    </div>
                    :
                    <>
                        {/* <span className=''>Día: {moment(payload[0].payload.date).format('MMM DD')}</span> */}
                        <span className='text-[#fcd34d]'>Presupuesto: {formatCurrency(income_budget)}</span>
                        <span className='text-[#30a349]'>Ingresos: {formatCurrency(payload[0].payload.value)}</span>
                    
                    </>

                    }
                    
                    
                </div>
                );
            }
            return null;
            }}
            
            
            />
            <Bar
                dataKey="value"
                fill="#30a349"
                barSize={24} // Adjust width here
                radius={[6, 6, 0, 0]} // Rounded top corners
                //onMouseOver={(_, index) => setActiveIndex(index)}
                //onMouseOut={() => setActiveIndex(null)}
                shape={(props) => (
                    <Rectangle
                    {...props}
                    stroke={props.index === activeIndex ? "#30a349" : ""} // Border color
                    strokeWidth={2}  // Border width
                    fill="#30a349"
                    radius={[6, 6, 0, 0]}
                    />
                
                )}
                label={({ x, y, width, value, index }) => {
                    // Only show label for the last bar
                    if (index === dataToPlot.length - 1 && value !== 0) {
                    return (
                        <text
                        x={x + width / 2}
                        y={y -8 }
                        textAnchor="middle"
                        fill="#5266EB"
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
                y={income_budget}
                stroke="#fcd34d"
                strokeWidth={2}
                strokeDasharray="8 4"
                >
                {/* <Label
                    value={formatCurrency(dataToPlot[dataToPlot.length - 1].value)}
                    position="right"
                    fill="#fcd34d"
                    fontWeight="bold"
                    fontSize={13}
                    offset={10}
                /> */}
                </ReferenceLine>
                
            )}
            </BarChart>
        </ResponsiveContainer>
        </div>
  );
}


  const mapStateToProps = state => ({
    daily_income: state.Reports.history_dash.daily.mtd_income,
    inst_daily_income: state.Reports.history_dash.daily.income,
    monthly_income: state.Reports.history_dash.monthly.income,
    income_budget: state.Reports.history_dash.income_budget,
    day_date: state.Reports.history_dash.daily.date,
    month: state.Reports.history_dash.monthly.month,
    current_Year: state.Reports.current_Year,
    current_Month: state.Reports.current_Month,
    
  })
  

  export default connect(mapStateToProps,{

  }) (MultiChartIncomesDash)
