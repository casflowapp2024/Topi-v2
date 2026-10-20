import { Link } from "react-router-dom";

const SUPPORT_EMAIL = "cashflowapp2024@gmail.com";

// Sin servicio de correo no hay códigos de recuperación: el admin restablece la cuenta
// (infra/scripts/reset-password.sh) y al entrar el usuario vuelve a crear su contraseña.
const ForgotPassword = () => {
    return (
        <div className="w-screen min-h-screen bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB] to-95% font-Inter">
            <div className="py-20 flex flex-col items-center px-4">
                <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
                    <div className="p-6 md:p-8 space-y-4">
                        <h5 className="text-xl font-medium text-gray-900 dark:text-white">¿Olvidaste tu contraseña?</h5>
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            Escríbenos a{" "}
                            <a href={`mailto:${SUPPORT_EMAIL}?subject=Restablecer%20contrase%C3%B1a%20Topi`} className="text-blue-700 underline">
                                {SUPPORT_EMAIL}
                            </a>{" "}
                            desde el correo de tu cuenta y la restablecemos.
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-200">
                            Cuando te confirmemos, entra con tu correo y Topi te pedirá crear una contraseña nueva.
                        </p>
                        <Link to="/login/" className="block w-full text-center text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5">
                            Volver al inicio de sesión
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
