

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
//redux
import { connect } from 'react-redux';
import { request_code_reset_password, reset_password } from '../redux/actions/auth';
import { resend_activate_code, activate } from "../redux/actions/auth";
import { setAlert } from "../redux/actions/alert";
//components
import { ThreeDots } from 'react-loader-spinner';
import Alert2 from "../components/alert2";
import Alert from "../components/alert";

const VerifyEmailCode = ({
    request_code_reset_password,
    reset_password,
    resend_activate_code, activate,
    setAlert
}) => {


    //Enviar Codigo
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [codeSended, setCodeSended] = useState(false)
    const [resetSucces, setResetSucces] = useState(false)


    const [loginFormData, setLoginFormData] = useState({
        email: '',
        activateCode: '',
    });

    const onChange = e => setLoginFormData({ ...loginFormData, [e.target.name]: e.target.value })

    const {
        email,
        activateCode,
    } = loginFormData;

    //timer resend code

    const [timer, setTimer] = useState(20);
    const [canResend, setCanResend] = useState(false);

    useEffect(() => {
        let interval;
        if (timer > 0) {
            setCanResend(false);
            interval = setInterval(() => {
                setTimer(prev => prev - 1);
            }, 1000);
        } else {
            setCanResend(true);
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [timer]);


    const onSubmitCodeRequest = async (e) => {
        e.preventDefault();
        setLoadingRequest(true)
        const codeResponse = await resend_activate_code(email)
        setTimer(20)

        if (codeResponse) {
            setLoadingRequest(false)
            setCodeSended(true)
        } else {
            setAlert("No se pudo solicitar código, intenta de nuevo.", false, "white", "bg-red-500", 2000)
            setLoadingRequest(false)
        }
    }

    const navigate = useNavigate();
    const onSubmitActivateAccount = async (e) => {
        e.preventDefault();
        setLoadingRequest(true)
        const resetResponse = await activate(activateCode, email)

        if (resetResponse) {
            setLoadingRequest(false)
            setResetSucces(true)
            setAlert("Tu cuenta ha sido activada con exito, ya puedes iniciar sesión.", true, "", "", 3000)
            setTimeout(() => {
                navigate("/")
            }, 2000)
        } else {
            setAlert("No se pudo verificar tu email. Ingresa el ultimo código que te enviamos", false, "white", "bg-red-500", 2000)
            setLoadingRequest(false)
        }
    }



    return (
        <div className='relative bg-gray-100 h-screen w-screen overflow-hidden font-Inter'>


            <div className='fixed top-20 w-screen flex flex-col justify-center items-center'>

                <div className="overflow-hidden w-full max-w-sm bg-white border  rounded-lg shadow dark:bg-gray-800">
                    <div class="p-4   sm:p-6 md:p-8 ">
                        {resetSucces ?
                            <Alert2 /> :

                            <form class="space-y-4 justify-center flex flex-col" action="#">
                                <h5 class="text-xl font-medium text-gray-900 text-center dark:text-white">CASHFLOW</h5>

                                {codeSended ?
                                    <>
                                        <p class="text-md text-gray-800 dark:text-white text-center">Revisa tu email!, enviamos un código de verificación.</p>
                                        <div>
                                            <label for="activateCode" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Código de Verificación</label>
                                            <input type="text" name="activateCode" id="activateCode" placeholder=""
                                                value={activateCode}
                                                onChange={e => onChange(e)}
                                                required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                        </div>

                                        <div class="flex flex-row text-xs font-medium text-gray-500 dark:text-gray-300">
                                            Aún no lo has recibido?
                                            <div class="">
                                                {canResend ?
                                                    <span
                                                        onClick={onSubmitCodeRequest}
                                                        className="cursor-pointer pl-1 text-blue-700 hover:underline dark:text-blue-500">Solicitar de nuevo</span> :
                                                    <span className=" pl-1 text-gray-400">
                                                        {`Solicitar de nuevo en ${timer}`}
                                                    </span>

                                                }
                                            </div>
                                        </div>
                                    </> :
                                    <>
                                        <p class="text-md text-gray-800 dark:text-white text-center">Enviaremos a tu email un código para activar tu cuenta.</p>
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
                                                onClick={onSubmitActivateAccount}
                                                class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                Verificar Código</button> :

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
    resend_activate_code, activate,
    setAlert

})(VerifyEmailCode)




