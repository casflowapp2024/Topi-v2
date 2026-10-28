//react
import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";

import { getPerc0, getPerc2, capitalizeWords, formatMoney, formatDate } from "../helpers";
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


const trans_items = [
        {date:"12-06-2025", desc:"Mercado Aseo", expense:true,amount:123456,account:"Tarjeta Plateada",category:{name:"Supermercado",emoji:"1f6d2"}},
        {date:"12-06-2025", desc:"Uber", expense:true,amount:8325,account:"TC SlashMiles",category:{name:"Transporte",emoji:"1f697"}},
        {date:"6-06-2025", desc:"Pago Acueducto", expense:true, amount:121530,account:"Cuenta Nomina",category:{name:"Vivienda",emoji:"1f3e0"}},
        {date:"4-06-2025", desc:"Netflix", expense:true,amount:29950,account:"Tarjeta Plateada",category:{name:"Subscripciones",emoji:"1f4fa"}},
        {date:"3-06-2025", desc:"Pago Prestamo", expense:false,amount:60000,account:"Cuenta Nomina",category:{name:"Otro",emoji:"1f4e6"}},
        {date:"1-06-2025", desc:"Salida a Cenar", expense:true,amount:121520,account:"Tarjeta Plateada",category:{name:"Entretenimiento",emoji:"1f3ad"}},
        {date:"1-06-2025", desc:"Pago honorarios Mayo", expense:false,amount:6320000,account:"Cuenta Nomina",category:{name:"Ingresos",emoji:"1f4b0"}},
        {date:"29-05-2025", desc:"Pago Tarjeta", expense:true,amount:1865350,account:"Cuenta Nomina",category:{name:"Tarjetas",emoji:"1f4b3"}},
    ]

