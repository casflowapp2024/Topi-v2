import { connect } from 'react-redux';
import { useEffect, useState } from "react";
//redux actions
import { login, load_user } from '../redux/actions/auth';
import { useNavigate } from "react-router-dom";
import { setAlert } from '../redux/actions/alert';

//components
import Alert from '../components/alert'
import MigrationPasswordForm from '../components/auth/MigrationPasswordForm';
//uxui
import { ThreeDots } from 'react-loader-spinner';

const LogInViewInside = ({
    login,
    isAuthenticated,
    load_user,
    setAlert
}) => {

    // la cuenta existe pero no tiene contraseña (migración): se muestra el formulario para crearla
    const [needsPassword, setNeedsPassword] = useState(false);


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
            } else if (loginResponse[0] === "user needs to reset the password") {
                setNeedsPassword(true)
            } else if (loginResponse[0] === "limit exceeded, too many requests") {
                setAlert('Demasiados intentos, espera un minuto e inténtalo de nuevo', false, 'text-red-600', 'bg-gray-200', 3500)
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
                        {needsPassword ?
                            <MigrationPasswordForm email={email} onCancel={() => setNeedsPassword(false)} />
                            :
                            <>
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
                                <div className='mt-6 flex flex-col gap-4'>

                                    <div class="text-sm font-medium text-gray-500 dark:text-gray-300">
                                        Aún no estás registrado? <a href="/create_account/" class="text-blue-700 hover:underline dark:text-blue-500">Crear cuenta</a>
                                    </div>
                                </div>
                            </>

                        }
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
    login, load_user, setAlert

})(LogInViewInside)




