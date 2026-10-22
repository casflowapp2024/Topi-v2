import { useEffect, useState } from 'react'
import moment from  'moment'
//redux
import { connect } from 'react-redux'
import { get_user_dash_balances } from '../../../redux/actions/cashflow';
import { get_balance_history } from '../../../redux/actions/reports';
//components
import { formatCurrency } from '../../helpers';
import DropDownPeriod from './DropDownPeriod';
//icons
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';


function DashBalances({
    get_balance_history,
    history_balance
}) {
    
    const [balancePeriod, setBalancePeriod] = useState("Ultimos 30 días");
    const [periodIDSelected, setPeriodIDSelected] = useState("30");
    const [loadingPeriod, setLoadingPeriod] = useState(true)
    const [dataToPlot1, setDataToPlot1] = useState([]);
    const [dataToPlot2, setDataToPlot2] = useState([]);
    const [mergedData, setMergedData] = useState([])
    const [currentBalance, setCurrentBalance] = useState(0);

    const get_balance_history_confirm =  async (periodSelected) => {
        setLoadingPeriod(true)            
        const getHistoryResponse = await get_balance_history(periodSelected)
        console.log(getHistoryResponse)
        if (getHistoryResponse === true) {
            setLoadingPeriod(false)
        }
      }

    useEffect(() => {
        get_balance_history_confirm("30")
    }, [ ]);
    
    const periodIdMapping = {
        'Ultimos 30 días': '30',
        'Ultimos 60 días': '60',
        'Ultimos 90 días': '90',
        'Ultimos 120 días': '120',
        'Ultimos 150 días': '150',
        'Ultimos 180 días': '180',
        'Año actual': 'year',
        'Mes actual': 'month',
    };

    useEffect(() => {
        const periodId = periodIdMapping[balancePeriod] || '30';
        setPeriodIDSelected(periodId)
    }, [balancePeriod]);
    

    // Handle account selection updates
    useEffect(() => {
        console.log(periodIDSelected)
        get_balance_history_confirm(periodIDSelected)
        
    }, [periodIDSelected]);

    
    useEffect(() => {
    moment.locale('es');

    if (history_balance.history && history_balance.history.length > 0) {
        // Format actual data
        const formattedActual = history_balance.history
            .slice()
            .reverse()
            .map(entry => ({
                date: new Date(entry.Date),
                balance: entry.Balance,
            }));

        // Prepare prev series: align to the end, reverse order
        let formattedPrev = [];
        if (history_balance.past_history && history_balance.past_history.length > 0) {
            const prevReversed = history_balance.past_history.slice().reverse();
            const diff = formattedActual.length - prevReversed.length;

            // Fill with nulls at the start, then the reversed prev values
            formattedPrev = [
                ...Array(diff).fill(null),
                ...prevReversed.map(entry => ({
                    prevBalance: entry.Balance,
                    prevDate: new Date(entry.Date),
                }))
            ];
        } else {
            formattedPrev = Array(formattedActual.length).fill(null);
        }

        // Merge both series for the chart
        const merged = formattedActual.map((item, idx) => ({
            ...item,
            prevBalance: formattedPrev[idx]?.prevBalance ?? null,
            prevDate: formattedPrev[idx]?.prevDate ?? null,
        }));

        setDataToPlot1(formattedActual);
        setDataToPlot2(formattedPrev);
        setMergedData(merged);
        } else {
            setDataToPlot1([]);
            setDataToPlot2([]);
            setMergedData([]);
        }
    }, [history_balance]);

    
    useEffect(() => {
        console.log('Merged Data:', mergedData);
        }, [mergedData]);

    const handleMouseMove = (e) => {
        if (e && e.activePayload && e.activePayload[0] && e.activePayload[0].payload) {
            setCurrentBalance(e.activePayload[0].payload.balance);
        }
    };
    //#e11d48
    return (
        
        <div className="h-[310px] sm:h-[300px] flex flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl shadow">
            
            {/* select y grafica */}
            <div className="h-[280px] w-full flex flex-col">
                <div className='flex flex-row justify-between'>
                    <div className="flex flex-row w-full justify-between">
                        <div className='flex flex-row'>
                            <div className="px-6 flex flex-col items-left text-gray-700 dark:text-white">
                                <h2 className='text-lg'>Balance</h2>
                                {history_balance&&history_balance.updated_at ?
                        
                                    <span className='font-light text-gray-400 text-xs'>
                                        Actualizado por ultima vez a las {moment(history_balance.updated_at).format('HH:mm A')}
                                    </span>:
                                    <></>
                                }
                                
                            
                            </div>
                            

                        </div>
                        <div className='flex flex-row items-center gap-2'>
                            <div className='flex flex-row gap-2'>
                                <div className='flex flex-row items-center gap-1 text-sm'>
                                    <div className='w-2 h-2 bg-[#5266EB] rounded-full'></div> 
                                    <div>Actual</div>

                                </div>
                                <div className='flex flex-row items-center gap-1 text-sm'>
                                    <div className='w-2 h-2 bg-[#fcd34d] rounded-full'></div> 
                                    <div>Previo</div>

                                </div>

                            </div>

                            <div className="">
                                <div className="flex flex-row px-1 items-center "> 
                                    <DropDownPeriod
                                    optionsDict={periodIdMapping}
                                    balancePeriod={balancePeriod}
                                    setBalancePeriod={setBalancePeriod}
                                    />
                                </div>
                            </div>
                        </div>
                        
                           
                         
                        

                    </div>
                    
                </div>
                {/* grafica */}
                <div className="w-full h-full m-0 p-0">
                    <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                    data={mergedData}  // Use the merged data here
                    onMouseMove={handleMouseMove}
                    margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                    >
                    <defs>
                        <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#b2b8e0" />
                        <stop offset="85%" stopColor="white" />
                        </linearGradient>
                        <linearGradient id="prevBalanceGradient" x1="0%" y1="0%" x2="0%" y2="25%">
                        <stop offset="0%" stopColor="#fcd34d" />
                        <stop offset="10%" stopColor="white" />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="date"
                        tickFormatter={(date) => moment(date).format('   MMM DD   ')}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis hide={true} />
                    <Tooltip
                        content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            return (
                            <div className="flex flex-col text-xs bg-white border border-gray-300 rounded-lg p-2">
                                
                                <span className='text-[#5266EB]'>Actual: {moment(payload[0].payload.date).format('MMM DD')} | {formatCurrency(payload[0].payload.balance)}</span>
                                <span className='text-[#fcd34d]'>Previo: {payload[0].payload.prevDate ? moment(payload[0].payload.prevDate).format('MMM DD') : ''} | {formatCurrency(payload[0].payload.prevBalance)}</span>
                                
                            </div>
                            );
                        }
                        return null;
                        }}
                    />
                    {/* Second series */}
                    <Area
                        type="monotone"
                        dataKey="prevBalance"
                        stroke="#fcd34d"
                        fill="url(#prevBalanceGradient)"
                        strokeWidth={3}
                    />
                    {/* First series */}
                    <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#5266EB"
                        fill="url(#balanceGradient)"
                        strokeWidth={3}
                    />
                    
                    </AreaChart>

                    </ResponsiveContainer>
                </div>
            </div>

           
        
        </div>
        
    )
  }


  const mapStateToProps = state => ({
    user_balances: state.CashFlow.user_balances,
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    history_balance: state.Reports.history_balance,
  })
  
  export default connect(mapStateToProps,{
    get_balance_history
  
  }) (DashBalances)
