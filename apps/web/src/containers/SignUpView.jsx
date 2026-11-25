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
import AuthLayout, { authButton, authInput, authLabel, authLink } from "../components/auth/AuthLayout";

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
        <AuthLayout
            title="Crea tu cuenta"
            subtitle="Después conectas tu correo y Topi empieza a anotar solo."
            alt={{ href: '/login/', label: 'Iniciar sesión' }}
            footer={<>¿Ya tienes cuenta? <a href="/login/" className="font-semibold text-topi-200 hover:underline">Inicia sesión</a></>}>
            <form className="flex flex-col gap-4" onSubmit={onSubmitCreate}>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="name" className={authLabel}>Nombre</label>
                        <input type="text" name="name" id="name" autoComplete="given-name"
                            value={name} onChange={e => onChange(e)} placeholder="Nombre" required className={authInput} />
                    </div>
                    <div>
                        <label htmlFor="lastName" className={authLabel}>Apellido</label>
                        <input type="text" name="lastName" id="lastName" autoComplete="family-name"
                            value={lastName} onChange={e => onChange(e)} placeholder="Apellido" required className={authInput} />
                    </div>
                </div>
                <div>
                    <label htmlFor="email" className={authLabel}>Correo</label>
                    <input type="email" name="email" id="email" autoComplete="email"
                        value={email} onChange={e => onChange(e)} placeholder="nombre@email.com" required className={authInput} />
                </div>
                <div>
                    <label htmlFor="password" className={authLabel}>Contraseña</label>
                    <input type="password" name="password" id="password" autoComplete="new-password"
                        value={password} onChange={e => onChange(e)} placeholder="••••••••" required className={authInput} />
                    {errorMessages.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-status-crit-text dark:text-red-400">
                            {errorMessages.map((msg, index) => <li key={index}>{msg}</li>)}
                        </ul>
                    )}
                </div>
                <div>
                    <label htmlFor="confirmPassword" className={authLabel}>Confirma tu contraseña</label>
                    <input type="password" name="confirmPassword" id="confirmPassword" autoComplete="new-password"
                        value={confirmPassword} onChange={e => onChange(e)} placeholder="••••••••" required className={authInput} />
                    {errorMessagesOnSubmit.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-0.5 text-xs text-status-crit-text dark:text-red-400">
                            {errorMessagesOnSubmit.map((msg, index) => <li key={index}>{msg}</li>)}
                        </ul>
                    )}
                </div>
                {loadingCreate ?
                    <div className={`mt-2 ${authButton}`} aria-busy="true">
                        <ThreeDots height="20" width="20" color="white" ariaLabel="Creando tu cuenta" />
                    </div>
                    :
                    <button type="submit" className={`mt-2 ${authButton}`}>Crear mi cuenta</button>
                }
                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Al continuar aceptas los <Link to="/terms-of-service/" className={authLink}>Términos</Link> y la <Link to="/privacy-policy/" className={authLink}>Política de privacidad</Link>.
                </p>
            </form>
            <Alert />
        </AuthLayout>
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




