import { useEffect } from "react";
import { connect } from 'react-redux';
import LinkTransEmailForm from '../conexions/LinkTransEmailForm';
import { CheckCircleIcon, ChevronRightIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { linkEmailToFirstAccount } from "../onboarding/onbActions";

const StepLinkEmail = ({
    onNext,
    onBack,
    email_done
}) => {

    useEffect(() => {
        if (email_done) {
            linkEmailToFirstAccount();
        }
    }, [email_done]);

    return (
        <div className="flex flex-col gap-4">
            <p className="text-gray-600 text-sm text-justify">
                Vincula el correo electrónico donde recibes las notificaciones de tus transacciones bancarias. Topi leerá estos correos para registrar tus gastos automáticamente.
            </p>

            <div className="border-t border-gray-200 my-2"></div>

            {email_done ? (
                <div className="flex flex-col items-center justify-center py-6 gap-4">
                    <CheckCircleIcon className="w-16 h-16 text-green-500" />
                    <p className="text-lg font-medium text-gray-900">¡Correo vinculado exitosamente!</p>
                    <p className="text-sm text-gray-500 text-center">
                        Ahora Topi podrá leer tus transacciones automáticamente.
                    </p>
                    <button
                        onClick={onNext}
                        className="mt-4 flex items-center gap-2 bg-[#5266EB] text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                        Siguiente <ChevronRightIcon className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <>
                    <LinkTransEmailForm
                        closedForm={null}
                        onCloseForm={null}
                        onSelectValue={null}
                        contextWindow="onboarding"
                    />

                    <div className="flex justify-between mt-4">
                        <button
                            onClick={onBack}
                            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                            <ChevronLeftIcon className="w-4 h-4" /> Atrás
                        </button>
                        {/* Option to skip or force completion? User requirement implies this is a step. 
                            If they can't complete it, maybe they are stuck. 
                            For now, I won't add a skip button unless requested, but I'll add a 'Next' button that is disabled until done, 
                            or just rely on the success state to show the next button as implemented above.
                        */}
                    </div>
                </>
            )}
        </div>
    );
};

const mapStateToProps = state => ({
    email_done: state.CashFlow.first_steps.email,
});

export default connect(mapStateToProps, {})(StepLinkEmail);
