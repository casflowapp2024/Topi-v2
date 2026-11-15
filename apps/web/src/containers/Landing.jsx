import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connect } from 'react-redux';
import LandingPage from '../components/landing/LandingPage';
import { FALLBACK_BANKS } from '../components/landing/site';
import { getPublicBanks } from '../apiCalls/reading';
import usePageMeta from '../hocs/usePageMeta';

export const LANDING_TITLE = 'Topi · Tus finanzas al día, sin digitar nada';
export const LANDING_DESCRIPTION = 'Topi lee las notificaciones que te envían tus bancos y arma solo tus gastos, cuentas y presupuestos. Solo lectura, sin pedir las claves de tu banco.';

/**
 * Inicio público (plan/27 §F). El contenido es LandingPage (prerenderizada en el build); aquí solo se actualiza la
 * lista de bancos desde la API y, si ya hay sesión, se va al Inicio de la app.
 */
const Landing = ({ dispatch, isAuthenticated }) => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState(FALLBACK_BANKS);
  usePageMeta(LANDING_TITLE, LANDING_DESCRIPTION);

  useEffect(() => {
    let alive = true;
    // solo si hay una sesión guardada: un visitante nuevo no llama a la API de usuario
    let hasToken = false;
    try { hasToken = Boolean(localStorage.getItem('token')); } catch { /* sin storage */ }
    // import dinámico: redux/actions/auth trae moment-timezone y no debe ir en el bundle de la landing
    if (hasToken) import('../redux/actions/auth').then(({ load_user }) => dispatch(load_user())).catch(() => {});
    getPublicBanks().then((list) => { if (alive && list.length) setBanks(list); }).catch(() => {});
    return () => { alive = false; };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  return <LandingPage banks={banks} />;
};

const mapStateToProps = (state) => ({ isAuthenticated: state.Auth.isAuthenticated });

export default connect(mapStateToProps)(Landing);
