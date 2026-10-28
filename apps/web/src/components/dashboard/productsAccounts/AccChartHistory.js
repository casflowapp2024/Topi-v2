import { use, useEffect, useState } from 'react'
import moment from 'moment'
//redux
import { connect } from 'react-redux'

//components
import { formatCurrency, parseDatetoDatetimeBrow, formatCurrency2, getPerc0, getColorByValue, getPercPlus } from '../../helpers';

//icons
import { BarChart, Bar, Rectangle, XAxis, Label, ReferenceLine, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';


function AccChartHistory({
    //props

    //reduxstates
    history_month,
    current_Year,
    current_Month
}) {
    const [dataToPlot, setDataToPlot] = useState(null)
    useEffect(() => {

        let formattedActual = [{
            date: new Date(current_Year, current_Month - 1, 1),
            value: 0,
            dif: 0,
            show: 0,
            left: 0,
            per_show: getPercPlus(0),
            color_per: getColorByValue(0)
        }];

        if (history_month && history_month.month && history_month.balance.length > 0) {
            formattedActual = history_month.month.map((m, i) => ({
                date: new Date(current_Year, m - 1, 1), // ✅ Safari-safe
                value: history_month.balance[i].value,
                dif: history_month.balance[i].diff,
                per_show: getPercPlus(history_month.balance[i].percentage, true),
                color_per: getColorByValue(history_month.balance[i].diff),
                //left: getPerc0(expense_serie[i].usage)
            }))
        }
        setDataToPlot(formattedActual);
        //console.log("formattedActual", formattedActual);
    }, [history_month]);

    /* useEffect(() => {
       console.log("dataToPlot changed", dataToPlot);
    }, [dataToPlot]); */

    const [activeIndex, setActiveIndex] = useState(null);
    //#e11d48
    return (
        <div className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    width={400}
                    height={300}
                    data={dataToPlot}
                    margin={{
                        top: 10,
                        right: 2,
                        left: 2,
                        bottom: 2,
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
                            return moment(date).locale("es").format('MMM'); // monthly format        
                        }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis hide padding={{ top: 10, bottom: 10 }} />
                    <Tooltip
                        cursor={false}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="flex flex-col gap-0.5 text-xs bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
                                        <div className='flex flex-col'>
                                            <span className='font-semibold text-topi-600 dark:text-indigo-300'>Balance: {formatCurrency(payload[0].payload.value)}</span>
                                            <div>
                                                <span>Dif:</span>
                                                <span style={{ color: payload[0].payload.color_per }}>{formatCurrency(payload[0].payload.dif)}</span> (
                                                <span style={{ color: payload[0].payload.color_per }}>{payload[0].payload.per_show}</span>)
                                            </div>

                                        </div>
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
                                fill={props.value >= 0 ? "#5266EB" : "#DC2626"}
                                radius={[6, 6, 0, 0]}
                            />

                        )}

                        label={({ x, y, width, value, index }) => {
                            // Only show label for the last bar
                            if (index === dataToPlot.length - 1 && value !== 0) {
                                return (
                                    <text
                                        x={x + width / 3}
                                        y={value >= 0 ? y - 8 : y + 16}
                                        textAnchor="middle"
                                        className="topi-chart-value"
                                        fontWeight="bold"
                                        fontSize={12}
                                    >
                                        {formatCurrency2(value)}
                                    </text>
                                );
                            }
                            return null;
                        }}
                    />


                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

const mapStateToProps = state => ({
    history_month: state.Reports.history_accounts_by_month.monthly,
    current_Year: state.Reports.current_Year,
    current_Month: state.Reports.current_Month,
})

export default connect(mapStateToProps, {


})(AccChartHistory)
