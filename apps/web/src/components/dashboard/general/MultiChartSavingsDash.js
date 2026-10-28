import { useEffect, useState } from 'react'
import moment from  'moment'
import "moment/locale/es";
//redux
import { connect } from 'react-redux'
//components
import { formatCurrency, formatCurrency2, getPerc0, getColorByValue, getPercPlus,  parseDatetoDatetimeBrow } from '../../helpers';
//icons
import ChartLegend, { lastPointLead } from '../../ui/ChartLegend';
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function MultiChartSavingsDash({
    monthlyActivated,
    dailyActivated,
    daily_savings,
    monthly_savings,
    monthly_savings_dif,
    day_date,
    month,
    current_Year,
    current_Month,
    savings_budget
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
    
            //console.log("not formatted", monthly_savings, month);
    
            if (monthly_savings && monthlyActivated && month && month.length > 0) {
                formattedActual = month.map((m, i) => ({
                    date: new Date(current_Year, m - 1, 1), // ✅ Safari-safe
                    value: monthly_savings[i].value,
                    //dif: monthly_income[i].diff,
                    //per_show: getPercPlus(monthly_income[i].percentage),
                    //color_per: getColorByValue(monthly_income[i].diff),
                    left: getPerc0(monthly_savings[i].usage)
                }));
            } else if (daily_savings && dailyActivated && day_date && day_date.length >0) {
                formattedActual = day_date.map((d, i) => ({
                    date: parseDatetoDatetimeBrow(d, "YYYY-MM-DD"),
                    value: daily_savings[i],
                }));
            }
    
            setDataToPlot(formattedActual);
            //console.log("formattedActual", formattedActual);
        }, [monthlyActivated, dailyActivated, daily_savings]);
    
    const [activeIndex, setActiveIndex] = useState(null);
    //#e11d48
    return (
        <div className='h-[220px] w-[370px] md:w-[400px]  xl:w-[500px] flex flex-col'>
            <ChartLegend lead={(() => { const l = lastPointLead(dataToPlot, 'value', monthlyActivated, moment); return l && { ...l, value: formatCurrency2(l.value) }; })()} items={[
                savings_budget ? { type: 'line', label: 'Presupuesto', value: formatCurrency2(Math.abs(savings_budget)) } : null,
            ]} className="pt-2" />
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
            width={420}
            height={300}
            data={dataToPlot}
            margin={{
                top: 22,
                right: 20,
                left: 0,
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
                                    return moment(date).locale("es").format("MMM"); // monthly format
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
                        <span className='text-ink-2 dark:text-gray-400'>Presupuesto: {formatCurrency(savings_budget)}</span>
                        <div>
                            <span className='font-semibold text-violet-700 dark:text-violet-300'>Ahorro: {formatCurrency(payload[0].payload.value)}</span> 
                            {/* (<span style={{ color: payload[0].payload.color_per }}>{payload[0].payload.per_show}</span>) */}
                        </div>
                        <span className=''>Ahorrados: {payload[0].payload.left}</span>
                        {/* <span className=''>Dif: {formatCurrency(payload[0].payload.dif)}</span> */}
                    </div>
                    :
                    <>
                        {/* <span className=''>Día: {moment(payload[0].payload.date).format('MMM DD')}</span> */}
                        <span className='text-ink-2 dark:text-gray-400'>Presupuesto: {formatCurrency(savings_budget)}</span>
                        <span className='font-semibold text-violet-700 dark:text-violet-300'>Ahorro: {formatCurrency(payload[0].payload.value)}</span>
                    </>

                    }
                    
                    
                </div>
                );
            }
            return null;
            }}
            
            
            />
            {/* La línea va antes de las barras para quedar detrás de ellas */}
                {dataToPlot && dataToPlot.length > 0 && (
                
                <ReferenceLine
                y={savings_budget}
                className="topi-budget-line"
                stroke="#8A90A8"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
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
            <Bar
                dataKey="value"
                fill="#9B5DE5"
                barSize={24} // Adjust width here
                radius={[6, 6, 0, 0]} // Rounded top corners
                //onMouseOver={(_, index) => setActiveIndex(index)}
                //onMouseOut={() => setActiveIndex(null)}
                shape={(props) => (
                    <Rectangle
                    {...props}
                    fillOpacity={activeIndex === null || props.index === activeIndex ? 1 : 0.45}
                    fill="#9B5DE5"
                    radius={[6, 6, 0, 0]}
                    />
                
                )}
                />
            </BarChart>
        </ResponsiveContainer>
        </div>
        </div>
  );
}


  const mapStateToProps = state => ({
    daily_savings: state.Reports.history_dash.daily.mtd_savings,
    monthly_savings: state.Reports.history_dash.monthly.savings,
    monthly_savings_dif: state.Reports.history_dash.monthly.savings_diff,
    savings_budget: state.Reports.history_dash.savings_budget,
    day_date: state.Reports.history_dash.daily.date,
    month: state.Reports.history_dash.monthly.month,
    current_Year: state.Reports.current_Year,
    current_Month: state.Reports.current_Month,
    
  })
  

  export default connect(mapStateToProps,{

  }) (MultiChartSavingsDash)
