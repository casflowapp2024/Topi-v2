import { useEffect, useState } from 'react'
import moment from  'moment'
//redux
import { connect } from 'react-redux'
//components
import { formatMoney, formatMoneyCompact, parseDatetoDatetimeBrow, getPercPlus, getColorByValue } from '../../helpers';

//icons

import ChartLegend, { lastPointLead } from '../../ui/ChartLegend';
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function MultiChartBalanceDash({
    monthlyActivated,
    dailyActivated,
    daily_balance,
    monthly_balance,
    day_date,
    month,
    current_Year,
    current_Month

}) {

    const [dataToPlot, setDataToPlot] = useState(null)


    useEffect(() => {
        moment.locale('es');

        let formattedActual =  [{
                    date: new Date(current_Year, current_Month - 1, 1),
                    value: 0,
                    dif: 0,
                    left: 0,
                    per_show: getPercPlus(0),
                    color_per: getColorByValue(0)}];

        //console.log("not formatted", monthly_balance, month);

        if (monthly_balance && monthlyActivated && month && month.length>0) {
            
                formattedActual = month.map((m, i) => ({
                    date: new Date(current_Year, m - 1, 1), // ✅ Safari-safe
                    value: monthly_balance[i].value,
                    dif: monthly_balance[i].diff,
                    per_show: getPercPlus(monthly_balance[i].percentage),
                    color_per: getColorByValue(monthly_balance[i].diff)
                }));
            
            
        } else if (daily_balance && dailyActivated && day_date && day_date.length>0) {
            if (day_date.length>0){
                formattedActual = day_date.map((d, i) => ({
                    date: parseDatetoDatetimeBrow(d, "YYYY-MM-DD"), // ✅ Safari-safe
                    value: daily_balance[i],
                }));
            }
        }

        setDataToPlot(formattedActual);
        //console.log("formattedActual", formattedActual);
    }, [monthlyActivated, dailyActivated, daily_balance]);
    
    const [activeIndex, setActiveIndex] = useState(null);
    //#e11d48
    return (
        <div className='h-[220px] w-full flex flex-col'>
            <ChartLegend lead={(() => { const l = lastPointLead(dataToPlot, 'value', monthlyActivated, moment); return l && { ...l, value: formatMoneyCompact(l.value) }; })()} items={[]} className="pt-2" />
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
                    return moment(date).format('MMM'); // monthly format
                    } else if (dailyActivated) {
                    return moment(date).format('D'); // daily format
                    }
                    return moment(date).format('D'); // fallback
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                domain={['auto', 'auto']}
                tick={{ fontSize: 12 }}
            />
            <CartesianGrid vertical={false} />
            <YAxis width={44} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickCount={4} tickFormatter={(v) => formatMoneyCompact(v)} />
            <Tooltip
            cursor={false}
            content={({ active, payload }) => {
            if (active && payload && payload.length) {
                return (
                <div className="flex flex-col gap-0.5 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
                    {monthlyActivated?
                    <div className='flex flex-col'>
                        {/* <span className=''>Mes: {moment(payload[0].payload.date).format('MMM')}</span> */}
                        <div>
                            <span className='font-semibold text-topi-600 dark:text-indigo-300'>Balance: {formatMoney(payload[0].payload.value)}</span> (
                            <span style={{ color: payload[0].payload.color_per }}>{payload[0].payload.per_show}</span>)
                        </div>
                        {/* <span className=''>Dif: {formatMoney(payload[0].payload.dif)}</span> */}
                    </div>:
                    <>
                        {/* <span className=''>Día: {moment(payload[0].payload.date).format('MMM DD')}</span> */}
                        <span className='font-semibold text-topi-600 dark:text-indigo-300'>Balance: {formatMoney(payload[0].payload.value)}</span>
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
                fill="#5266EB"
                barSize={24} // Adjust width here
                radius={[6, 6, 0, 0]} // Rounded top corners
                //onMouseOver={(_, index) => setActiveIndex(index)}
                //onMouseOut={() => setActiveIndex(null)}
                shape={(props) => (
                    <Rectangle
                    {...props}
                    fillOpacity={activeIndex === null || props.index === activeIndex ? 1 : 0.45}
                    fill="#5266EB"
                    radius={[6, 6, 0, 0]}
                    />
                
                )}
                />
                {/* {dataToPlot && dataToPlot.length > 0 && (
                <ReferenceLine
                y={dataToPlot[dataToPlot.length - 1].value}
                className="topi-budget-line"
                stroke="#8A90A8"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                ifOverflow="extendDomain"
                label={{ value: "Presupuesto", position: "insideTopLeft", className: "topi-budget-label", fontSize: 11, fontWeight: 600 }}
                >
                </ReferenceLine>
                )} */}

            </BarChart>
        </ResponsiveContainer>
        </div>
        </div>
  );
}


  const mapStateToProps = state => ({

    daily_balance: state.Reports.history_dash.daily.running_savings_balance,
    monthly_balance: state.Reports.history_dash.monthly.running_savings_balance,
    day_date: state.Reports.history_dash.daily.date,
    month: state.Reports.history_dash.monthly.month,
    current_Year:state.Reports.current_Year,
    current_Month:state.Reports.current_Month,
    

  })
  
  export default connect(mapStateToProps,{

  
  }) (MultiChartBalanceDash)
