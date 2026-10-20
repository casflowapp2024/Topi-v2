import { connect } from 'react-redux';
import { use, useEffect, useState } from "react";
//redux actions
import { login, load_user, login_with_code, register_url_google_login } from '../redux/actions/auth';
import { useNavigate } from "react-router-dom";
import { setAlert } from '../redux/actions/alert';

//components
import Alert from '../components/alert'
//uxui
import { ThreeDots } from 'react-loader-spinner';

const LogInView = ({
    login,
    isAuthenticated,
    load_user,
    login_with_code,
    register_url_google_login,
    setAlert
}) => {


    const [authCompleted, setAuthCompleted] = useState(false);
    const [loadingLogin, setLoadingLogin] = useState(false);


    const [loginFormData, setLoginFormData] = useState({
        email: '',
        password: ''
    });

    const onChange = e => setLoginFormData({ ...loginFormData, [e.target.name]: e.target.value })

    const {
        email,
        password
    } = loginFormData;


    const onSubmitLogIn = async (e) => {
        e.preventDefault();
        setLoadingLogin(true)
        const loginResponse = await login(email, password)
        if (loginResponse === true) {
            setLoadingLogin(false)
            setAlert("Inicio de sesión con éxito", true, "text-white", "bg-green-500", 3000)
        } else {
            console.log("else", loginResponse)
            setLoadingLogin(false)
            if (loginResponse[0] === "user is not authorized, incorrect username or password") {
                setAlert('El email o la constaseña son incorrectos!', false, 'text-red-600', 'bg-gray-200', 3500)
            } else {
                setAlert('Algo salió mal la cuenta no se puede iniciar sesión en este momento', false, 'text-red-600', 'bg-gray-200', 3500)
            }
        }
    }

    const navigate = useNavigate();
    useEffect(() => {

        if (isAuthenticated) {
            load_user()
            setTimeout(() => {
                setLoadingLogin(false);
                navigate("/dashboard")
            }, 1)

        }
    }, [isAuthenticated]);



    ///////////////////////////google sign in///////////////////////////7

    const [loginUrl, setLoginUrl] = useState("");

    useEffect(() => {
        askForUrl()
    }, []);

    const askForUrl = async () => {
        const urlResponse = await register_url_google_login()
        console.log("urlResponse", urlResponse)
        setLoginUrl(urlResponse)
        return (urlResponse)
    }


    const handleGoogleLogin = (loginUrl) => {
        console.log("handleGoogleLogin", loginUrl)
        const url = loginUrl

        const width = 500;
        const height = 600;
        const left = (window.screen.width / 2) - (width) / 10;
        const top = 100;

        const popup = window.open(
            url,
            "GoogleSignIn",
            `width=${width}, height=${height}, top=${top}, left=${left}`
        );

        // Listen for a message from the popup
        window.addEventListener("message", function handleMessage(event) {
            const { code } = event.data;
            if (code) {
                console.log("Authorization code received:", code);
                login_with_code(code)

                // Clean up the listener
                window.removeEventListener("message", handleMessage);

                // Now you can exchange this code with your backend for tokens
            }
        });
    };


    return (
        <div className='relative bg-gray-100 h-screen w-screen overflow-hidden font-Inter'>
            <div
                className="w-screen h-screen bg-repeat-y md:bg-no-repeat bg-center md:bg-cover bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB]  to-95%"

            /* style={{ backgroundImage: `url(${landImage})` ,}} */
            >
            </div>

            <div className='fixed top-20 w-screen flex flex-col justify-center items-center'>

                <div className='w-full max-w-sm bg-white border border-gray-200 rounded-lg shadow  dark:bg-gray-800 dark:border-gray-700 overflow-hidden'>
                    <div class="p-4 sm:p-6 md:p-8">

                        <form class="space-y-6" action="#">
                            <h5 class="text-xl font-medium text-gray-900 dark:text-white">Inicia Sesión</h5>
                            <div>
                                <label for="email" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Email</label>
                                <input type="email" name="email" id="email"
                                    value={email}
                                    onChange={e => onChange(e)}
                                    placeholder="nombre@email.com" required
                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                            </div>
                            <div>
                                <label for="password" className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Contraseña</label>
                                <input type="password" name="password" id="password" placeholder="••••••••"
                                    value={password}
                                    onChange={e => onChange(e)}
                                    required
                                    class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-600 dark:border-gray-500 dark:placeholder-gray-400 dark:text-white" />
                            </div>
                            <div class="flex items-start">
                                <div class="flex items-start">
                                    {/* <div class="flex items-center h-5">
                                        <input id="remember" type="checkbox" value="" className="w-4 h-4 border border-gray-300 rounded bg-gray-50 focus:ring-3 focus:ring-blue-300 dark:bg-gray-700 dark:border-gray-600 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800" required />
                                    </div>
                                    <label for="remember" className="ms-2 text-sm font-medium text-gray-900 dark:text-gray-300">Recuerdame</label> */}
                                </div>
                                <a href="/forgot_password/" className="ms-auto text-sm text-blue-700 hover:underline dark:text-blue-500">Olvidaste tu contraseña?</a>
                            </div>
                            {loadingLogin ?
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
                                    onClick={onSubmitLogIn}
                                    class="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">
                                    Iniciar Sesión</button>
                            }

                        </form>
                        {loadingLogin ?
                            <></> :
                            <>
                                <div className="mt-6">
                                    {loginUrl && loginUrl !== "" ?
                                        <div className="flex justify-center">
                                            <button className="gsi-material-button"
                                                onClick={() => handleGoogleLogin(loginUrl)}>
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
                                                    <span className="gsi-material-button-contents">Continua con Google</span>
                                                    <span style={{ display: 'none' }}>Continua con Google</span>
                                                </div>
                                            </button>
                                        </div>
                                        :
                                        <div className="flex justify-center">
                                            <ThreeDots
                                                height="40"
                                                width="40"
                                                color="#5266EB"
                                                ariaLabel="loading"
                                            />
                                        </div>
                                    }
                                </div>
                                <div className='mt-2 flex flex-col gap-4'>

                                    <div class="text-sm font-medium text-gray-500 dark:text-gray-300">
                                        Aún no estás registrado? <a href="/create_account/" class="text-blue-700 hover:underline dark:text-blue-500">Crear cuenta</a>
                                    </div>
                                    <div class="text-xs font-medium text-gray-500 dark:text-gray-300">
                                        Estás registrado pero no has verificado tu cuenta? <a href="/verify_email/" class="text-blue-700 hover:underline dark:text-blue-500">Verifica tu correo</a>
                                    </div>
                                </div>
                            </>

                        }
                    </div>
                    <div>
                        <Alert />
                    </div>
                </div>

            </div>
        </div>

    )
}

const mapStateToProps = state => ({
    isAuthenticated: state.Auth.isAuthenticated,

})

export default connect(mapStateToProps, {
    login, load_user, login_with_code, register_url_google_login, setAlert

})(LogInView)




