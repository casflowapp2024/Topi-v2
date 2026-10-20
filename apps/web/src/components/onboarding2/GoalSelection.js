import { CheckCircleIcon } from '@heroicons/react/24/outline';

const GoalSelection = ({ onSelect }) => {
    const goals = [
        {
            id: 1,
            title: "Organizar gastos",
            description: "Entender a dónde va mi dinero y tener control total.",
            icon: "💰"
        },
        {
            id: 2,
            title: "Ahorrar para algo grande",
            description: "Establecer metas y guardar dinero para el futuro.",
            icon: "🏠"
        },
        {
            id: 3,
            title: "Crecer mi patrimonio",
            description: "Invertir y hacer que mi dinero trabaje para mí.",
            icon: "🚀"
        }
    ];

    return (
        <div className="flex flex-col gap-4">
            <p className="text-gray-600 mb-4">
                Para personalizar tu experiencia, cuéntanos cuál es tu objetivo principal financiero al usar Topi.
            </p>
            <div className="grid grid-cols-1 gap-4">
                {goals.map((goal) => (
                    <div
                        key={goal.id}
                        onClick={() => onSelect(goal)}
                        className="cursor-pointer border border-gray-200 rounded-xl p-4 hover:bg-blue-50 hover:border-blue-300 transition-all flex items-center gap-4 group"
                    >
                        <div className="text-3xl  rounded-full p-2 ">
                            {goal.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">{goal.title}</h3>
                            <p className="text-sm text-gray-500 group-hover:text-blue-600">{goal.description}</p>
                        </div>
                        <div className="text-gray-300 group-hover:text-blue-500">
                            <CheckCircleIcon className="w-6 h-6" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GoalSelection;
