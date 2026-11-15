
//redux
import { Provider } from 'react-redux'
import store from './store';
//routes
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'
//google analytics
import useAnalytics from './hocs/useAnalytics';

import { lazy as lazyReact, Suspense } from 'react';
//containers: la landing va en el bundle principal (se prerenderiza); el resto se carga al entrar (plan/27 §F)
import Landing from './containers/Landing';
// Tras un deploy, quien tenga la app abierta pide chunks que ya no existen (404): se recarga una vez para tomar el
// index nuevo en vez de quedar en blanco. La marca evita un ciclo si el chunk de verdad falla.
const RELOADED_KEY = 'topi.chunkReloadedAt';
const lazy = (factory) => lazyReact(() => factory().catch((error) => {
  let last = 0;
  try { last = Number(sessionStorage.getItem(RELOADED_KEY) || 0); } catch { /* sin storage */ }
  if (Date.now() - last > 60000) {
    try { sessionStorage.setItem(RELOADED_KEY, String(Date.now())); } catch { /* sin storage */ }
    window.location.reload();
    return new Promise(() => {});
  }
  throw error;
}));
const Dashboard = lazy(() => import('./containers/Dashboard'));
const Error404 = lazy(() => import('./containers/Error404'));
const Transactions = lazy(() => import('./containers/Transactions'));
const AccountSettings = lazy(() => import('./containers/AccountSettings'));
const Accounts = lazy(() => import('./containers/Accounts'));
const SignUpView = lazy(() => import('./containers/SignUpView'));
const PlanCategories = lazy(() => import('./containers/PlanCategories'));
const ForgotPassword = lazy(() => import('./containers/ForgotPassword'));
const GmailConnectAuthCallBack = lazy(() => import('./containers/GmailConnectAuthCallBack'));
const GlinkOauthPopupSuccess = lazy(() => import('./containers/GlinkOauthPopupSuccess'));
const TermsOfService = lazy(() => import('./containers/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./containers/PrivacyPolicy'));
const LogInViewInside = lazy(() => import('./containers/LogInViewInside'));
const ConexionesSetts = lazy(() => import('./components/settings/ConexionesSetts'));
const ProfileSetts = lazy(() => import('./components/settings/ProfileSetts'));
const AAAcountsDashboard = lazy(() => import('./components/dashboard/productsAccounts/AAAcountsDashboard'));
const AABudgetDashboard = lazy(() => import('./components/dashboard/budgetCategories/AABudgetDashboard'));
const AAGenDashboard = lazy(() => import('./components/dashboard/general/AAGenDashboard'));
const Membership = lazy(() => import('./components/settings/Membership'));
const ConnectEmail = lazy(() => import('./components/conexions/ConnectEmail'));
const Admin = lazy(() => import('./containers/Admin'));
const SupportThanks = lazy(() => import('./containers/SupportThanks'));
// sub-rutas con su propio Suspense: al cambiar de pestaña la barra de la app no desaparece
const inner = (Component) => (
  <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}><Component /></Suspense>
);

//fondo blanco #FFFFFF
//sombras blanco isabelino #e9e8ee
//compplemento azul #5266EB
//letras Oscuro #1E1E2A

function App() {
  return (
    <Provider store={store}>
      <AnalyticsWrapper />
    </Provider>
  );
}

const AnalyticsWrapper = () => {
  useAnalytics();
  return (
    <Router>
      <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
      <Routes>
        <Route path="*" element={<Error404 />} />

        <Route exact path='/' element={<Landing />} />
        <Route exact path='/login/' element={<LogInViewInside />} />
        <Route exact path='/forgot_password/' element={<ForgotPassword />} />
        {/* ya no hay verificación por código ni login con Google: links viejos -> login */}
        <Route exact path='/verify_email/' element={<Navigate to="/login/" replace />} />
        <Route path="/dashboard/*" element={<Dashboard />}>
          <Route index element={inner(AAGenDashboard)} />
          <Route path="budgets" element={inner(AABudgetDashboard)} />
          <Route path="accounts" element={inner(AAAcountsDashboard)} />
          <Route path="transactions" element={inner(Transactions)} />
          <Route path="connect-email" element={inner(ConnectEmail)} />
        </Route>
        <Route exact path='/create_account/' element={<SignUpView />} />
        <Route path='/settings/' element={<AccountSettings />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={inner(ProfileSetts)} />
          <Route path="connections" element={inner(ConexionesSetts)} />
          <Route path="membership" element={inner(Membership)} />
        </Route>
        <Route exact path='/accounts/' element={<Accounts />} />
        <Route path='/apoyar/gracias' element={<SupportThanks />} />
        <Route path='/admin' element={<Admin />} />
        <Route path='/admin/:section' element={<Admin />} />
        <Route exact path='/plan/' element={<PlanCategories />} />
        <Route exact path='/g-auth-call-back/' element={<Navigate to="/login/" replace />} />
        <Route exact path='/gmail-auth-connect/' element={<GmailConnectAuthCallBack />} />
        <Route exact path="/glink-oauth-popup-success/" element={<GlinkOauthPopupSuccess />} />
        <Route exact path="/terms-of-service/" element={<TermsOfService />} />
        <Route exact path="/privacy-policy/" element={<PrivacyPolicy />} />
      </Routes>
      </Suspense>
    </Router>
  );
};

export default App;
