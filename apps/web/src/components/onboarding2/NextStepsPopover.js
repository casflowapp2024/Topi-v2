import { CreditCardIcon, TagIcon, BanknotesIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

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
            color: 'text-data-balance bg-data-balance/10'
        },
        {
            name: 'Categorías',
            description: 'Organiza tus presupuestos y personaliza tus categorías de gastos.',
            icon: TagIcon,
            action: () => {
                navigate('/dashboard/budgets');
                closePopover();
            },
            color: 'text-data-ahorro bg-data-ahorro/10'
        },
        {
            name: 'Transacciones',
            description: 'Gestiona tus movimientos, agrega, elimina o recategoriza.',
            icon: BanknotesIcon,
            action: () => {
                navigate('/dashboard/transactions');
                closePopover();
            },
            color: 'text-data-ingreso bg-data-ingreso/10'
        }
    ];

    return (
        <Modal open={open} onClose={closePopover} title="¡Ya estás listo! 🎉"
            description="Ahora puedes continuar organizando tus finanzas:"
            footer={<Button onClick={handleGoHome}>Entendido, ir al Inicio</Button>}>
            <ul className="flex flex-col gap-3">
                {steps.map((step) => (
                    <li key={step.name}>
                        <button type="button" onClick={step.action}
                            className="w-full flex items-center gap-4 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
                            <span className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${step.color}`}>
                                <step.icon className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-base font-medium text-gray-900 dark:text-gray-100 group-hover:text-topi-600 dark:group-hover:text-topi-200">
                                    {step.name}
                                </span>
                                <span className="block text-sm text-ink-2 dark:text-gray-400">{step.description}</span>
                            </span>
                            <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
        </Modal>
    );
};

export default NextStepsPopover;
