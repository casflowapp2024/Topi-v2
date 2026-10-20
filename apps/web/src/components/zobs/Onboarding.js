
import { useState, useEffect, Fragment } from 'react';
//redux
import { connect } from 'react-redux';
import { set_keep_open_first_steps_false } from '../redux/actions/cashflow';
//components
import OnbCreateAccount from '../components/onboarding/OnbCreateAccount';
import LinkTransEmailForm from '../components/conexions/LinkTransEmailForm';
import OnbCreateCategory from '../components/onboarding/OnbCreateCategory';
import OnbCreateTrans from '../components/onboarding/OnbCreateTrans';
import OnbLinkEmail from  '../components/onboarding/OnbLinkEmail';

import { ChevronRightIcon, ChevronLeftIcon, CheckCircleIcon, CircleStackIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'

const Onboarding = ({ 
    set_keep_open_first_steps_false,
    user,
    user_extra_data,
    first_steps,

    }) => {

    const [collapsed, setCollapsed] = useState(false);
    const [connectEmailOpen, setConnectEmailOpen ] = useState(false);
    const [createBankOpen, setCreateBankOpen] = useState(false);
    const [createFirstCategoryOpen, setCreateFirstCategoryOpen] = useState(true);
    const [createFirstTransOpen, setCreateFirstTransOpen] = useState(false);
    const [cannotClose, setCannotClose] = useState(false)

    const [currentStep, setCurrentStep] = useState(1)

    const handleOpenClose = () => {
        setCollapsed(!collapsed)
        if (first_steps.keep_open&&(!collapsed)){
            set_keep_open_first_steps_false()
        }
    };

    const steps = {
    1:{
      id: 1,
      label: 'Crea una categoría de gastos/ingresos',
      done: first_steps?.cat || false,
    },
    2:{
      id: 2,
      label: 'Crea una cuenta de banco o tarjeta',
      done: first_steps?.bank || false,
    },
    3:{
        id: 3,
        label: 'Agrega tu primera transacción a Topi',
        done: first_steps?.trans || false,
    },
    4:{
      id: 4,
      label: 'Conecta tu email a Topi',
      done: first_steps?.email || false,
    }}

  
    const progress = (
    Object.values(steps).filter(step => step.done).length /
    Object.values(steps).length
    ) * 100;


    useEffect (() => {
        if(connectEmailOpen || createBankOpen || createFirstCategoryOpen || createFirstTransOpen){
            setCannotClose(true)
        }else if(!connectEmailOpen && !createBankOpen && !createFirstCategoryOpen && createFirstTransOpen){
            setCannotClose(false)
        }
        
    }, [connectEmailOpen,createBankOpen,createFirstCategoryOpen, createFirstTransOpen]); 


    const handleCloseEmail = () => {

        setConnectEmailOpen(false)
        
    };

    // Handle step change
    const handleStepChange = (increment) => {   
        
        let newStep = currentStep + increment;
        if (newStep < 1) {
            return
        } else if (newStep > 4) {
            return
        }
        setCurrentStep(newStep);
    };



    return (

        <>
            {user_extra_data&&(user_extra_data.onboarding_completed===false)?
                
                <div className='p-2 flex items-center justify-center'>
                    <div className=" w-screen md:w-[450px] lg:w-[726px] xl:w-[930px] bg-white rounded-2xl shadow-md p-4">
                        <div className="w-full flex justify-between items-center mb-2" >
                            <div className='flex flex-col'>
                                <h2 className="text-md md:text-lg font-semibold pb-2">👋 {user&&user.name} Bienvenido A Topi! Tu asistente AI personal de Finanzas</h2>
                                <div 
                                onClick= {() => handleOpenClose()}
                                className='cursor-pointer flex items-center gap-1 justify-start text-gray-500 hover:text-[#5266EB] rounded-md hover:bg-gray-100'> 
                                    <p className='text-sm md:text-base w-fit'> Completa los primeros pasos para que puedas llevar tus finanzas a Topi!
                                    </p>
                                    <div 
                                    className='h-6 w-6 '>
                                        <PlayCircleIcon/>
                                    </div>
                                </div>
                           
                           </div>
                            
                        </div>

                        <div className="mt-2 w-full bg-gray-200 rounded-full">
                            < div className="bg-green-500 rounded-full" style={{ width: `${progress}%` }}>
                                <p className="flex flex-row text-justify text-[10px] pl-2 text-white gap-1">
                                    <span>{Math.round(progress)}%</span> completado 
                                </p>
                            </div>
                        </div>


                        <Transition show={collapsed} as={Fragment}>
                                    <Dialog as="div" className="relative z-30 font-Inter" onClose={handleOpenClose}>
                                        <TransitionChild
                                        as={Fragment}
                                        enter="ease-out duration-300"
                                        enterFrom="opacity-0"
                                        enterTo="opacity-100"
                                        leave="ease-in duration-200"
                                        leaveFrom="opacity-100"
                                        leaveTo="opacity-0"
                                        >
                                        <div className="fixed inset-0 bg-gray-400 bg-opacity-80 transition-opacity" />
                                        </TransitionChild>
                            
                                        <div className="fixed md:left-[64px] inset-0 z-10 overflow-y-auto">
                                        <div className="flex min-h-max justify-center p-2 text-center">
                                            <TransitionChild
                                            as={Fragment}
                                            enter="ease-out duration-300"
                                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                                            leave="ease-in duration-200"
                                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                            >
                                            {/**/ }
                                            <DialogPanel className="p-2 max-h-min top-14 md:top-8 md:w-[600px] relative transform rounded-lg bg-white text-left shadow-xl transition-all">      
                                                {/* ANTERIOR SIGUIENTE NAVEGACION */}
                                                <div className='w-full flex flex-col'>
                                                    <div className='flex flex-row items-center gap-1'>
                                                        <div className="w-full bg-gray-200 rounded-full">
                                                            < div className="bg-green-500 rounded-full" style={{ width: `${progress}%` }}>
                                                                <p className="flex flex-row text-justify text-[10px] pl-2 text-white gap-1">
                                                                    <span>{Math.round(progress)}%</span> completado 
                                                                </p>
                                                            </div>
                                                        </div>
                                                    
                                                        <div type="button" 
                                                        onClick={e=>handleOpenClose()} 
                                                        class="cursor-pointer text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                                            <svg aria-hidden="true" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                            <span class="sr-only">Close modal</span>
                                                        </div>                            
                                                    </div>

                                                    
                                                    <div className='w-full justify-between my-2 px-2 py-4 bg-white border border-gray-200 rounded-2xl flex flex-row gap-1'>

                                                        {currentStep==1?
                                                        <></>:
                                                        <button onClick={() => handleStepChange(-1)} className='hover:text-[#5266EB]'>
                                                            <ChevronLeftIcon className='w-4 h-4'/>
                                                        </button>
                                                        }   
                                                        {currentStep==4?
                                                        <></>:
                                                        <div></div>
                                                        }
                                                        <DialogTitle as="h3" className="text-lg font-medium leading-6 text-zinc-900">
                                                            {steps[currentStep].label}
                                                        </DialogTitle>

                                                        {currentStep==1?
                                                        <></>:
                                                        <div></div>
                                                        }

                                                        {currentStep==4?
                                                        <></>:
                                                        <button onClick={() => handleStepChange(1)} className='hover:text-[#5266EB]'>
                                                            <ChevronRightIcon className='w-4 h-4'/>
                                                        </button>
                                                        }

                                                    </div>
                                                </div>


                                                {/* CONTENIDO PASO*/}
                                                <div className='p-2'>

                                                    {currentStep==1?
                                                    <OnbCreateCategory
                                                    />
                                                    :<></>
                                                    }

                                                    {currentStep==2?
                                                    <OnbCreateAccount
                                                    />
                                                    :<></>
                                                    }

                                                    {currentStep==3?
                                                    <OnbCreateTrans
                                                    />
                                                    :<></>
                                                    }

                                                    {currentStep==4?
                                                    <OnbLinkEmail
                                                    />
                                                    :<></>
                                                    }

                                                </div>


                                                {/* ANTERIOR SIGUIENTE NAVEGACIO*/}
                                                <div className='w-full justify-between mt-3 px-2 py-1 flex flex-row gap-1 border-t border-gray-200'>
                                                    {currentStep==1?
                                                    <></>:
                                                    <button onClick={() => handleStepChange(-1)} className='hover:text-[#5266EB] flex flex-row items-center gap-2'>
                                                        <ChevronLeftIcon className='w-4 h-4'/> Anterior
                                                    </button>
                                                    }
                                                    {currentStep==4?
                                                    <></>:
                                                    <div></div>
                                                    }
                                                    {currentStep==1?
                                                    <></>:
                                                    <div></div>
                                                    }
                                                    {currentStep==4?
                                                    <></>:
                                                    <button onClick={() => handleStepChange(1)} className='hover:text-[#5266EB] flex flex-row items-center gap-2'>
                                                        Siguiente <ChevronRightIcon className='w-4 h-4'/>
                                                    </button>
                                                    }
                                                </div>
                                          
                                            </DialogPanel>
                                            </TransitionChild>
                                        </div>
                                        </div>
                                    </Dialog>
                        </Transition>


                        <div className='relative'>
                            {/* conect email */}
                            {connectEmailOpen?
                                <>
                                    <div className='absolute -top-[144px] w-full z-20 border border-gray-300x1 rounded-2xl bg-white'>
                                        <div className='p-4 flex flex-col'>
                                            <div className="flex flex-row justify-between items-center">
                                                <h2 as="h3" className="text-lg font-medium leading-6 text-zinc-900">
                                                    Conecta tu email a CashFLow
                                                </h2>
                                                <div type="button" 
                                                onClick={e=>setConnectEmailOpen(!connectEmailOpen)} 
                                                class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                                    <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                    <span class="sr-only">Close modal</span>
                                                </div> 
                                            </div>
                                            <p className='text-gray-500 text-justify mt-2'>
                                                Al conectar tu correo, ya no tendrás que pasar horas registrando transacciones que llegan a tu correo. CashFlow lo hará por ti automáticamente! Así podras llevar una bitacora de todos tus movimientos, filtrarlos, buscarlos, separarlos, todo más dinamico y sin gastar tiempo.
                                            </p>
                                            <LinkTransEmailForm
                                            closedForm ={connectEmailOpen}
                                            onCloseForm={handleCloseEmail}
                                            onSelectValue = {null}
                                            contextWindow = "onboarding"
                                            />
                                        </div>
                                    </div>
                                    <div className='z-10 fixed top-[200px] md:top-[120px] inset-0 bg-gray-100 opacity-60 transition-opacity'>
                                    </div>
                                </>
                                :
                                <></>}

                            {/* create bank */}
                            {createBankOpen?
                                <>
                                    <div className='absolute -top-[144px] w-full z-20 border border-gray-300x1 rounded-2xl bg-white'>
                                        <div className='p-4 flex flex-col'>
                                            <div className="flex flex-row justify-between items-center">
                                                <h2 as="h3" className="text-lg font-medium leading-6 text-zinc-900">
                                                    Agrega nueva Cuenta o Tarjeta
                                                </h2>
                                                <div type="button" 
                                                onClick={e=>setCreateBankOpen(!createBankOpen)} 
                                                class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                                    <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                    <span class="sr-only">Close modal</span>
                                                </div> 
                                            </div>
                                            <p className='text-gray-500 text-justify mt-2'>
                                                Agregar una cuenta bancaria o producto finaciero como una tarjeta te permitirá rastrear todos los movimientos que se hagan en esta, tener tus balances y/o deudas al día, establecer tus metas de ahorro y saber cuanto más potencial tienes por explotar financieramente.
                                            </p>
                                            <OnbCreateAccount
                                            openCreateBox = {createBankOpen}
                                            setOpenCreateBox = {setCreateBankOpen}
                                            />
                                        </div>
                                    </div>
                                    <div className='z-10 fixed top-[200px] md:top-[120px] inset-0 bg-gray-100 opacity-60 transition-opacity'>
                                    </div>
                                </>
                                :
                                <></>
                            }
                            {/* create category */}
                            {createFirstCategoryOpen?
                                <>
                                    <div className='absolute -top-[144px] w-full z-20 border border-gray-300x1 rounded-2xl bg-white'>
                                                                                
                                        {/* <OnbCreateCategory
                                        openCreateBox = {createFirstCategoryOpen}
                                        setOpenCreateBox = {setCreateFirstCategoryOpen}
                                        /> */}
                                                 
                                    </div>
                                    
                                </>
                                :
                                <></>
                            }
                            {/* create trans */}
                            {createFirstTransOpen?
                                <>
                                    <div className='absolute -top-[144px] w-full z-20 border border-gray-300x1 rounded-2xl bg-white'>
                                        <div className='p-4 flex flex-col'>
                                            <div className="flex flex-row justify-between items-center">
                                                <h2 as="h3" className="text-lg font-medium leading-6 text-zinc-900">
                                                    Agrega tu primera transacción a CashFlow
                                                </h2>
                                                <div type="button" 
                                                onClick={e=>setCreateFirstTransOpen(!createFirstTransOpen)} 
                                                class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm p-1.5 inline-flex dark:hover:bg-gray-600 dark:hover:text-white" data-modal-toggle="readProductModal">
                                                    <svg aria-hidden="true" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>
                                                    <span class="sr-only">Close modal</span>
                                                </div> 
                                            </div>
                                            <p className='text-gray-500 text-justify mt-2'>
                                                Crear tu primera transacción en CashFlow es el primer paso para tomar el control de tus finanzas. Aquí podrás registrar un gasto o ingreso, asignarlo a una categoría y vincularlo a una cuenta. 
                                                Esto te permitirá empezar a visualizar en qué usas tu dinero, generar reportes automáticos y tomar mejores decisiones financieras desde el primer día.
                                            </p>
                                            <OnbCreateTrans
                                            openCreateBox = {createFirstTransOpen}
                                            setOpenCreateBox = {setCreateFirstTransOpen}
                                            />
                                        </div>
                                    </div>
                                    <div className='z-10 fixed top-[200px] md:top-[120px] inset-0 bg-gray-100 opacity-60 transition-opacity'>
                                    </div>
                                </>
                                :
                                <></>
                            }
                        
                        </div>


                    </div>
                </div>:
                <></>


            }
        </>

    );
};

const mapStateToProps = (state) => ({

    user: state.Auth.user,
    first_steps: state.CashFlow.first_steps,
    user_extra_data: state.Auth.user_extra_data,
    
});
    
export default connect(mapStateToProps,{
    set_keep_open_first_steps_false
  }) (Onboarding)


