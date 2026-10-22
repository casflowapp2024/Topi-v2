
//redux
import { Provider } from 'react-redux'
import store from './store';
//routes
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'
//google analytics
import useAnalytics from './hocs/useAnalytics';

//containers
import Dashboard from './containers/Dashboard';
import Error404 from './containers/Error404'
import Transactions from './containers/Transactions';
import AccountSettings from './containers/AccountSettings';
import Accounts from './containers/Accounts';
import Landing from './containers/Landing';
import SignUpView from './containers/SignUpView';
import PlanCategories from './containers/PlanCategories';
import ForgotPassword from './containers/ForgotPassword';
import GmailConnectAuthCallBack from './containers/GmailConnectAuthCallBack';
import GlinkOauthPopupSuccess from './containers/GlinkOauthPopupSuccess';
import TermsOfService from './containers/TermsOfService';
import PrivacyPolicy from './containers/PrivacyPolicy';
import LogInViewInside from './containers/LogInViewInside';
import ConexionesSetts from './components/settings/ConexionesSetts';
import ProfileSetts from './components/settings/ProfileSetts';
import AAAcountsDashboard from './components/dashboard/productsAccounts/AAAcountsDashboard';
import AABudgetDashboard from './components/dashboard/budgetCategories/AABudgetDashboard';
import AAGenDashboard from './components/dashboard/general/AAGenDashboard';
import Membership from './components/settings/Membership';
import ConnectEmail from './components/conexions/ConnectEmail';
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
      <Routes>
        <Route path="*" element={<Error404 />} />

        <Route exact path='/' element={<Landing />} />
        <Route exact path='/login/' element={<LogInViewInside />} />
        <Route exact path='/forgot_password/' element={<ForgotPassword />} />
        {/* ya no hay verificación por código ni login con Google: links viejos -> login */}
        <Route exact path='/verify_email/' element={<Navigate to="/login/" replace />} />
        <Route path="/dashboard/*" element={<Dashboard />}>
          <Route index element={<AAGenDashboard />} />
          <Route path="budgets" element={<AABudgetDashboard />} />
          <Route path="accounts" element={<AAAcountsDashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="connect-email" element={<ConnectEmail />} />
        </Route>
        <Route exact path='/create_account/' element={<SignUpView />} />
        <Route path='/settings/' element={<AccountSettings />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileSetts />} />
          <Route path="connections" element={<ConexionesSetts />} />
          <Route path="membership" element={<Membership />} />
        </Route>
        <Route exact path='/accounts/' element={<Accounts />} />
        <Route exact path='/plan/' element={<PlanCategories />} />
        <Route exact path='/g-auth-call-back/' element={<Navigate to="/login/" replace />} />
        <Route exact path='/gmail-auth-connect/' element={<GmailConnectAuthCallBack />} />
        <Route exact path="/glink-oauth-popup-success/" element={<GlinkOauthPopupSuccess />} />
        <Route exact path="/terms-of-service/" element={<TermsOfService />} />
        <Route exact path="/privacy-policy/" element={<PrivacyPolicy />} />
      </Routes>
    </Router>
  );
};

export default App;
