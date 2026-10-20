import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
// REDUX
import { connect } from 'react-redux';
import { signup } from '../redux/actions/auth';
import { setAlert } from "../redux/actions/alert";
import { passwordErrors } from "../lib/passwordPolicy";
//components
import { ThreeDots } from 'react-loader-spinner';
import Alert from "../components/alert";

const SignUpView = ({
    signup,
    setAlert,
    isAuthenticated,
}) => {

    const [loadingCreate, setLoadingCreate] = useState(false);
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
        setErrorMessages(passwordErrors(value));
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
                // la API ya no pide verificar el correo: el usuario queda logueado y entra al dashboard
                setLoadingCreate(false)
                setAlert('Tu cuenta ha sido creada', true, 'text-white', 'bg-green-500', 3000)
            } else {
                setLoadingCreate(false)
                if (signUpResponse[0] === "user already exists") {
                    setAlert('Ya existe una cuenta con este email', false, 'text-red-600', 'bg-gray-200', 3500)
                } else if (signUpResponse[0] === "password doesnt meet the requirements") {
                    setAlert('La contraseña no cumple con los requisitos', false, 'text-red-600', 'bg-gray-200', 3500)
                } else if (signUpResponse[0] === "limit exceeded, too many requests") {
                    setAlert('Demasiados intentos, espera un minuto e inténtalo de nuevo', false, 'text-red-600', 'bg-gray-200', 3500)
                } else {
                    setAlert('Algo salió mal la cuenta no fue creada', false, 'text-red-600', 'bg-gray-200', 3500)
                }
            }
        }
    }


    const navigate = useNavigate();

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
                                        <p className="text-sm text-center mt-6">
                                            Al continuar aceptas <Link to="/terms-of-service/" className="text-blue-600 underline">terminos y condiciones</Link>
                                        </p>

                                    </div>
                                    <Alert />
                                </div>
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
    setAlert,
})(SignUpView)