const Trans = ({ 

 }) => {
    
     const navigate = useNavigate();

    return (

        <>
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-10">
                
                {/* Imagen / Animación */}
                <div className="top-0 rounded-2xl shadow-md border border-gray-200 bg-white px-2 md:px-0 w-auto md:min-w-[620px] xl:min-w-[830px] ">
                    <div className='bg-white text-gray-900 font-semibold mt-2 py-2 flex flex-row'>
                                                    
                        <div className="min-w-[22%] md:min-w-[140px] lg:min-w-[140px] xl:min-w-[190px]">
                            <div className="pl-[30px] md:pl-[35px] text-sm md:text-base">Monto</div>
                        </div>
                        <div className="min-w-[1%] md:min-w-[9px] lg:min-w-[9px] xl:min-w-[12px]"></div>
                        <div className="min-w-[27%] md:min-w-[160px] lg:min-w-[160px] xl:min-w-[212px] text-sm md:text-base ">Descripción</div>
                        <div className="min-w-[1%] md:min-w-[9px] lg:min-w-[9px] xl:min-w-[12px]"></div>
                        <div className="min-w-[23%] md:min-w-[156px] lg:min-w-[156px] xl:min-w-[202px] text-sm md:text-base ">Categoría</div>
                        <div className="min-w-[1%] md:min-w-[9px] lg:min-w-[9px] xl:min-w-[12px]"></div>
                        <div className="min-w-[22%] md:min-w-[140px] lg:min-w-[140px] xl:min-w-[190px] text-sm md:text-base">Cuenta</div>
                        
                    </div>
                    <div>
                        
                        <ul className='text-gray-400 text-sm'>
                            {trans_items.map((transaction,index) => (
                                <li 
                                    key={transaction.desc} 
                                    className='py-2 flex flex-row justify-start border-t gap-[1%] md:gap-[8px] lg:gap-[8px] xl:gap-[12px] hover:bg-gray-200 cursor-pointer'>
                                    {/* monto */}
                                    <div className='shrink-0 min-w-[22%] md:min-w-[140px] lg:min-w-[140px] xl:min-w-[190px] flex flex-col'>

                                        <div className="flex flex-row justify-start items-center">
                                            {transaction.expense === false ?
                                            <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16a34a" class="size-5">
                                                <path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clip-rule="evenodd" />
                                                </svg>
                                            </div>
                                            :
                                            <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" class="size-5">
                                            <path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 0 1 1.06 0l13.72 13.72V8.25a.75.75 0 0 1 1.5 0V19.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1 0-1.5h9.44L3.97 5.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                                            </svg>
                                            </div>
                                            }
                                                
                                            <div className='text-xs lg:text-base px-1 flex items-center text-gray-700'>
                                                <span className='w-[70px] md:w-[96px] lg:w-[100px] text-left'>{formatMoney(transaction.amount)}</span>
                                            </div>
                                        </div>
                                        <div className="xl:hidden w-full text-left pl-[28px] md:pl-[32px] lg:pl-[38px] text-[10px] md:text-sm">
                                            {transaction.date}
                                        </div>
                                        
                                        
                                    </div>
                                    {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                    {/* description */}
                                    <div className=' min-w-[27%] md:min-w-[160px] lg:min-w-[160px] xl:min-w-[212px] flex items-center text-gray-900 font-medium'>
                                        <span className="truncate lg:text-sm text-xs text-left w-full">{transaction.desc}</span>
                                    </div>
                                    {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                    <div className='min-w-[23%] md:min-w-[156px] lg:min-w-[156px] xl:min-w-[202px] flex items-center justify-start gap-1 md:gap-2'>
                                        <Emoji unified={(transaction.category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                                        <span className="truncate text-left w-full text-xs lg:text-base">{capitalizeWords(transaction.category.name)}</span>
                                    </div>
                                    {/* <div className="w-[0px] lg:w-[9px] xl:w-[12px]"></div> */}
                                    <div className='min-w-[22%] md:min-w-[140px] lg:min-w-[140px] xl:min-w-[190px] flex items-center justify-start'>
                                        <span className="truncate lg:text-sm text-xs text-left w-full">{transaction.account}</span>
                                    </div>
                                    

                                </li>
                                ))}
                        
                        </ul>
                    </div>
                        
      
                </div>

                {/* Transacciones automaticas Descriptivo */}
                <div className="w-full lg:w-1/2 text-center lg:text-left">
                <h2 className="text-3xl lg:text-4xl font-extrabold text-gray-200 dark:text-black mb-4">
                    Registro automático de Transacciones.
                </h2>
                <p className="text-gray-200 dark:text-gray-600 text-lg mb-6 text-justify">
                    Topi se conecta con tu correo electrónico para detectar automáticamente tus movimientos bancarios, gastos e ingresos. No necesitas ingresar todo manualmente: nos encargamos de interpretar la información relevante y ayudarte a mantener tus finanzas organizadas.
                </p>
                <ul className="text-gray-300 dark:text-gray-700 mb-6 space-y-2">
                    <li className="flex items-center">
                    <svg className="w-5 h-5 text-[#5266EB] mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 6.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z"/>
                    </svg>
                    Lectura automática desde tu email
                    </li>
                    <li className="flex items-center">
                    <svg className="w-5 h-5 text-[#5266EB] mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 6.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z"/>
                    </svg>
                    Sincronización con tus bancos vía notificaciones
                    </li>
                    <li className="flex items-center">
                    <svg className="w-5 h-5 text-[#5266EB] mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 00-1.414 0L9 11.586 6.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z"/>
                    </svg>
                    Clasificación inteligente de gastos e ingresos
                    </li>
                </ul>
                <button
                    onClick={() => navigate('/create_account')}
                    className="bg-[#5266EB] text-white font-semibold px-6 py-3 rounded-lg shadow hover:bg-blue-600 transition"
                >
                    Empieza gratis
                </button>
                </div>
            </div>
        </>
        
            
            
    );
};


export default Trans;
