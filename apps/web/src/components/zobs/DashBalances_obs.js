import { Fragment, useEffect, useState, useRef } from 'react'
import {NavLink, Link, useNavigate, Await} from 'react-router-dom';
import { Menu ,Popover, Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'
import moment from  'moment'
//redux
import { connect, useSelector  } from 'react-redux'
import { get_user_dash_balances } from '../../redux/actions/cashflow';
import { get_balance_history } from '../../redux/actions/reports';
//components
import { formatCurrency, getPerc2, findElmentNameById, capitalizeWords } from '../helpers';
import DropDownPeriod from '../dashboard/DropDownPeriod';
//icons
import { UserCircleIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';



function DashBalances({
    periodData,
    setPeriodData,
    get_balance_history,
    user_balances,
    user_categories,
    user_accounts,
    

}) {
    
    const [balancePeriod, setBalancePeriod] = useState("Ultimos 30 días");
    const [loadingPeriod, setLoadingPeriod] = useState(true)
    



    // Inicializa filteredBalances con los datos correspondientes al período actual
    const getInitialFilteredBalances = () => {
        const today = moment();
        let startDate = moment().startOf('year');
        return user_balances?.balance_hist.filter(item => moment(item.date).isBetween(startDate, today, null, '[]')) || [];
    };

    const [filteredBalances, setFilteredBalances] = useState(getInitialFilteredBalances());
    const [currentBalance, setCurrentBalance] = useState(filteredBalances.length > 0 ? filteredBalances[0]?.balance : 0);


    useEffect(() => {

        get_balance_history("30")
        
    }, [ ]);

    useEffect(() => {
        const getFilteredBalances = (period) => {
            const today = moment();
            let startDate;
            switch (period) {
                case 'Año actual':
                    startDate = moment().startOf('year');
                    break;
                case 'Mes actual':
                    startDate = moment().startOf('month');
                    break;
                case 'Ultimos 30 días':
                    startDate = moment().subtract(30, 'days');
                    break;
                case 'Ultimos 180 días':
                    startDate = moment().subtract(180, 'days');
                    break;
                case 'Ultimos 365 días':
                    startDate = moment().subtract(365, 'days');
                    break;
                default:
                    return user_balances?.balance_hist || [];
            }
            return user_balances?.balance_hist.filter(item => moment(item.date).isBetween(startDate, today, null, '[]')) || [];
        };

        if (user_balances?.balance_hist) {
            const newFilteredBalances = getFilteredBalances(balancePeriod);
            setFilteredBalances(newFilteredBalances.reverse());
            setCurrentBalance(newFilteredBalances.length > 0 ? newFilteredBalances[0].balance : 0);
        }
    }, [user_balances, balancePeriod]);


    /* 30,60,90,120,150,180, year (año actual), month (mes actual) */
    const periodIdMapping = {
        'Ultimos 30 días': '30',
        'Ultimos 60 días': '60',
        'Ultimos 90 días': '90',
        'Ultimos 150 días': '150',
        'Ultimos 180 días': '180',
        'Año actual': 'year',
        'Mes actual': 'month',
    };

    useEffect(() => {
        const periodId = periodIdMapping[balancePeriod] || '30';
        const getPeriodData = (periodId) => {
            return user_balances?.[periodId] || {};
        };
        setPeriodData(getPeriodData(periodId));
    }, [balancePeriod, user_balances]);


    

    const handleMouseMove = (e) => {
        if (e && e.activePayload && e.activePayload[0] && e.activePayload[0].payload) {
            setCurrentBalance(e.activePayload[0].payload.balance);
        }
    };
    //#e11d48
    return (
        
        <div className="h-[300px] w-2/3 flex flex-row items-center justify-between py-4 bg-white border border-gray-200 rounded-lg shadow">
            <div className="flex flex-row w-full gap-2">
                {/* select y grafica */}
                <div className="h-[280px] w-full flex flex-col">
                    <div className='flex flex-row w-full justify-between'>
                        <div className="flex flex-row w-full justify-between">
                            <div className="">
                                <div className="flex flex-row px-2 items-center"> 
                                    <DropDownPeriod
                                    optionsDict={periodIdMapping}
                                    balancePeriod={balancePeriod}
                                    setBalancePeriod={setBalancePeriod}
                                    />
                                </div>
                            </div>

                        </div>
                        <div id="Balance" className="px-6 py-2 inline-flex items-center text-xl text-gray-700 dark:text-white">
                            {formatCurrency(currentBalance)}
                        </div>
                    </div>
                    {/* grafica */}
                    <div style={{ width: '100%', height: '100%', margin: 0, padding: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={filteredBalances} onMouseMove={handleMouseMove} margin={{top: 10, right: 0, left: 0, bottom: 0}} >
                                <defs>
                                    <linearGradient id="balanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                        <stop offset="0%" stopColor="#b2b8e0" />
                                        <stop offset="85%" stopColor="white" />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tickFormatter={(date) => moment(date).format('     MMM DD     ') } 
                                axisLine={false} tickLine={false}  interval="preserveStartEnd" domain={['auto', 'auto']} tick={{fontSize: 12}}  />
                                <YAxis hide={true}/>
                                <Tooltip content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                    return <div className="bg-white border border-gray-300 rounded-lg p-2">
                                        <p>{moment(payload[0].payload.date).format('MMM DD')}</p>
                                    </div>;
                                    }
                                    return null;
                                }} />
                                <Area type="monotone" dataKey="balance" stroke="#5266EB" fill="url(#balanceGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        
        </div>
        
    )
  }


  const mapStateToProps = state => ({
    user_balances: state.CashFlow.user_balances,
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
  })
  
  export default connect(mapStateToProps,{
    get_balance_history
  
  }) (DashBalances)
