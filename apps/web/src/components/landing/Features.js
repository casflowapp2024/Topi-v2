//react
import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";

import { getPerc0, getPerc2, capitalizeWords, formatCurrency } from "../helpers";
import { Emoji } from "emoji-picker-react";
//redux


//components

import { BanknotesIcon, 
    ChartBarIcon, 
    CreditCardIcon, 
    WalletIcon, 
    ArrowUpRightIcon,
    ArrowDownRightIcon,
    DocumentCurrencyDollarIcon
 } from '@heroicons/react/20/solid'

const gastos = {
    icon: <BanknotesIcon className="h-8 w-8 text-[#5266EB] mb-2" />, 
    title: "Seguimiento de Gastos",
    desc: "Controla tus gastos y crea presupuestos.",
    categories:[
        {name:"Vivienda", emoji:"1f3e0", gastado:"$1,750,000", budget:"$1,800,000", perctg:97},
        {name:"Entretenimiento", emoji:"1f3ad", gastado:"$496,000", budget:"800,000", perctg:62},
        {name:"Transporte", emoji:"1f697", gastado:"$39,652", budget:"$200,000", perctg:18},
        {name:"Supermercado", emoji:"1f6d2", gastado:"$122,684", budget:"$200,000", perctg:61},
        {name:"Inversiones", emoji:"1f3a9", gastado:"$600,000", budget:"$500,000", perctg:120},
    ]
  }

const dataAnal = {
    icon: <ChartBarIcon className="h-8 w-8 text-[#5266EB] mb-2" />, 
    title: "Análisis de Datos",
    desc: "Visualiza tus finanzas con gráficos e informes.",
    analysis:[
        {name:"Tu Balance", 
            value1:2.6,
            value2:21535210},
        {name:"Tus Gatos Mensuales", 
            value1:8, 
            value2:1532020},
       
    ]

  }

  const accounts ={
    icon: <CreditCardIcon className="h-8 w-8 text-[#5266EB] mb-2" />, 
    title: "Gestión de Cuentas",
    desc: "Organiza todas tus cuentas en un solo lugar.",
    accs:[
        {name:"Cuenta Nomina", digits:"1234",bank:"CashBank",type:"Cuenta Ahorros"},
        {name:"Tarjeta Plateada", digits:"9876",bank:"TitanBank",type:"Tarjeta de Crédito"},
        {name:"Inversiones Ahorro", digits:"0000",bank:"Shock Fund",type:"Inversión"},
        {name:"TC SlashMiles", digits:"3333",bank:"Banco Green",type:"Tarjeta de Crédito"},

    ]
        

    
  }


