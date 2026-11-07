import { useState, useEffect } from 'react';
//redux
import { connect } from 'react-redux';
import { set_keep_open_first_steps_false, get_user_transactions } from '../redux/actions/cashflow';
//components
import GoalSelection from '../components/onboarding2/GoalSelection';
import StepLinkEmail from '../components/onboarding2/StepLinkEmail';
import StepCreateAccount from '../components/onboarding2/StepCreateAccount';
import StepCompletion from '../components/onboarding2/StepCompletion';

import { ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/20/solid';
import Modal from '../components/ui/Modal';

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


    // flechas: igual que antes (sin "anterior" en el paso 1; sin "siguiente" en el 4 ni si el paso no está hecho)
    const canBack = currentStep > 1;
    const canNext = currentStep < 4 && !(currentStep >= 2 && !steps[currentStep].done);
    const arrow = 'h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-topi-600 dark:hover:bg-gray-800 dark:hover:text-topi-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500';

    return (

        <>
            <button type="button"
                className="mb-1 w-full bg-topi-500 hover:bg-topi-600 text-white font-semibold py-2 px-4 shadow-sm transition-colors"
                onClick={() => setCollapsed(true)}>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 justify-center">
                    <h2 className="text-white text-sm md:text-md font-semibold">👋 {user && user.name}, Automatiza tus transacciones aquí</h2>
                    <div className="w-3/4 sm:w-1/3 bg-gray-200/30 rounded-full h-4">
                        <div className="bg-status-ok rounded-full h-full flex items-center" style={{ width: `${progress}%` }}>
                            <p className="text-[10px] pl-2 text-white font-medium">
                                <span>{Math.round(progress)}%</span> completado
                            </p>
                        </div>
                    </div>
                </div>
            </button>

            {/* No se cierra con Esc ni clic fuera: la salida es "Hacerlo más tarde" */}
            <Modal open={collapsed} onClose={handleDoItLater} dismissible={false} size="xl"
                title={steps[currentStep].label} description={`Paso ${currentStep} de 4`}>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5" role="progressbar"
                            aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de los primeros pasos">
                            <div className="bg-status-ok rounded-full h-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-ink-2 dark:text-gray-400">{Math.round(progress)}%</span>
                        <button type="button" onClick={() => handleDoItLater()}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-ink-2 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
                            Hacerlo más tarde
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 px-2 py-1">
                        {canBack
                            ? <button type="button" onClick={() => handleStepChange(-1)} aria-label="Paso anterior" className={arrow}><ChevronLeftIcon className="w-5 h-5" aria-hidden="true" /></button>
                            : <span className="w-9" />}
                        <ol className="flex items-center gap-1.5" aria-label="Pasos">
                            {Object.values(steps).map(st => (
                                <li key={st.id} aria-current={st.id === currentStep ? 'step' : undefined}
                                    className={`h-2 rounded-full transition-all ${st.id === currentStep ? 'w-6 bg-topi-500' : st.done ? 'w-2 bg-status-ok' : 'w-2 bg-gray-300 dark:bg-gray-600'}`}>
                                    <span className="sr-only">{`Paso ${st.id}: ${st.label}${st.done ? ' (hecho)' : ''}`}</span>
                                </li>
                            ))}
                        </ol>
                        {canNext
                            ? <button type="button" onClick={() => handleStepChange(1)} aria-label="Paso siguiente" className={arrow}><ChevronRightIcon className="w-5 h-5" aria-hidden="true" /></button>
                            : <span className="w-9" />}
                    </div>

                    {/* CONTENIDO PASO*/}
                    <div>
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
                </div>
            </Modal>

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