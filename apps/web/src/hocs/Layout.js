//react
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
//redux
import { connect } from 'react-redux';
import { load_user, logout } from '../redux/actions/auth';
import { get_user_accounts, get_user_categories, get_user_transactions, get_account_types } from '../redux/actions/cashflow';
import { get_automated_emails, onboarding_reset_read_email } from '../redux/actions/conexions';
import { request_init_categories, get_user_extra_data, add_user_extra_data, update_user_extra_data, update_user_config, set_theme } from '../redux/actions/auth';
import { get_banks, get_official_banks } from '../redux/actions/cashflow';
import { open_settings_modal, close_settings_modal } from '../redux/actions/ui';
//Components
import Onboarding2 from './Onboarding2';
import NextStepsPopover from '../components/onboarding2/NextStepsPopover';
import InstallPwaModal from '../components/ui/InstallPwaModal';
import Warnings from '../components/navigation/Warnings';
import PeriodSelector from '../components/navigation/PeriodSelector';
import { connectEmailAction, wasPromptedThisSession, markPromptedThisSession } from '../components/conexions/emailConnection';
import AccountSettings from '../containers/AccountSettings';
import PageContainer from '../components/ui/PageContainer';
import UserMenu from '../components/ui/UserMenu';
import { themePreference, useResolvedDark } from '../components/ui/theme';
import { ReactComponent as Cflogo } from '../assets/logos/T1.svg';
import {
  HomeIcon,
  BanknotesIcon,
  CreditCardIcon,
  ArrowsRightLeftIcon
} from '@heroicons/react/20/solid';
//UX
import { Oval } from 'react-loader-spinner';

