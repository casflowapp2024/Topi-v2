//react
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
import { load_user, logout } from '../redux/actions/auth';
import { get_user_accounts, get_user_categories, get_user_transactions, get_account_types } from '../redux/actions/cashflow';
import { get_automated_emails, onboarding_reset_read_email } from '../redux/actions/conexions';
import { request_init_categories, get_user_extra_data, add_user_extra_data, update_user_extra_data, update_user_config, toggle_dark_mode } from '../redux/actions/auth';
import { get_banks, get_official_banks } from '../redux/actions/cashflow';
import { open_settings_modal, close_settings_modal } from '../redux/actions/ui';
//Components
import Onboarding2 from './Onboarding2';
import NextStepsPopover from '../components/onboarding2/NextStepsPopover';
import InstallPwaModal from '../components/ui/InstallPwaModal';
import Warnings from '../components/navigation/Warnings';
import { connectEmailAction, wasPromptedThisSession, markPromptedThisSession } from '../components/conexions/emailConnection';
import AccountSettings from '../containers/AccountSettings';
import { ReactComponent as Cflogo } from '../assets/logos/T1.svg';
import {
  HomeIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowsRightLeftIcon,
  UserIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/20/solid';
//UX
import { Oval } from 'react-loader-spinner';

const Layout = ({
  children,
  //actions
  load_user,
  get_user_accounts,
  get_user_categories,
  get_user_transactions,
  get_banks,
  get_official_banks,
  get_account_types,
  request_init_categories,
  get_automated_emails,
  get_user_extra_data,
  add_user_extra_data,
  update_user_extra_data,
  update_user_config,
  toggle_dark_mode,
  //state
  user_found,
  categories,
  default_limit,
  user_extra_data,
  first_steps,
  automated_emails,
  // New props for shell
  user,
  logout,
  open_settings_modal,
  close_settings_modal,
  is_settings_open,
  active_settings_tab

}) => {

  useEffect(() => {
    if (user_found) {
      loadEverything()
    } else {
      firsLoad();
    }
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const [userDataRequested, setUserDataRequested] = useState(false);
  const [openNextSteps, setOpenNextSteps] = useState(false);
  const [forceEmailStep, setForceEmailStep] = useState(false);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeTab = pathSegments.length > 1 ? pathSegments[1] : 'general';

  const isDark = Boolean(user_extra_data?.config?.dark_mode);

  // El tema también va en <html>: así lo toman los modales (que se montan fuera de este div),
  // las barras de scroll y los controles nativos del navegador.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);
  useEffect(() => () => {
    // al salir de la app (logout, landing) vuelve al tema claro
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const firsLoad = async () => {
    const userFound = await load_user();
    if (userFound === false) {
      navigate("/");
    } else {
      await get_user_extra_data();
      loadEverything()
    }
  }

  const loadEverything = async () => {
    get_user_accounts(0, 20)
    get_user_categories(0, 20);
    get_user_transactions(0, default_limit, "", "dash")
    get_automated_emails(0, 20)
    get_official_banks();
    get_banks(0, 20);
    get_account_types(0, 20)
    setUserDataRequested(true)
  }

  useEffect(() => {
    if (categories && categories.items && categories.items.length > 0) {
      const categoriesNoDefault = categories.items.filter(cat => !cat.isDefault);
      if (categoriesNoDefault.length === 0) {
        triger_request_init_categories();
      }
    }
  }, [categories])

  const triger_request_init_categories = async () => {
    const initCatResponse = await request_init_categories()
    if (initCatResponse === true) {
      get_user_categories(0, 20)
    }
  }

  const triger_set_initial_timezone = async () => {
    if (user_extra_data === null) {
      const offset = -new Date().getTimezoneOffset() / 60
      await add_user_extra_data(offset, "", false, "", "")
      get_user_extra_data()
    }
  }

  const onboardingCompletedUpdate = async () => {
    if (user_extra_data && user_extra_data.onboarding_completed === false) {
      if (first_steps && first_steps.email && first_steps.bank) {
        await update_user_extra_data(
          user_extra_data.utc_offset,
          user_extra_data.whatsapp,
          true,
          user_extra_data.birthday,
          user_extra_data.local_currency,
          user_extra_data.language
        )
        get_user_extra_data();
      }
    }
  }

  const NextStepsPopoverOnboarding = async () => {
    onboardingCompletedUpdate()
    setOpenNextSteps(true)
  }

  useEffect(() => {
    if (userDataRequested) {
      triger_set_initial_timezone();
    }
  }, [userDataRequested])

  // Al iniciar sesión: sin ninguna conexión de correo utilizable, llevar a conectar una.
  // Con una conexión activa no se hace nada (el worker lee cada hora).
  useEffect(() => {
    if (!user || !user_extra_data || !first_steps.retrieved_email) return;
    const userKey = user.email;
    if (wasPromptedThisSession(userKey)) return;
    markPromptedThisSession(userKey);

    const action = connectEmailAction(automated_emails, user_extra_data.onboarding_completed);
    if (action === 'onboarding') {
      setForceEmailStep(true);
    } else if (action === 'connect' && location.pathname !== '/dashboard/connect-email') {
      navigate('/dashboard/connect-email');
    }
  }, [user, user_extra_data, first_steps.retrieved_email, automated_emails, location.pathname, navigate])

  return (
    <div className={`min-h-screen font-Inter flex flex-col overflow-x-clip transition-colors duration-300 ${isDark ? 'dark bg-[#0B0F19]' : 'bg-gray-100'}`}>
      {!user_found && (
        <div className="flex items-center justify-center h-screen">
          <Oval height={80} width={80} color="#5266EB" visible={true} ariaLabel='oval-loading' secondaryColor="#5266EB" strokeWidth={2} strokeWidthSecondary={2} />
        </div>
      )}

      {user_found && (
        <div className='flex flex-col flex-grow relative'>
          {user_extra_data ? (
            <div className='flex flex-col w-full relative pb-20 lg:pb-0'>
              <div className="w-full text-gray-700 dark:text-gray-300 flex flex-col items-center bg-gray-100 dark:bg-[#0B0F19] relative transition-colors duration-300">
                <div className="fixed top-0 left-0 right-0 z-40 flex justify-center bg-gray-100/80 dark:bg-[#0B0F19]/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-colors duration-300">
                  <div className="px-2 py-2 md:py-3 gap-2 flex flex-row justify-between items-center w-full lg:w-[806px] xl:w-[930px]">
                    {/* Barra superior (versión mobile - logo/título) */}
                    <div className='flex lg:hidden items-center gap-2'>
                      <div className="w-8 h-8 rounded-xl bg-[#5266EB]/10 flex items-center justify-center">
                        <Cflogo className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-[#5266EB] text-lg">Topi</span>
                    </div>
                    <div className='gap-2 hidden lg:flex flex-row'>
                      <Link to="/dashboard" className={`${activeTab === 'general' ? "bg-[#5266EB] text-white shadow-lg border-[#5266EB]" : "text-gray-400 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"} cursor-pointer px-4 py-2 border border-gray-200 rounded-2xl flex items-center gap-2 text-sm transition-colors duration-300`}>
                        <HomeIcon className="w-5 h-5" />
                        General
                      </Link>
                      <Link to="/dashboard/budgets" className={`${activeTab === 'budgets' ? "bg-[#5266EB] text-white shadow-lg border-[#5266EB]" : "text-gray-400 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"} cursor-pointer px-4 py-2 border border-gray-200 rounded-2xl flex items-center gap-2 text-sm transition-colors duration-300`}>
                        <BanknotesIcon className="w-5 h-5" />
                        Presupuestos
                      </Link>
                      <Link to="/dashboard/accounts" className={`${activeTab === 'accounts' ? "bg-[#5266EB] text-white shadow-lg border-[#5266EB]" : "text-gray-400 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"} cursor-pointer px-4 py-2 border border-gray-200 rounded-2xl flex items-center gap-2 text-sm transition-colors duration-300`}>
                        <CreditCardIcon className="w-5 h-5" />
                        Cuentas
                      </Link>
                      <Link to="/dashboard/transactions" className={`${activeTab === 'transactions' ? "bg-[#5266EB] text-white shadow-lg border-[#5266EB]" : "text-gray-400 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm"} cursor-pointer px-4 py-2 border border-gray-200 rounded-2xl flex items-center gap-2 text-sm transition-colors duration-300`}>
                        <ArrowsRightLeftIcon className="w-5 h-5" />
                        Transacciones
                      </Link>
                    </div>
                    <div className='flex flex-row items-center gap-2'>
                      <button
                        type="button"
                        onClick={() => toggle_dark_mode()}
                        aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
                        title={isDark ? 'Tema claro' : 'Tema oscuro'}
                        className="w-9 h-9 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-amber-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-topi-500 active:scale-95 transition-all"
                      >
                        {isDark
                          ? <SunIcon className="w-5 h-5 transition-transform duration-300 rotate-0 motion-reduce:transition-none" aria-hidden="true" />
                          : <MoonIcon className="w-5 h-5 transition-transform duration-300 motion-reduce:transition-none" aria-hidden="true" />}
                      </button>
                      <button
                        onClick={() => open_settings_modal('profile')}
                        aria-label="Abrir ajustes y perfil"
                        className="p-1 px-3 border border-gray-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200 transition-all font-semibold"
                      >
                        <span className="text-xs">{user?.name || 'Usuario'}</span>
                        <div className="w-7 h-7 rounded-full bg-[#5266EB]/10 flex items-center justify-center">
                          <Cflogo className='hidden md:block w-5 h-5' />
                          <UserIcon className="md:hidden text-[#5266EB] w-5 h-5" />
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Spacer for fixed header */}
                <div className="h-[53px] md:h-[62px] w-full"></div>

                <Warnings />

                {user_extra_data.onboarding_completed === false && (
                  <Onboarding2 NextStepsPopoverOnboarding={NextStepsPopoverOnboarding} forceEmailStep={forceEmailStep} />
                )}

                <NextStepsPopover open={openNextSteps} setOpen={setOpenNextSteps} />

                <div className="w-full flex justify-center">
                  <div className="md:py-1 w-full lg:w-[806px] xl:w-[930px]">
                    {children}
                  </div>
                </div>

                {/* Fixed Bottom Navigation for Mobile */}
                <div className="fixed bottom-6 left-4 right-4 z-40 flex lg:hidden">
                  <div className="bg-[#5266EB] w-full rounded-full px-2 py-2 flex flex-row justify-between items-center shadow-2xl">
                    <Link to="/dashboard" className={`flex flex-row items-center justify-center rounded-full transition-all duration-300 overflow-hidden ${activeTab === 'general' ? 'bg-white text-[#5266EB] px-3 py-2 flex-grow' : 'bg-transparent text-white/80 p-2 w-12 flex-shrink-0'}`}>
                      <HomeIcon className="w-5 h-5 shrink-0" />
                      {activeTab === 'general' && <span className="ml-1 text-sm font-semibold whitespace-nowrap">Inicio</span>}
                    </Link>
                    <Link to="/dashboard/budgets" className={`flex flex-row items-center justify-center rounded-full transition-all duration-300 overflow-hidden ${activeTab === 'budgets' ? 'bg-white text-[#5266EB] px-3 py-2 flex-grow' : 'bg-transparent text-white/80 p-2 w-12 flex-shrink-0'}`}>
                      <BanknotesIcon className="w-5 h-5 shrink-0" />
                      {activeTab === 'budgets' && <span className="ml-1 text-sm font-semibold whitespace-nowrap">Presup.</span>}
                    </Link>
                    <Link to="/dashboard/accounts" className={`flex flex-row items-center justify-center rounded-full transition-all duration-300 overflow-hidden ${activeTab === 'accounts' ? 'bg-white text-[#5266EB] px-3 py-2 flex-grow' : 'bg-transparent text-white/80 p-2 w-12 flex-shrink-0'}`}>
                      <CreditCardIcon className="w-5 h-5 shrink-0" />
                      {activeTab === 'accounts' && <span className="ml-1 text-sm font-semibold whitespace-nowrap">Cuentas</span>}
                    </Link>
                    <Link to="/dashboard/transactions" className={`flex flex-row items-center justify-center rounded-full transition-all duration-300 overflow-hidden ${activeTab === 'transactions' ? 'bg-white text-[#5266EB] px-3 py-2 flex-grow' : 'bg-transparent text-white/80 p-2 w-12 flex-shrink-0'}`}>
                      <ArrowsRightLeftIcon className="w-5 h-5 shrink-0" />
                      {activeTab === 'transactions' && <span className="ml-1 text-sm font-semibold whitespace-nowrap">Transac.</span>}
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center">
              <Oval height={40} width={40} color="#5266EB" visible={true} ariaLabel='oval-loading' />
            </div>
          )}

          {/* Settings Modal */}
          {is_settings_open && (
            <AccountSettings
              isModal={true}
              activeTab={active_settings_tab}
              closeSettingsModal={close_settings_modal}
              handleLogout={handleLogout}
            />
          )}

          <InstallPwaModal />
        </div>
      )}
    </div>
  )
}

const mapStateToProps = state => ({
  user_found: state.Auth.user_found,
  user_extra_data: state.Auth.user_extra_data,
  user: state.Auth.user,
  default_limit: state.CashFlow.user_transactions.default_limit,
  categories: state.CashFlow.user_categories,
  first_steps: state.CashFlow.first_steps,
  automated_emails: state.Conexions.automated_emails.emails,
  is_settings_open: state.UI.is_settings_open,
  active_settings_tab: state.UI.active_settings_tab
})

export default connect(mapStateToProps, {
  load_user,
  logout,
  get_user_accounts,
  get_user_categories,
  get_user_transactions,
  get_banks,
  get_official_banks,
  get_account_types,
  request_init_categories,
  get_automated_emails,
  get_user_extra_data,
  add_user_extra_data,
  update_user_extra_data,
  update_user_config,
  toggle_dark_mode,
  onboarding_reset_read_email,
  open_settings_modal,
  close_settings_modal
})(Layout);