const Features = ({ 

 }) => {
    

    return (

        <>
            <div className="max-w-7xl mx-auto flex-1 w-full">
                {/* <h2 className="text-3xl font-bold text-gray-800 text-center mb-8 animate-fade-in">Características</h2> */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* PLAN GASTOS */}
                   
                        <div key={gastos.title} className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-xl transition animate-fade-in" style={{animationDelay: `${1 * 100}ms`}}>
                            {gastos.icon}
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{gastos.title}</h3>
                            <p className="text-gray-600">{gastos.desc}</p>

                            <ul role="list" className=" w-full pt-4">
                                {gastos.categories.map((category) => (
                                <li key={category.name} className="py-[5px] lg:px-1">
                                    <div className="flex flex-row justify-start">
                                    <Emoji unified={(category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                                    <h3 className="pl-2 text-sm font-semibold text-gray-700 mb-1">{capitalizeWords(category.name)}</h3>
                                    </div>
                                    <div className="flex flex-row items-center justify-between py-1">
                                    <div className='font-medium flex flex-col xl:flex-row items-center justify-start'>
                                        <span className='text-[12px] xl:text-sm'>{category.gastado}</span>
                                        <span className='text-[8px] xl:text-[10px] w-full text-left text-gray-400'>/{category.budget}</span>
                                    </div>
                                    <span className="text-[11px] xl:text-[14px] font-medium ">
                                        {getPerc0(category.perctg)}
                                    </span>
                                    </div>
                                    <div className="flex w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                    {parseInt(category.perctg) >= 100 ? 
                                    <div className="bg-[#3445b4] h-full" style={{ width: '100%' }}></div> 
                                    :
                                    <>
                                        {parseInt(category.perctg) >= 80 ?
                                        <div className="bg-[#5266EB] h-full" style={{ width: getPerc2(category.perctg) }}></div> :
                                        <div
                                            className="bg-[#808bd3] h-full"
                                            style={{ width: getPerc2(category.perctg) }}
                                        ></div>
                                        }
                                    </>
                                    }
                                    </div>
                                </li>
                                ))}
                            </ul>
                        </div>

                        {/* PLAN stats */}
                   
                        <div key={dataAnal.title} className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-xl transition animate-fade-in" style={{animationDelay: `${2 * 100}ms`}}>
                            {dataAnal.icon}
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{dataAnal.title}</h3>
                            <p className="text-gray-600">{dataAnal.desc}</p>

                            <ul role="list" className=" w-full pt-4 flex flex-col gap-4">
                                {dataAnal.analysis.map((anal) => (

                                    <div className='flex flex-col p-2 bg-white border border-gray-200 rounded-2xl shadow hover:bg-gray-200'>
                                        {/* top card */}
                                        <div className='h-[69px] flex flex-row border-b border-gray-400 items-center justify-start pb-3'>
                                            <div className='h-10 w-[20%] rounded-full border border-white flex justify-center items-center'>
                                                
                                                {anal.name === "Tu Balance"?
                                                    <WalletIcon className='w-8 h-8'/>:
                                                    <BanknotesIcon className='w-8 h-8'/>
                                                }
                                            </div>
                                            <div className='flex flex-col pl-2 justify-start'>
                                                <h3 className='text-xl text-left'>{anal.name}</h3>
                                                <div className='flex flex-row items-center'>
                                                    <div className={`${anal.name === "Tu Balance"?"bg-green-500": "bg-rose-600"} flex justify-center items-center mr-1  w-3 h-3 rounded-sm`}> 
                                                    <ArrowUpRightIcon className='w-3 h-3 text-white'/>
                                                    </div>
                                                    <span className='font-light text-[12px]'>{getPerc2(anal.value1)} más que el mes anterior.</span>
                                                </div>
                                            
                                            

                                            </div>
                                        </div>
                                        {/* bottom card */}
                                        <div className='h-[48px] flex flex-row justify-between items-center mt-4'>
                                            <div className='flex flex-row justify-center w-full items-end'>
                                                <span className='md:text-2xl'>{formatCurrency(anal.value2)}</span>
                                            </div>
                                                
                                        </div>
                                    </div>

                                ))}
                            </ul>



                        </div>

                        {/* PLAN GASTOS */}
                   
                        <div key={accounts.title} className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-xl transition animate-fade-in" style={{animationDelay: `${3 * 100}ms`}}>
                            {accounts.icon}
                            <h3 className="text-xl font-bold text-gray-800 mb-2">{accounts.title}</h3>
                            <p className="text-gray-600">{accounts.desc}</p>

                            <div className="my-5 w-full bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
                                <div>
                                    <ul class="divide-y divide-gray-200 dark:divide-gray-700">

                                        {accounts.accs&&accounts.accs.map((account) => (
                                        <li 
                                        key={account.name} 
                                        class="p-4 cursor-pointer hover:bg-gray-200">
                                            <div class="flex items-center">
                                                <div class="flex-shrink-0">
                                                    <div className='w-8 h-8 flex justify-center items-center rounded-full bg-[#5266EB]'>
                                                        {account.type === "Cuenta Ahorros"?
                                                        <DocumentCurrencyDollarIcon className='h-6 w-6 text-white'/>
                                                        :
                                                        <CreditCardIcon className='h-6 w-6 text-white'/>

                                                        }
                                                    </div>
                                                </div>
                                                <div class="flex-1 min-w-0 ms-3 justify-start">
                                                    <p class="text-sm text-left font-medium text-gray-900 truncate dark:text-white">
                                                    {account.name}
                                                    </p>
                                                    <p class="text-sm text-left text-gray-500 truncate dark:text-gray-400">
                                                    ****{account.digits}
                                                    </p>
                                                </div>
                                                <div class="flex flex-col items-right text-base font-semibold text-gray-900 dark:text-white">
                                                <span className="text-right">{account.bank}</span>
                                                <span className="text-right">{account.type}</span>
                                                
                                                </div>
                                            </div>
                                        </li>
                                        ))}
                                    </ul>

                                </div>
                            </div>
                        </div>
           
                </div>
            </div>
        </>
        
            
            
    );
};


export default Features;