const NAV = [
  { tab: 'general', to: '/dashboard', label: 'General', short: 'Inicio', icon: HomeIcon },
  { tab: 'budgets', to: '/dashboard/budgets', label: 'Presupuestos', short: 'Presup.', icon: BanknotesIcon },
  { tab: 'accounts', to: '/dashboard/accounts', label: 'Cuentas', short: 'Cuentas', icon: CreditCardIcon },
  { tab: 'transactions', to: '/dashboard/transactions', label: 'Transacciones', short: 'Transac.', icon: ArrowsRightLeftIcon },
];

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
  set_theme,
  //state
  user_found,
  session_expired,
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
  // El interceptor cerró la sesión (el refresh falló): sin esto la vista se queda en el spinner
  // de !user_found hasta recargar.
  useEffect(() => {
    if (session_expired) navigate('/login/', { replace: true });
  }, [session_expired, navigate]);

  const [userDataRequested, setUserDataRequested] = useState(false);
  const [openNextSteps, setOpenNextSteps] = useState(false);
  const [forceEmailStep, setForceEmailStep] = useState(false);

  const pathSegments = location.pathname.split('/').filter(Boolean);
  const activeTab = pathSegments.length > 1 ? pathSegments[1] : 'general';

  const themePref = themePreference(user_extra_data?.config);
  const isDark = useResolvedDark(themePref);
  // Selector de periodo (móvil, en la barra superior): solo en las vistas que dependen del mes
  const showPeriod = location.pathname.startsWith('/dashboard') && ['general', 'budgets', 'accounts'].includes(activeTab);

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
    <div className={`min-h-screen font-Inter flex flex-col overflow-x-clip transition-colors duration-300 ${isDark ? 'dark bg-surface-sunken' : 'bg-gray-100'}`}>
      {!user_found && (
        <div className="flex items-center justify-center h-screen text-topi-500">
          <Oval height={80} width={80} color="currentColor" visible={true} ariaLabel='oval-loading' secondaryColor="currentColor" strokeWidth={2} strokeWidthSecondary={2} />
        </div>
      )}

      {user_found && (
        <div className='flex flex-col flex-grow relative'>
          {user_extra_data ? (
            <div className='flex flex-col w-full relative pb-20 lg:pb-0'>
              <div className="w-full text-gray-700 dark:text-gray-300 flex flex-col items-center bg-gray-100 dark:bg-surface-sunken relative transition-colors duration-300">
                <header className="fixed top-0 left-0 right-0 z-40 bg-gray-100/80 dark:bg-surface-sunken/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-colors duration-300">
                  {/* Alto fijo (52/61px + borde): el espaciador y los encabezados pegajosos dependen de él */}
                  <PageContainer className="h-[52px] md:h-[61px] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 lg:gap-6 min-w-0">
                      {/* El logo siempre lleva al Inicio */}
                      <Link to="/dashboard" aria-label="Topi, ir al Inicio"
                        className="flex items-center gap-2 shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
                        <span className="w-10 h-10 rounded-xl bg-topi-500/10 flex items-center justify-center">
                          <Cflogo className="w-7 h-7" aria-hidden="true" />
                        </span>
                        <span className="hidden min-[380px]:inline font-bold text-topi-500 dark:text-topi-200 text-lg">Topi</span>
                      </Link>
                      <nav aria-label="Principal" className="hidden lg:flex items-center gap-1">
                        {NAV.map(({ tab, to, label, icon: Icon }) => {
                          const active = activeTab === tab;
                          return (
                            <Link key={tab} to={to} aria-current={active ? 'page' : undefined}
                              className={`h-9 px-3 rounded-xl flex items-center gap-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${active
                                ? 'bg-topi-50 text-topi-600 dark:bg-topi-500/15 dark:text-topi-200'
                                : 'text-ink-2 hover:text-ink hover:bg-gray-200/60 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-800'}`}>
                              <Icon className="w-5 h-5" aria-hidden="true" />
                              {label}
                            </Link>
                          );
                        })}
                      </nav>
                    </div>
                    <div className="flex items-center justify-end gap-1 sm:gap-3 min-w-0">
                      {showPeriod && <PeriodSelector compact plain />}
                      <UserMenu
                        user={user}
                        theme={themePref}
                        onThemeChange={set_theme}
                        onOpenSettings={open_settings_modal}
                        onLogout={handleLogout}
                      />
                    </div>
                  </PageContainer>
                </header>

                {/* Spacer for fixed header */}
                <div className="h-[53px] md:h-[62px] w-full"></div>

                <Warnings />

                {user_extra_data.onboarding_completed === false && (
                  <Onboarding2 NextStepsPopoverOnboarding={NextStepsPopoverOnboarding} forceEmailStep={forceEmailStep} />
                )}

                <NextStepsPopover open={openNextSteps} setOpen={setOpenNextSteps} />


                <PageContainer as="main" className="md:py-1">
                  {children}
                </PageContainer>

                {/* Fixed Bottom Navigation for Mobile */}
                <div className="fixed bottom-6 left-4 right-4 z-40 flex lg:hidden">
                  <nav aria-label="Principal" className="bg-topi-500 w-full rounded-full px-2 py-2 flex flex-row justify-between items-center shadow-2xl">
                    {NAV.map(({ tab, to, label, short, icon: Icon }) => {
                      const active = activeTab === tab;
                      return (
                        <Link key={tab} to={to} aria-label={label} aria-current={active ? 'page' : undefined}
                          className={`flex flex-row items-center justify-center rounded-full transition-all duration-300 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${active ? 'bg-white text-topi-500 px-3 py-2 flex-grow' : 'bg-transparent text-white/80 p-2 w-12 flex-shrink-0'}`}>
                          <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                          {active && <span className="ml-1 text-sm font-semibold whitespace-nowrap" aria-hidden="true">{short}</span>}
                        </Link>
                      );
                    })}
                  </nav>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-topi-500">
              <Oval height={40} width={40} color="currentColor" visible={true} ariaLabel='oval-loading' />
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
  session_expired: state.Auth.session_expired,
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
  set_theme,
  onboarding_reset_read_email,
  open_settings_modal,
  close_settings_modal
})(Layout);
