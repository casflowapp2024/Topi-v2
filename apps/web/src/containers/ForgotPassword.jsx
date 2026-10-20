

import { useState } from "react";
import { useNavigate } from "react-router-dom";
//redux
import { connect } from 'react-redux';
import { request_code_reset_password, reset_password } from '../redux/actions/auth';
import { setAlert } from "../redux/actions/alert";
//components
import { ThreeDots } from 'react-loader-spinner';
import Alert2 from "../components/alert2";
import Alert from "../components/alert";

const ForgotPassView = ({
    request_code_reset_password,
    reset_password,
    setAlert
}) => {


    //Enviar Codigo

    const [loadingRequest, setLoadingRequest] = useState(false);
    const [codeSended, setCodeSended] = useState(false)
    const [resetSucces, setResetSucces] = useState(false)
    const [errorMessages, setErrorMessages] = useState([]);

    const [loginFormData, setLoginFormData] = useState({
        email: '',
        resetCode: '',
        newPassword: '',
        newPasswordConfirm: ''
    });

    const onChange = (e) => {
        setLoginFormData({ ...loginFormData, [e.target.name]: e.target.value })
        if (e.target.name === "newPassword") {
            validatePassword(e.target.value);

        }
    }

    const {
        email,
        resetCode,
        newPassword,
        newPasswordConfirm
    } = loginFormData;


    const onSubmitCodeRequest = async (e) => {
        e.preventDefault();
        setLoadingRequest(true)
        const codeResponse = await request_code_reset_password(email)

        if (codeResponse) {
            setLoadingRequest(false)
            setCodeSended(true)
        } else {
            setAlert("No se pudo solicitar código, intenta de nuevo.", false, "white", "bg-red-500", 2000)
            setLoadingRequest(false)
        }
    }

    const navigate = useNavigate();


    const onSubmitChangeRequest = async (e) => {
        e.preventDefault();
        setLoadingRequest(true)

        if (newPassword !== newPasswordConfirm) {
            setAlert("Las contraseñas no coinciden", false, "white", "bg-red-500", 2000)
            setLoadingRequest(false)
            return
        } else {
            const resetResponse = await reset_password(email, newPassword, newPasswordConfirm, resetCode)

            if (resetResponse) {
                setLoadingRequest(false)
                setResetSucces(true)
                setAlert("Tu contraseña ha sido restablecida", true, "", "", 3000)
                setTimeout(() => {
                    navigate("/")
                }, 2000)
            } else {
                setAlert("No se pudo crear la nueva contraseña. Verifica el código", false, "white", "bg-red-500", 4000)
                setLoadingRequest(false)
            }
        }



    }

    const validatePassword = (value) => {
        const errors = [];
        const regexSpecial = /[@$!%*?&]/;
        const regexNumber = /\d/;
        const regexUpper = /[A-Z]/;
        const regexLower = /[a-z]/;

        if (value.length < 8) errors.push("Al menos 8 caracteres");
        if (!regexNumber.test(value)) errors.push("Al menos un numero");
        if (!regexSpecial.test(value)) errors.push("Al menos un caracter especial (@, $, !, %, *, ?, &)");
        if (!regexUpper.test(value)) errors.push("Al menos una letra en mayuscula");
        if (!regexLower.test(value)) errors.push("Al menos una letra en minuscula");

        setErrorMessages(errors);

    }


    return (
        <div className='relative bg-gray-100 h-screen w-screen overflow-hidden font-Inter'>

            <div className='fixed top-20 w-screen flex flex-col justify-center items-center'>

                <div className="overflow-hidden w-full max-w-sm bg-white border  rounded-lg shadow dark:bg-gray-800">
                    <div class="p-4   sm:p-6 md:p-8 ">
                        {resetSucces ?
                            <Alert2 /> :

                            <form class="space-y-4 justify-center flex flex-col" action="#">
                                <h5 class="text-xl font-medium text-gray-900 text-center dark:text-white">Topi</h5>

                                {codeSended ?
                                    <>
                                        <p class="text-md text-gray-800 dark:text-white text-center">Revisa tu email!, Enviamos un código de verificación para restablecer tu constaseña.</p>
                                        <div>
                                            <label for="resetCode" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Código de Verificación</label>
                                            <input type="text" name="resetCode" id="resetCode" placeholder=""
                                                value={resetCode}
                                                onChange={e => onChange(e)}
                                                required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                        </div>
                                        <div>
                                            <label for="newPassword" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Nueva Contraseña</label>
                                            <input type="password" name="newPassword" id="newPassword" placeholder="••••••••"
                                                value={newPassword}
                                                onChange={e => onChange(e)}
                                                required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                        </div>
                                        <ul className="mt-2 text-sm text-red-500">
                                            {errorMessages.map((msg, index) => (
                                                <li key={index}>{msg}</li>
                                            ))}
                                        </ul>
                                        <div>
                                            <label for="newPasswordConfirm" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Confirma tu Nueva Contraseña</label>
                                            <input type="password" name="newPasswordConfirm" id="newPasswordConfirm" placeholder="••••••••"
                                                value={newPasswordConfirm}
                                                onChange={e => onChange(e)}
                                                required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                        </div>
                                    </> :
                                    <>
                                        <p class="text-md text-gray-800 dark:text-white text-center">Enviaremos a tu email un código para restablecer tu constaseña.</p>
                                        <div>
                                            <label for="email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email</label>
                                            <input type="email" name="email" id="email"
                                                value={email}
                                                onChange={e => onChange(e)}
                                                placeholder="nombre@email.com" required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                        </div>
                                    </>

                                }

                                {loadingRequest ?
                                    <div
                                        class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                        <div className='flex justify-center items-center'>
                                            <ThreeDots
                                                height="20"
                                                width="20"
                                                color="white"
                                                ariaLabel="loading"
                                            />
                                        </div>
                                    </div>

                                    :
                                    <>
                                        {codeSended ?
                                            <button
                                                type="submit"
                                                onClick={onSubmitChangeRequest}
                                                class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                Cambiar Contraseña</button> :

                                            <button
                                                type="submit"
                                                onClick={onSubmitCodeRequest}
                                                class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                Solicitar Código</button>
                                        }
                                    </>
                                }
                            </form>

                        }
                    </div>
                    {resetSucces ?
                        <>
                        </> :
                        <Alert />
                    }
                </div>
            </div>
        </div>

    )
}

const mapStateToProps = state => ({

})

export default connect(mapStateToProps, {
    request_code_reset_password,
    reset_password,
    setAlert

})(ForgotPassView)




