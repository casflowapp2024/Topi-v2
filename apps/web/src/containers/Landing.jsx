//react
import { useNavigate } from "react-router-dom";

import { useEffect, useState } from "react";

//redux
import { connect } from 'react-redux';
import { load_user } from "../redux/actions/auth";

//components
import { BanknotesIcon, ChartBarIcon, CreditCardIcon } from '@heroicons/react/20/solid'
import Footer from "../components/navigation/Footer";
import { ReactComponent as Cflogo } from '../assets/logos/T1.svg'
import Features from "../components/landing/Features";
import Trans from "../components/landing/Trans";

const features = [

    {
        icon: <BanknotesIcon className="h-8 w-8 text-[#5266EB] mb-2" />,
        title: "Seguimiento de Gastos",
        desc: "Controla tus gastos y crea presupuestos."
    },
    {
        icon: <ChartBarIcon className="h-8 w-8 text-[#5266EB] mb-2" />,
        title: "Análisis de Datos",
        desc: "Visualiza tus finanzas con gráficos e informes."
    },
    {
        icon: <CreditCardIcon className="h-8 w-8 text-[#5266EB] mb-2" />,
        title: "Gestión de Cuentas",
        desc: "Organiza todas tus cuentas en un solo lugar."
    },
];

const Landing = ({
    load_user,
    isAuthenticated
}) => {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        load_user()
    }, []);

    useEffect(() => {
        if (isAuthenticated) {
            navigate("/dashboard");
        }
    }, [isAuthenticated]);

    return (
        <div className="relative bg-gray-100 font-Inter min-h-screen flex flex-col justify-between">
            {/* Hero Section */}
            <div className="relative h-[60vh] min-h-[350px] flex items-center justify-center bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB]  to-95%">
                {/* <div className="relative h-[60vh] min-h-[350px] flex items-center justify-center bg-gradient-to-r from-[#3a3e54] from-0% to-[#5266EB]  to-95%"> */}
                {/* <img src={landImage} alt="Imagen de fondo" className="absolute inset-0 w-full h-full object-cover" /> */}
                {/* <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-gray-900/30" /> */}
                <div className="relative z-10 flex flex-col items-center justify-center text-center px-4">
                    <div className="flex flex-row gap-2 items-center mb-4 animate-fade-in">
                        <Cflogo className='w-12 h-12' />
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg">Topi</h1>
                    </div>
                    <p className="text-lg md:text-2xl text-gray-100 mb-6 animate-fade-in delay-100">Tu agente IA financiero personal, optimiza tus gastos, gestiona tus finanzas, lleva al tope tu patrimonio con Topi.</p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs mx-auto animate-fade-in delay-200">
                        <button onClick={() => navigate('/login')} className="w-full bg-white text-[#5266EB] font-semibold py-2 rounded-lg shadow hover:bg-gray-100 transition">Iniciar Sesión</button>
                        <button onClick={() => navigate('/create_account')} className="w-full bg-[#5266EB] text-white font-semibold py-2 rounded-lg shadow hover:bg-blue-600 transition">Crear Cuenta</button>
                    </div>
                </div>
            </div>
            {/* Mobile Menu */}
            {/* <div className="fixed top-5 w-full z-20 flex md:hidden">
                <div className="w-10"/>
                <div className="bg-white rounded-full shadow-md w-full">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center py-2">
                            <div className="flex items-center">
                                <h1 className="text-2xl font-bold text-gray-800">CashFlow</h1>
                            </div>
                            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-800 hover:text-gray-900">
                                {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                    {mobileMenuOpen && (
                        <div className="md:hidden bg-white shadow-md animate-fade-in">
                            <div className="px-4 py-2">
                                <button onClick={() => navigate('/login')} className="block w-full hover:text-gray-900 mb-2 text-gray-900 rounded-lg hover:bg-gray-200">Iniciar Sesión</button>
                                <button onClick={() => navigate('/signup')} className="block w-full bg-[#5266EB] text-white px-4 py-2 rounded-md hover:bg-blue-500">Crear Cuenta</button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="w-10"/>
            </div> */}

            {/* Features Section */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full">
                {/* <h2 className="text-3xl font-bold text-gray-800 text-center mb-8 animate-fade-in">Características</h2> */}
                <Features />
            </div>
            {/* Transacciones automatizadas */}
            <section className="py-16 px-4 md:px-12 bg-gradient-to-r from-zinc-800 from-1% to-zinc-900 to-90% ">
                <Trans />
            </section>
            {/* Footer */}
            <Footer />

            {/* Animations */}
            <style>{`
                .animate-fade-in {
                    opacity: 0;
                    animation: fadeIn 0.8s forwards;
                }
                .animate-fade-in.delay-100 { animation-delay: 0.1s; }
                .animate-fade-in.delay-200 { animation-delay: 0.2s; }
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

const mapStateToProps = state => ({

    isAuthenticated: state.Auth.isAuthenticated,
});

export default connect(mapStateToProps, {
    load_user,
})(Landing);
