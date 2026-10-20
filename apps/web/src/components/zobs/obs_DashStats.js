import { Fragment, useEffect, useState, useRef } from 'react';

//redux
import { connect } from 'react-redux';
import { get_financial_report } from '../../redux/actions/reports';
import { get_savings_account } from '../../redux/actions/reports';
//components
import DropDownAccount from './DropDownAccounts';
import { formatCurrency, getPerc2 } from '../helpers';
import { 
    ArrowDownRightIcon, 
    ArrowUpRightIcon, 
    ShoppingBagIcon, 
    WalletIcon, 
    SparklesIcon, 
    BanknotesIcon} from '@heroicons/react/24/solid';

import {QuestionMarkCircleIcon} from '@heroicons/react/24/outline';

import { ThreeDots } from 'react-loader-spinner';
const DashStats = ({ 
    savings_balance,
    income,
    expenses,
    credits_balance,
    user_accounts,
    get_financial_report,
    get_savings_account, balance_by_account

    }) => {

    //Select diferent accounts

    const [accountsSelected, setAccountsSelected] = useState([]);
    const [loadingReport, setLoadingReport] = useState(true);
    const [accountsInDropDown, setAccountsInDropDown] = useState([]);

    // Load accounts and fetch report once when `user_accounts` arrives
    const prevIdsRef = useRef([]);

    useEffect(() => {
    if (user_accounts.items && user_accounts.items.length > 0) {
        const statsType = [1, 2, 3, 4];
        const filtered = user_accounts.items.filter(item =>
            statsType.includes(item.type.id)
        );
        const filteredIds = filtered.map(item => item.id);

        const idsChanged = JSON.stringify(prevIdsRef.current) !== JSON.stringify(filteredIds);
        if (!idsChanged) return;

        prevIdsRef.current = filteredIds;

        setAccountsSelected(filteredIds);
        setAccountsInDropDown(user_accounts.items);
        get_savings_account();
        get_financial_report_confirm(filteredIds, user_accounts);
    }
    }, [user_accounts]);

    const get_financial_report_confirm = async (selectedIds, user_accounts) => {
        setLoadingReport(true);
        const success = await get_financial_report(selectedIds, user_accounts);
        if (success === true) {
            setLoadingReport(false);
        }
    };

    // Handle account selection updates
    useEffect(() => {
        if (accountsSelected.length>0 && user_accounts.items.length > 0){
            get_financial_report_confirm(accountsSelected, user_accounts)
        }
    }, [accountsSelected]);

    //appear info
    const tooltips = [
        { id: 1, title: "Tu Balance", content: "Es el total que tienes en tu cuenta de ahorros: todos tus ingresos menos todos tus gastos." },
        { id: 2, title: "Tus Deudas", content: "Es el total que debes en tus créditos y tarjetas." },
        { id: 3, title: "Gastos Mensuales", content: "Suma de lo que has gastado este mes en tus cuentas de ahorro." },
        { id: 4, title: "Ingresos Mensuales", content: "Todo lo que has recibido este mes en tus cuentas de ahorro." }
      ];

    const [activeTooltip, setActiveTooltip] = useState(null);
    const timeoutRef = useRef(null);

    const appearUp = (id) => {
        clearTimeout(timeoutRef.current); // Clear hide timeout if hovering another
        setActiveTooltip(id); // Set active tooltip to the hovered one
    };

    
    const disappearInfo = () => {
    timeoutRef.current = setTimeout(() => setActiveTooltip(null), 200); // Delay hiding
    };

    return (

        <div className="bg-white p-4 rounded-2xl shadow-md">
            <div className='flex flex-col gap-4'>
                <div className='flex flex-row justify-between items-center'>
                    <div className=' font-medium'>
                        Resumen de Cuentas
                    </div>
                    <div>
                        <DropDownAccount
                        user_accounts={accountsInDropDown}
                        accountsSelected={accountsSelected}
                        setAccountsSelected={setAccountsSelected}
                        />
                    </div>


                </div>
                
                <div className=" flex flex-row gap-4">
                    
                    

                    {/*SAVINGS Balance */}
                    <div className="relative group w-1/2 h-[150px] md:p-4 p-2 text-white  bg-[#5266EB] border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700">
                        {savings_balance?
                            
                            <div className='flex flex-col'>
                                {/* top card */}
                                <div className='h-[69px] flex flex-row border-b border-gray-400 items-center pb-3'>
                                    <div className='h-8 w-8 rounded-full border border-white flex justify-center items-center'>
                                        <WalletIcon className='w-5 h-5'/>
                                    </div>
                                    <div className='flex flex-col pl-2'>
                                        <h3 className='text-md'>Tu Balance</h3>
                                            {parseFloat(savings_balance.vs_past_month) > 0 ?
                                                
                                                <div className='flex flex-row items-center'>
                                                    <div className='flex justify-center items-center mr-1 bg-green-500 w-3 h-3 rounded-sm'> 
                                                    <ArrowUpRightIcon className='w-3 h-3 text-white'/>
                                                    </div>
                                                    <span className='font-light text-[10px]'>{getPerc2(savings_balance.vs_past_month)} más que el mes anterior.</span>
                                                </div>
                                                :
                                                <>
                                                {parseFloat(savings_balance.vs_past_month) < 0 ?
                                                    <div className='flex flex-row items-center'>
                                                        <div className='flex justify-center items-center mr-1 bg-rose-500 w-3 h-3 rounded-sm'> 
                                                            <ArrowDownRightIcon className='w-3 h-3 text-white'/>
                                                        </div>
                                                        <span className='font-light text-[10px]'>{getPerc2(savings_balance.vs_past_month)} menos que el mes anterior.</span>
                                                    </div>:
                                                    <>
                                                    </>

                                                }
                                                </>
                                            }

                                    </div>
                                </div>
                                {/* bottom card */}
                                <div className='h-[48px] flex flex-row justify-between items-center mt-4'>
                                    {loadingReport?
                                    <div className='pl-10 text-gray-500 flex justify-center items-center'>
                                        <ThreeDots
                                        height="40"
                                        width="40"
                                        color="#6b7280"
                                        ariaLabel="loading"
                                        />
                                    </div>
                                    :<>
                                    {savings_balance?
                                        <div className='flex flex-row justify-between w-full items-end'>
                                            <span className='md:text-xl'>{formatCurrency(savings_balance.value)}</span>
                                            <div>
                                                <div className='cursor-pointer'>
                                                    <QuestionMarkCircleIcon 
                                                    onMouseOver={()=>appearUp(1)}
                                                    onMouseLeave={disappearInfo}
                                                    className='w-5 h-5'/>
                                                </div>
                                            </div>
                                        </div>
                                        : <span className='no info'></span>
                                    }
                                    </>
                                    }
                                </div>
                            </div>:
                            <div className='text-gray-500 flex justify-center items-end h-full'>
                                <ThreeDots
                                height="30"
                                width="30"
                                color="#6b7280"
                                ariaLabel="loading"
                                />
                            </div>
                        }
                        {/* info tooltip */}
                        <div 
                        className={`absolute z-50 left-0 top-0 w-auto mt-1 mx-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg shadow-md dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800
                        transition-all duration-300 transform ${
                            activeTooltip === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                        }`}
                        >
                            <div class="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-lg dark:border-gray-600 dark:bg-gray-700">
                                <h3 class="font-semibold text-gray-900 dark:text-white">{tooltips[0].title}</h3>
                            </div>
                            <div class="px-3 py-2">
                                <p>{tooltips[0].content}</p>
                            </div>
                        </div>
                    </div>

                    {/* credits_balance */}                    
                    <div className="relative group w-1/2 h-[150px] md:p-4 p-2 bg-white border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700">
                        {credits_balance?
                        <div className='flex flex-col'>
                            {/* top card */}
                            <div className='h-[69px] flex flex-row border-b border-gray-400 items-center pb-3'>
                                <div className='h-8 w-8 rounded-full border border-gray-500  flex justify-center items-center'>
                                    <SparklesIcon className='w-5 h-5'/>
                                </div>
                                <div className='flex flex-col pl-2'>
                                    <h3 className='text-md'>Tus Deudas</h3>
                                    {parseFloat(credits_balance.vs_past_month) > 0 ?
                                            
                                        <div className='flex flex-row items-center'>
                                            <div className='flex justify-center items-center mr-1 bg-rose-500 w-3 h-3 rounded-sm'> 
                                            <ArrowUpRightIcon className='w-3 h-3 text-white'/>
                                            </div>
                                            <span className='font-light text-[10px]'>{getPerc2(credits_balance.vs_past_month)} más que el mes anterior.</span>
                                        </div>
                                        :
                                        <>
                                        {parseFloat(credits_balance.vs_past_month) < 0 ?
                                            <div className='flex flex-row items-center'>
                                                <div className='flex justify-center items-center mr-1 bg-green-500 w-3 h-3 rounded-sm'> 
                                                    <ArrowDownRightIcon className='w-3 h-3 text-white'/>
                                                </div>
                                                <span className='font-light text-[10px]'>{getPerc2(credits_balance.vs_past_month)} menos que el mes anterior.</span>
                                            </div>:
                                            <>
                                            </>

                                        }
                                        </>
                                    }

                                </div>
                            </div>
                            {/* bottom card */}
                            <div className='h-[48px] flex flex-row justify-between items-center mt-4'>
                                {loadingReport?
                                <div className='pl-10 text-gray-500 flex justify-center items-center'>
                                    <ThreeDots
                                    height="40"
                                    width="40"
                                    color="#6b7280"
                                    ariaLabel="loading"
                                    />
                                </div>
                                :<>
                                {credits_balance?
                                    <div className='flex flex-row justify-between w-full items-end'>
                                        <span className='md:text-xl'>{formatCurrency(credits_balance.value)}</span>
                                        <div>
                                            <div className='cursor-pointer'>
                                                <QuestionMarkCircleIcon 
                                                onMouseOver={()=>appearUp(2)}
                                                onMouseLeave={disappearInfo}
                                                className='w-5 h-5'/>
                                            </div>
                                        </div>
                                    </div>
                                    : <span className='no info'></span>
                                }
                                </>
                                }
                                
                            </div>
                        </div>
                        :
                        <div className='text-gray-500 flex justify-center items-end h-full'>
                            <ThreeDots
                            height="30"
                            width="30"
                            color="#6b7280"
                            ariaLabel="loading"
                            />
                        </div>

                        }
                        {/* info tooltip */}
                        <div 
                        className={`absolute z-50 left-0 top-0 mt-1 mx-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg shadow-md dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800
                        transition-all duration-300 transform ${
                            activeTooltip === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                        }`}
                        >
                            <div class="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-lg dark:border-gray-600 dark:bg-gray-700">
                                <h3 class="font-semibold text-gray-900 dark:text-white">{tooltips[1].title}</h3>
                            </div>
                            <div class="px-3 py-2">
                                <p>{tooltips[1].content}</p>
                            </div>
                        </div>
                    </div> 

                          
                </div>

                <div className=" flex flex-row gap-4">

                    {/* Incomes */}
                    <div className="relative group w-1/2 h-[150px] md:p-4 p-2  bg-white border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700">
                        {income?
                        <div className='flex flex-col w-full'>
                            {/* top card */}
                            <div className='h-[69px] flex flex-row border-b border-[#6b7280] items-center pb-3'>
                                <div className='h-8 w-8 rounded-full border border-gray-500 flex justify-center items-center'>
                                    <BanknotesIcon className='w-5 h-5'/>
                                </div>
                                <div className='flex flex-col pl-2'>
                                    <h3 className='text-md'>Ingresos Mensuales</h3>
                                    {parseFloat(income.vs_past_month) > 0 ?
                                        <div className='flex flex-row items-center'>
                                            <div className='flex justify-center items-center mr-1 bg-green-500 w-3 h-3 rounded-sm'> 
                                            <ArrowUpRightIcon className='w-3 h-3 text-white'/>
                                            </div>
                                            <span className='font-light text-[10px]'>{getPerc2(income.vs_past_month)} más que el mes anterior.</span>
                                        </div>
                                        :
                                        <>
                                        {parseFloat(income.vs_past_month) < 0 ?
                                            <div className='flex flex-row items-center'>
                                                <div className='flex justify-center items-center mr-1 bg-rose-500 w-3 h-3 rounded-sm'> 
                                                    <ArrowDownRightIcon className='w-3 h-3 text-white'/>
                                                </div>
                                                <span className='font-light text-[10px]'>{getPerc2(income.vs_past_month)} menos que el mes anterior.</span>
                                            </div>:
                                            <>
                                            </>
                                        }
                                        </>
                                    }
                                </div>

                            </div>
                            {/* bottom card */}
                            <div className='h-[48px] flex flex-row justify-between items-center mt-4'>

                                {loadingReport?
                                <div className='pl-10 text-gray-500 flex justify-center items-center'>
                                    <ThreeDots
                                    height="40"
                                    width="40"
                                    color="#6b7280"
                                    ariaLabel="loading"
                                    />
                                </div>
                                :<>
                                {income?
                                    <div className='flex flex-row justify-between w-full items-end'>
                                        <div className='flex flex-row items-center'>
                                            {/* <div className="rounded-full md:w-6 h-6 flex justify-center items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16a34a" class="size-5">
                                                <path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clip-rule="evenodd" />
                                                </svg>
                                            </div> */}
                                            <span className='md:text-xl'>{formatCurrency(income.value)}</span>
                                            
                                        </div>
                                        
                                        <div>
                                            <div className='cursor-pointer'>
                                                <QuestionMarkCircleIcon 
                                                onMouseOver={()=>appearUp(4)}
                                                onMouseLeave={disappearInfo}
                                                className='w-5 h-5'/>
                                            </div>
                                        </div>
                                    </div>
                                    : <span className='no info'></span>
                                }
                                </>
                                }
                            </div>
                        </div>:
                        <div className='text-gray-500 flex justify-center items-end h-full'>
                            <ThreeDots
                            height="30"
                            width="30"
                            color="#6b7280"
                            ariaLabel="loading"
                            />
                        </div>
                        }
                        {/* info tooltip */}
                        <div 
                        className={`absolute z-50 left-0 top-0 w-auto mt-1 mx-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg shadow-md dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800
                        transition-all duration-300 transform ${
                            activeTooltip === 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                        }`}
                        >
                            <div class="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-lg dark:border-gray-600 dark:bg-gray-700">
                                <h3 class="font-semibold text-gray-900 dark:text-white">{tooltips[3].title}</h3>
                            </div>
                            <div class="px-3 py-2">
                                <p>{tooltips[3].content}</p>
                            </div>
                        </div>
                    </div>
                    
            
                    {/* Gastos */}
                    <div className="relative group w-1/2 h-[150px] md:p-4 p-2  bg-white border border-gray-200 rounded-2xl shadow dark:bg-gray-800 dark:border-gray-700 ">
                        {expenses?
                        <div className='flex flex-col'>
                            {/* top card */}
                            <div className='h-[69px] flex flex-row border-b border-[#6b7280] items-center pb-3'>
                                <div className='h-8 w-8 rounded-full border border-gray-500  flex justify-center items-center'>
                                    <ShoppingBagIcon className='w-5 h-5'/>
                                </div>
                                <div className='flex flex-col pl-2'>
                                    <h3 className='text-md'>Gastos Mensuales</h3>
                                    {parseFloat(expenses.vs_past_month) > 0 ?
                                        <div className='flex flex-row items-center'>
                                            <div className='flex justify-center items-center mr-1 bg-rose-500 w-3 h-3 rounded-sm'> 
                                            <ArrowUpRightIcon className='w-3 h-3 text-white'/>
                                            </div>
                                            <span className='font-light text-[10px]'>{getPerc2(expenses.vs_past_month)} más que el mes anterior.</span>
                                        </div>
                                        :
                                        <>
                                        {parseFloat(expenses.vs_past_month) < 0 ?
                                            <div className='flex flex-row items-center'>
                                                <div className='flex justify-center items-center mr-1 bg-green-500 w-3 h-3 rounded-sm'> 
                                                    <ArrowDownRightIcon className='w-3 h-3 text-white'/>
                                                </div>
                                                <span className='font-light text-[10px]'>{getPerc2(expenses.vs_past_month)} menos que el mes anterior.</span>
                                            </div>:
                                            <>
                                            </>

                                        }
                                        </>
                                    }

                                </div>

                            </div>
                            {/* bottom card */}
                            <div className='h-[48px] flex flex-row justify-between items-center mt-4'>

                                {loadingReport?
                                <div className='pl-10 text-gray-500 flex justify-center items-center'>
                                    <ThreeDots
                                    height="40"
                                    width="40"
                                    color="#6b7280"
                                    ariaLabel="loading"
                                    />
                                </div>
                                :<>
                                {expenses?
                                    <div className='flex flex-row justify-between w-full items-end'>
                                        <div className='flex flex-row items-center'>
                                            <span className='md:text-xl'>{formatCurrency(expenses.value)}</span>
                                            {/* <div className="w-[10%] rounded-full md:w-6 h-6 flex justify-center items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" class="size-5">
                                                <path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 0 1 1.06 0l13.72 13.72V8.25a.75.75 0 0 1 1.5 0V19.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1 0-1.5h9.44L3.97 5.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                                                </svg>
                                            </div>
                                             */}
                                        </div>
                                        <div className='cursor-pointer'>
                                            <QuestionMarkCircleIcon 
                                            onMouseOver={()=>appearUp(3)}
                                            onMouseLeave={disappearInfo}
                                            className='w-5 h-5'/>
                                        </div>
                                    </div>
                                    
                                    : <span className='no info'></span>
                                }
                                </>
                                }
                            </div>
                        </div>:
                        <div className='text-gray-500 flex justify-center items-end h-full'>
                            <ThreeDots
                            height="30"
                            width="30"
                            color="#6b7280"
                            ariaLabel="loading"
                            />
                        </div>
                        }
                        {/* info tooltip */}
                        <div 
                        className={`absolute z-50 left-0 top-0 w-auto mt-1 mx-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg shadow-md dark:text-gray-400 dark:border-gray-600 dark:bg-gray-800
                        transition-all duration-300 transform ${
                            activeTooltip === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
                        }`}
                        >
                            <div class="px-3 py-2 bg-gray-100 border-b border-gray-200 rounded-t-lg dark:border-gray-600 dark:bg-gray-700">
                                <h3 class="font-semibold text-gray-900 dark:text-white">{tooltips[2].title}</h3>
                            </div>
                            <div class="px-3 py-2">
                                <p>{tooltips[2].content}</p>
                            </div>
                        </div>
                    </div>

                
                </div>

                
            </div>
            
        </div>
    );
};

const mapStateToProps = (state) => ({
    savings_balance: state.Reports.savings_balance,
    income : state.Reports.income,
    expenses : state.Reports.expenses,
    credits_balance: state.Reports.credits_balance,
    user_accounts: state.CashFlow.user_accounts,
    account_in_dash: state.Reports.account_in_dash,
    balance_by_account: state.Reports.balance_by_account,
    
});
    
export default connect(mapStateToProps,{
    get_financial_report,
    get_savings_account
  
  }) (DashStats)


