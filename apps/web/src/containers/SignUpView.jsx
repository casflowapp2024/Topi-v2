import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
// REDUX
import { connect } from 'react-redux';
import { signup, activate, login_with_code, register_url_google_login } from '../redux/actions/auth';
import { resend_activate_code } from "../redux/actions/auth";
import { setAlert } from "../redux/actions/alert";
//components
import { ThreeDots } from 'react-loader-spinner';
import Alert2 from "../components/alert2";
import Alert from "../components/alert";

const SignUpView = ({
    signup,
    activate,
    resend_activate_code,
    setAlert,
    login_with_code,
    isAuthenticated,
    register_url_google_login

}) => {

    const [loadingCreate, setLoadingCreate] = useState(false);
    const [createSuccess, setCreateSuccess] = useState(false);
    const [errorMessages, setErrorMessages] = useState([]);
    const [errorMessagesOnSubmit, setErrorMessagesOnSubmit] = useState([]);

    const [signUpFormData, setSignUpFormData] = useState({
        name: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const onChange = (e) => {
        setErrorMessagesOnSubmit([]);
        setSignUpFormData({ ...signUpFormData, [e.target.name]: e.target.value })
        if (e.target.name === "password") {
            validatePassword(e.target.value);

        }
    }

    const {
        name,
        lastName,
        email,
        password,
        confirmPassword
    } = signUpFormData;

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

    };

    const validateSecondPassword = (pass, rePass) => {
        if (pass !== rePass) {
            setErrorMessagesOnSubmit(["Las contraseñas no coinciden"]);
            return false;
        } else if (errorMessages.length > 0) {
            setErrorMessagesOnSubmit(["La contraseña no cumple con los requisitos"]);
            return false;
        } else {
            setErrorMessagesOnSubmit([]);
            return true;
        }
    };

    const verifyPassword = (password, confirmPassword) => {
        if (password === confirmPassword) {
            if (errorMessages.length > 0) {
                return "1"
            } else {

                return true
            }
        } else {
            return "2"
        }
    }

    const onSubmitCreate = async (e) => {
        e.preventDefault();

        const passsame = verifyPassword(password, confirmPassword)
        const isValid = validateSecondPassword(password, confirmPassword);
        if (passsame === true && isValid) {
            /* setTimeout(() => {
                setLoadingCreate(false);
              }, 3000) */
            setLoadingCreate(true)
            const signUpResponse = await signup(name, lastName, email, password, confirmPassword)
            console.log(signUpResponse)
            if (signUpResponse === true) {
                setLoadingCreate(false)
                setCreateSuccess(true)
                setAlert('Tu cuenta ha sido Creada', true, 'text-white', 'bg-green-500', 10000)
            } else {
                setLoadingCreate(false)
                if (signUpResponse[0] === "UserLambdaValidationException: PreSignUp failed with error 409.") {
                    setAlert('Ya existe una cuenta con este email', false, 'text-red-600', 'bg-gray-200', 3500)
                } else if (signUpResponse[0] === "UserLambdaValidationException: PreSignUp failed with error 400.") {
                    setAlert('El email ingresado no es valido', false, 'text-red-600', 'bg-gray-200', 3500)
                } else {
                    setAlert('Algo salió mal la cuenta no fue creada', false, 'text-red-600', 'bg-gray-200', 3500)
                }
            }
        }
    }


    //verificacion codigo

    const [loadingCodeVerify, setLoadingCodeVerify] = useState(false);
    const [codeVerifySuccess, setCodeVerifySuccess] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');

    const [timer, setTimer] = useState(20);
    const [canResend, setCanResend] = useState(false);
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [codeSended, setCodeSended] = useState(false)

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
            setAlert("Hemos enviado un nuevo código a tu email", true, "white", "bg-green-500", 4000)
            setLoadingRequest(false)
            setCodeSended(true)
        } else {
            setAlert("No se pudo solicitar código, intenta de nuevo.", false, "white", "bg-red-500", 2000)
            setLoadingRequest(false)
        }
    }

    const navigate = useNavigate();

    const onSubmitVerify = async (e) => {
        e.preventDefault();
        setLoadingCodeVerify(true)
        console.log(verificationCode, email)
        const verifyCodeResponse = await activate(verificationCode, email)
        console.log(verifyCodeResponse)
        if (verifyCodeResponse === true) {

            setLoadingCodeVerify(false)
            setCodeVerifySuccess(true)
            setAlert("Cuenta activada con exito!.", true, "white", "bg-green-500", 2900)


        } else {
            console.log("failed code")
            setAlert("El código que ingresaste es incorrecto!", false, "white", "bg-red-500", 3000)
            setLoadingCodeVerify(false)
        }

    }

    useEffect(() => {
        if (codeVerifySuccess) {
            setTimeout(() => {
                navigate("/login")
            }, 1800)
        }
    }, [codeVerifySuccess]);


    //google sign in

    const [clickGoogleLogin, setClickGoogleLogin] = useState(false);

    const askForUrl = async () => {
        setClickGoogleLogin(true)
        const urlResponse = await register_url_google_login()
        //console.log("urlResponse", urlResponse)
        //setLoginUrl(urlResponse)
        window.location.href = urlResponse
    }


    useEffect(() => {
        if (isAuthenticated) {
            setTimeout(() => {
                navigate("/dashboard")
            }, 1)

        }
    }, [isAuthenticated]);

    return (
        <div className="w-screen min-h-screen h-full bg-center md:bg-cover bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB]  to-95%"
        /* style={{ backgroundImage: `url(${landImage})` ,}} */
        >
            <div className='py-6 flex min-h-screen h-full flex-col justify-center items-center'>
                {/* <h2 className='py-4 mt-10 text-2xl' >
                    CASHFLOW
                </h2> */}

                <div className="w-full max-w-sm">
                    {codeVerifySuccess ?
                        <Alert2 />
                        :
                        <>
                            {createSuccess ?
                                /* Cuenta creada con exito */
                                <div className="w-full max-w-sm  bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                                    <div class="p-4 sm:p-6 md:p-8 ">
                                        <h5 class="text-xl font-medium text-gray-900 dark:text-white text-center">{name} tu cuenta ha sido creada con Exito!!</h5>
                                        <p className='py-4'>Hemos enviado un código de verificación al correo {email}.</p>

                                        <div>
                                            <label for="email" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Tu email</label>
                                            <input type="email" name="email" id="email"
                                                value={email}
                                                onChange={e => onChange(e)}
                                                placeholder="name@email.com" required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                        </div>
                                        <div className='py-2'>
                                            <label for="code" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Código de verificación</label>
                                            <input type="text" name="code" id="code"
                                                value={verificationCode}
                                                onChange={e => setVerificationCode(e.target.value)}
                                                placeholder="123456" required
                                                class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                                            />
                                        </div>
                                        <div class="text-xs font-medium text-gray-500 dark:text-gray-300">
                                            Aún no lo has recibido?
                                            <button class="mb-2 text-blue-700 hover:underline dark:text-blue-500">
                                                {canResend ?
                                                    <span
                                                        onClick={onSubmitCodeRequest}
                                                        className="pl-1 text-blue-700 hover:underline dark:text-blue-500">Solicitar de nuevo</span> :
                                                    <span className="pl-1 text-gray-400 ">
                                                        {`Solicitar código de nuevo en ${timer}`}
                                                    </span>

                                                }
                                            </button>
                                        </div>
                                        {loadingCodeVerify ?

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
                                            <button
                                                type="submit"
                                                onClick={onSubmitVerify}
                                                class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                Confirma
                                            </button>

                                        }

                                    </div>
                                    <Alert />
                                </div>
                                :
                                /*  crear cuenta */
                                <div className="w-full max-w-sm  bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
                                    <div class="p-4 sm:p-6 md:p-6 dark:bg-gray-800">
                                        <form class="space-y-3" action="#">
                                            <h5 class="text-xl font-medium text-gray-900 dark:text-white">Crea tu Topi</h5>
                                            <div>
                                                <label for="name" class="block mb-1 text-sm font-medium text-gray-900 dark:text-white">Nombre</label>
                                                <input type="text" name="name" id="name"
                                                    value={name}
                                                    onChange={e => onChange(e)}
                                                    placeholder="nombre" required
                                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white"
                                                />
                                            </div>
                                            <div>
                                                <label for="lastName" class="block mb-1 text-sm font-medium text-gray-900 dark:text-white">Apellido</label>
                                                <input type="text" name="lastName" id="lastName"
                                                    value={lastName}
                                                    onChange={e => onChange(e)}
                                                    placeholder="apellido" required
                                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                            </div>
                                            <div>
                                                <label for="email" class="block mb-1 text-sm font-medium text-gray-900 dark:text-white">Tu email</label>
                                                <input type="email" name="email" id="email"
                                                    value={email}
                                                    onChange={e => onChange(e)}
                                                    placeholder="name@email.com" required
                                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                            </div>
                                            <div>
                                                <label for="password" class="block mb-1 text-sm font-medium text-gray-900 dark:text-white">Tu contraseña</label>
                                                <input type="password" name="password" id="password"
                                                    value={password}
                                                    onChange={e => onChange(e)}
                                                    placeholder="••••••••"
                                                    required
                                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                            </div>
                                            <ul className="mt-2 text-sm text-red-500">
                                                {errorMessages.map((msg, index) => (
                                                    <li key={index}>{msg}</li>
                                                ))}
                                            </ul>
                                            <div>
                                                <label for="confirmPassword" class="block mb-1 text-sm font-medium text-gray-900 dark:text-white">Confirma tu constraseña</label>
                                                <input type="password" name="confirmPassword" id="confirmPassword"
                                                    value={confirmPassword}
                                                    onChange={e => onChange(e)}
                                                    placeholder="••••••••"
                                                    required
                                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-1.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                                            </div>
                                            <ul className="mt-2 text-sm text-red-500">
                                                {errorMessagesOnSubmit.map((msg, index) => (
                                                    <li key={index}>{msg}</li>
                                                ))}
                                            </ul>
                                            {loadingCreate ?

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
                                                    <button
                                                        type="submit"
                                                        onClick={onSubmitCreate}
                                                        class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                                        Crea tu cuenta
                                                    </button>

                                                </>



                                            }

                                        </form>
                                        <div className="mt-4">
                                            <button className="gsi-material-button"
                                                onClick={askForUrl}>
                                                <div className="gsi-material-button-state"></div>
                                                <div className="gsi-material-button-content-wrapper">
                                                    <div className="gsi-material-button-icon">
                                                        <svg
                                                            version="1.1"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 48 48"
                                                            style={{ display: 'block' }}
                                                        >
                                                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                                                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                                                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                                                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                                                            <path fill="none" d="M0 0h48v48H0z"></path>
                                                        </svg>
                                                    </div>
                                                    {clickGoogleLogin ?
                                                        <div
                                                            class="w-full  ">
                                                            <div className='flex justify-center items-center'>
                                                                <ThreeDots
                                                                    height="40"
                                                                    width="40"
                                                                    color="#1d4ed8"
                                                                    ariaLabel="loading"
                                                                />
                                                            </div>
                                                        </div>
                                                        :
                                                        <span className="gsi-material-button-contents">Continua con Google</span>
                                                    }
                                                    <span style={{ display: 'none' }}>Continua con Google</span>
                                                </div>
                                            </button>
                                        </div>
                                        <p className="text-sm text-center mt-6">
                                            Al continuar aceptas <Link to="/terms-of-service/" className="text-blue-600 underline">terminos y condiciones</Link>
                                        </p>

                                    </div>
                                    <Alert />
                                </div>
                            }

                        </>
                    }
                </div>



            </div>
        </div>

    )
}

const mapStateToProps = state => ({
    isAuthenticated: state.Auth.isAuthenticated,
    user: state.Auth.user

})

export default connect(mapStateToProps, {
    signup,
    activate,
    resend_activate_code,
    setAlert,
    login_with_code,
    register_url_google_login

})(SignUpView)




