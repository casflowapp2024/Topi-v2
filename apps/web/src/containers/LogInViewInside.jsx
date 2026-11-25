import { connect } from 'react-redux';
import { useEffect, useState } from "react";
//redux actions
import { login, load_user } from '../redux/actions/auth';
import { useNavigate } from "react-router-dom";
import { setAlert } from '../redux/actions/alert';

//components
import Alert from '../components/alert'
import PasswordResetForm from '../components/auth/PasswordResetForm';
import AuthLayout, { authButton, authInput, authLabel, authLink } from '../components/auth/AuthLayout';
//uxui
import { ThreeDots } from 'react-loader-spinner';

const LogInViewInside = ({
    login,
    isAuthenticated,
    load_user,
    setAlert
}) => {

    // la cuenta existe pero no tiene contraseña (migración): la crea con un código enviado al correo
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
                setAlert('El correo o la contraseña no son correctos.', false, 'text-red-600', 'bg-gray-200', 3500)
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
        <AuthLayout
            title={needsPassword ? 'Crea tu contraseña' : 'Inicia sesión'}
            subtitle={needsPassword ? null : 'Tus finanzas al día te esperan.'}
            alt={{ href: '/create_account/', label: 'Crear cuenta' }}
            footer={!loadingLogin && !needsPassword && (
                <>¿Aún no tienes cuenta? <a href="/create_account/" className="font-semibold text-topi-200 hover:underline">Créala en un minuto</a></>
            )}>
            {needsPassword ?
                <PasswordResetForm email={email} migration onCancel={() => setNeedsPassword(false)} />
                :
                <form className="flex flex-col gap-4" onSubmit={onSubmitLogIn}>
                    <div>
                        <label htmlFor="email" className={authLabel}>Correo</label>
                        <input type="email" name="email" id="email" autoComplete="email"
                            value={email} onChange={e => onChange(e)}
                            placeholder="nombre@email.com" required className={authInput} />
                    </div>
                    <div>
                        <div className="flex items-baseline justify-between">
                            <label htmlFor="password" className={authLabel}>Contraseña</label>
                            <a href="/forgot_password/" className={`text-sm ${authLink}`}>¿La olvidaste?</a>
                        </div>
                        <input type="password" name="password" id="password" autoComplete="current-password" placeholder="••••••••"
                            value={password} onChange={e => onChange(e)} required className={authInput} />
                    </div>
                    {loadingLogin ?
                        <div className={authButton} aria-busy="true">
                            <ThreeDots height="20" width="20" color="white" ariaLabel="Iniciando sesión" />
                        </div>
                        :
                        <button type="submit" className={`mt-2 ${authButton}`}>Iniciar sesión</button>
                    }
                </form>
            }
            <Alert />
        </AuthLayout>
    )
}

const mapStateToProps = state => ({
    isAuthenticated: state.Auth.isAuthenticated,

})

export default connect(mapStateToProps, {
    login, load_user, setAlert

})(LogInViewInside)




