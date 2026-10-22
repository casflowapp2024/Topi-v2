import { useState, useEffect, Fragment } from 'react';
//redux
import { connect } from 'react-redux';
import { set_keep_open_first_steps_false, get_user_transactions } from '../redux/actions/cashflow';
//components
import GoalSelection from '../components/onboarding2/GoalSelection';
import StepLinkEmail from '../components/onboarding2/StepLinkEmail';
import StepCreateAccount from '../components/onboarding2/StepCreateAccount';
import StepCompletion from '../components/onboarding2/StepCompletion';

import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { Transition, Dialog, DialogTitle, TransitionChild, DialogPanel } from '@headlessui/react'

const Onboarding2 = ({
    NextStepsPopoverOnboarding,
    forceEmailStep = false, // al iniciar sesión sin correo conectado: abrir en "Conecta tu email"
    //redux state
    user,
    first_steps,
    user_extra_data,
    //actions
    set_keep_open_first_steps_false,
    get_user_transactions,

}) => {

    const [collapsed, setCollapsed] = useState(false);
    const [currentStep, setCurrentStep] = useState(1)
    const [selectedGoal, setSelectedGoal] = useState(null);

    useEffect(() => {
        get_user_transactions(0, 50);

        const lastClosed = localStorage.getItem('onboardingLastClosed');
        const now = new Date().getTime();
        // 24 hours = 86400000 ms
        let shouldOpen = first_steps.keep_open;
        if (lastClosed) {
            if (now - parseInt(lastClosed) < 86400000) {
                shouldOpen = false;
            }
        }

        if (shouldOpen) {
            setCollapsed(true)
        }
    }, [])

    useEffect(() => {
        if (forceEmailStep) {
            setCurrentStep(2)
            setCollapsed(true)
        }
    }, [forceEmailStep])

    const handleOpenClose = () => {
        setCollapsed(!collapsed)
        if (first_steps.keep_open) {
            set_keep_open_first_steps_false()
        }
    };

    const handleDoItLater = () => {
        const now = new Date().getTime();
        localStorage.setItem('onboardingLastClosed', now.toString());
        setCollapsed(false);
        if (first_steps.keep_open) {
            set_keep_open_first_steps_false()
        }
    };

    const steps = {
        1: {
            id: 1,
            label: 'Bienvenido a Topi!',
            done: selectedGoal !== null,
        },
        2: {
            id: 2,
            label: 'Conecta tu email a Topi',
            done: first_steps?.email || false,
        },
        3: {
            id: 3,
            label: 'Crea una cuenta de banco principal',
            done: first_steps?.bank || false,
        },
        4: {
            id: 4,
            label: 'Lectura automática de transacciones',
            done: (user_extra_data && user_extra_data.read_email) || false,
        }
    }

    const progress = (
        Object.values(steps).filter(step => step.done).length /
        Object.values(steps).length
    ) * 100;


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

    const handleGoalSelect = (goal) => {
        setSelectedGoal(goal);
        handleStepChange(1);
    };

    const handleCompletion = () => {
        // Close modal or final action
        handleOpenClose()
        NextStepsPopoverOnboarding()
    };


    return (

        <>
            <button
                className="mb-1 w-full bg-[#5266EB] hover:bg-blue-600 text-white font-semibold py-2 px-4 shadow-sm transition-colors"
                onClick={() => setCollapsed(true)}>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 justify-center">
                    <h2 className="text-white text-sm md:text-md font-semibold">👋 {user && user.name}, Automatiza tus transacciones aquí</h2>
                    <div className="w-3/4 sm:w-1/3 bg-gray-200/30 rounded-full h-4">
                        <div className="bg-green-500 rounded-full h-full flex items-center" style={{ width: `${progress}%` }}>
                            <p className="text-[10px] pl-2 text-white font-medium">
                                <span>{Math.round(progress)}%</span> completado
                            </p>
                        </div>
                    </div>
                </div>
            </button>

            <Transition show={collapsed} as={Fragment}>
                <Dialog as="div" className="relative z-50 font-Inter" onClose={() => { }}>
                    <TransitionChild
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />
                    </TransitionChild>

                    <div className="fixed inset-0 z-10 overflow-y-auto w-screen">
                        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                            <TransitionChild
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                {/**/}
                                <DialogPanel className="relative transform overflow-hidden rounded-3xl bg-white dark:bg-[#151C2C] text-left shadow-2xl transition-all w-full max-w-2xl p-6 sm:p-8">
                                    {/* ANTERIOR SIGUIENTE NAVEGACION */}
                                    <div className='w-full flex flex-col'>
                                        <div className='flex flex-row items-center gap-3 mb-4'>
                                            <div className="w-full bg-gray-200 rounded-full h-3">
                                                <div className="bg-green-500 rounded-full h-full flex justify-center items-center" style={{ width: `${progress}%` }}>
                                                    <p className="text-[9px] text-white font-medium">
                                                        <span>{Math.round(progress)}%</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div type="button"
                                                onClick={e => handleDoItLater()}
                                                className="cursor-pointer text-gray-500 bg-transparent hover:bg-gray-100 rounded-lg text-xs px-2 py-1 flex-shrink-0 font-medium dark:text-gray-300 dark:hover:bg-gray-700">
                                                Hacerlo más tarde
                                            </div>
                                        </div>

                                        {/* <div className='my-2 p-2 bg-white border border-gray-200 rounded-2xl flex flex-col'>
                                            {Object.values(steps).map((step) => (
                                                <div key={step.id} className={`flex items-center mb-2 ${currentStep === step.id ? 'font-bold' : ''}`}>
                                                    <div className={`w-5 h-5 mr-2 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
                                                        {step.done ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        ) : (
                                                            step.id
                                                        )}
                                                    </div>
                                                    <span className={`text-sm ${currentStep === step.id ? 'text-gray-900' : 'text-gray-600'}`}>{step.label}</span>
                                                </div>
                                            ))}

                                        </div> */}


                                        <div className='w-full justify-between my-2 px-2 py-4 bg-white border border-gray-200 rounded-2xl flex flex-row gap-1'>

                                            {currentStep === 1 ?
                                                <></> :
                                                <button onClick={() => handleStepChange(-1)} className='hover:text-[#5266EB]'>
                                                    <ChevronLeftIcon className='w-4 h-4' />
                                                </button>
                                            }
                                            {currentStep === 4 ?
                                                <></> :
                                                <div></div>
                                            }
                                            <DialogTitle as="h3" className="text-lg font-bold leading-6 text-gray-900 dark:text-white">
                                                {steps[currentStep].label}
                                            </DialogTitle>

                                            {currentStep === 1 ?
                                                <></> :
                                                <div></div>
                                            }

                                            {currentStep === 4 ?
                                                <></> :
                                                (currentStep >= 2 && !steps[currentStep].done) ?
                                                    <div className='w-4 h-4'></div> :
                                                    <button onClick={() => handleStepChange(1)} className='hover:text-[#5266EB]'>
                                                        <ChevronRightIcon className='w-4 h-4' />
                                                    </button>
                                            }

                                        </div>
                                    </div>


                                    {/* CONTENIDO PASO*/}
                                    <div className='p-2'>

                                        {currentStep === 1 ?
                                            <GoalSelection
                                                onSelect={handleGoalSelect}
                                            />
                                            : <></>
                                        }

                                        {currentStep === 2 ?
                                            <StepLinkEmail
                                                onNext={() => handleStepChange(1)}
                                                onBack={() => handleStepChange(-1)}
                                            />
                                            : <></>
                                        }

                                        {currentStep === 3 ?
                                            <StepCreateAccount
                                                onNext={() => handleStepChange(1)}
                                                onBack={() => handleStepChange(-1)}
                                            />
                                            : <></>
                                        }

                                        {currentStep === 4 ?
                                            <StepCompletion
                                                onBack={() => handleStepChange(-1)}
                                                onFinish={() => handleCompletion()}
                                            />
                                            : <></>
                                        }

                                    </div>


                                    {/* ANTERIOR SIGUIENTE NAVEGACIO*/}
                                    {/* <div className='w-full justify-between mt-3 px-2 py-1 flex flex-row gap-1 border-t border-gray-200'>
                                        {currentStep === 1 ?
                                            <></> :
                                            <button onClick={() => handleStepChange(-1)} className='hover:text-[#5266EB] flex flex-row items-center gap-2'>
                                                <ChevronLeftIcon className='w-4 h-4' /> Anterior
                                            </button>
                                        }
                                        {currentStep === 4 ?
                                            <></> :
                                            <div></div>
                                        }
                                        {currentStep === 1 ?
                                            <></> :
                                            <div></div>
                                        }
                                        {currentStep === 4 ?
                                            <></> :
                                            <button onClick={() => handleStepChange(1)} className='hover:text-[#5266EB] flex flex-row items-center gap-2'>
                                                Siguiente <ChevronRightIcon className='w-4 h-4' />
                                            </button>
                                        }
                                    </div> */}

                                </DialogPanel>
                            </TransitionChild>
                        </div>
                    </div>
                </Dialog>
            </Transition>

        </>

    );
};

const mapStateToProps = (state) => ({

    user: state.Auth.user,
    first_steps: state.CashFlow.first_steps,
    user_extra_data: state.Auth.user_extra_data,


});

export default connect(mapStateToProps, {
    set_keep_open_first_steps_false,
    get_user_transactions,
})(Onboarding2)