import { useEffect } from "react";
import { connect } from 'react-redux';
import { useNavigate } from "react-router-dom";
import { load_user } from '../redux/actions/auth';
import Alert from '../components/alert';
import PasswordResetForm from '../components/auth/PasswordResetForm';

// Recuperar la contraseña en dos pasos: correo -> código de 6 dígitos + contraseña nueva.
// Al cambiarla la API cierra las demás sesiones y deja al usuario dentro.
const ForgotPassword = ({ isAuthenticated, load_user }) => {
    const navigate = useNavigate();

    useEffect(() => {
        if (isAuthenticated) {
            load_user();
            navigate("/dashboard");
        }
    }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="w-screen min-h-screen bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB] to-95% font-Inter">
            <div className="py-20 flex flex-col items-center px-4">
                <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 md:p-8">
                        <PasswordResetForm onCancel={() => navigate("/login/")} />
                    </div>
                    <div>
                        <Alert />
                    </div>
                </div>
            </div>
        </div>
    );
};

const mapStateToProps = state => ({
    isAuthenticated: state.Auth.isAuthenticated,
});

export default connect(mapStateToProps, { load_user })(ForgotPassword);
