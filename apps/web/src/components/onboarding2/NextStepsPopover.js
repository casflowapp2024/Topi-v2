import { Fragment } from 'react';
import { Dialog, Transition, TransitionChild, DialogPanel, DialogTitle } from '@headlessui/react';
import {
    CreditCardIcon,
    TagIcon,
    BanknotesIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

const NextStepsPopover = ({ open, setOpen }) => {
    const navigate = useNavigate();

    const closePopover = () => {
        setOpen(false);
    };

    const handleGoHome = () => {
        navigate('/');
        closePopover();
    };

    const steps = [
        {
            name: 'Cuentas',
            description: 'Ajusta saldos y agrega más cuentas bancarias o de efectivo.',
            icon: CreditCardIcon,
            action: () => {
                navigate('/dashboard/accounts');
                closePopover();
            },
            color: 'text-blue-600'
        },
        {
            name: 'Categorías',
            description: 'Organiza tus presupuestos y personaliza tus categorías de gastos.',
            icon: TagIcon,
            action: () => {
                navigate('/dashboard/budgets');
                closePopover();
            },
            color: ' text-purple-600'
        },
        {
            name: 'Transacciones',
            description: 'Gestiona tus movimientos, agrega, elimina o recategoriza.',
            icon: BanknotesIcon,
            action: () => {
                navigate('/dashboard/transactions');
                closePopover();
            },
            color: ' text-green-600'
        }
    ];

    return (
        <Transition show={open} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={closePopover}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-70 transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-start justify-center p-4 text-center  sm:p-0">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <DialogPanel className="relative transform overflow-hidden rounded-lg bg-white px-4 py-4 my-[120px] text-left shadow-xl transition-all sm:my-[100px] sm:w-full sm:max-w-lg sm:p-6">
                                <div className="absolute right-0 top-0 hidden pr-4 pt-4 sm:block">
                                    <button
                                        type="button"
                                        className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                        onClick={handleGoHome}
                                    >
                                        <span className="sr-only">Cerrar</span>
                                        <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                                    </button>
                                </div>
                                <div>
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                                        <span className="text-2xl">🎉</span>
                                    </div>
                                    <div className="mt-3 text-center sm:mt-5">
                                        <DialogTitle as="h3" className="text-lg font-semibold leading-6 text-gray-900">
                                            ¡Ya estás listo!
                                        </DialogTitle>
                                        <div className="mt-2">
                                            <p className="text-sm text-gray-500">
                                                Ahora puedes continuar organizando tus finanzas:
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-5 sm:mt-6 flex flex-col gap-3">
                                    {steps.map((step) => (
                                        <button
                                            key={step.name}
                                            onClick={step.action}
                                            className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left group"
                                        >
                                            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${step.color}`}>
                                                <step.icon className="h-6 w-6" aria-hidden="true" />
                                            </div>
                                            <div className="ml-4 flex-1">
                                                <h4 className="text-base font-medium text-gray-900 group-hover:text-indigo-600">
                                                    {step.name}
                                                </h4>
                                                <p className="text-sm text-gray-500">
                                                    {step.description}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-5 sm:mt-6">
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-md bg-[#5266EB] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                                        onClick={handleGoHome}
                                    >
                                        Entendido, ir al Dashboard
                                    </button>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default NextStepsPopover;
