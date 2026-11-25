import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { connect } from 'react-redux';
import LandingPage from '../components/landing/LandingPage';
import { FALLBACK_BANKS, FALLBACK_STATS } from '../components/landing/site';
import { getPublicBanks, getPublicStats } from '../apiCalls/reading';
import usePageMeta from '../hocs/usePageMeta';

export const LANDING_TITLE = 'Topi · Tus gastos anotados solos, desde los correos de tu banco';
export const LANDING_DESCRIPTION = 'Topi lee las notificaciones que te envía tu banco y anota sola cada compra en su categoría y en tu presupuesto. Para cualquier banco que avise por correo. Solo lectura, sin pedir las claves de tu banco.';

/**
 * Inicio público (plan/27 §F). El contenido es LandingPage (prerenderizada en el build); aquí solo se actualiza la
 * lista de bancos y las cifras desde la API y, si ya hay sesión, se va al Inicio de la app.
 */
const Landing = ({ dispatch, isAuthenticated }) => {
  const navigate = useNavigate();
  const [banks, setBanks] = useState(FALLBACK_BANKS);
  const [stats, setStats] = useState(FALLBACK_STATS);
  usePageMeta(LANDING_TITLE, LANDING_DESCRIPTION);

  useEffect(() => {
    let alive = true;
    // solo si hay una sesión guardada: un visitante nuevo no llama a la API de usuario
    let hasToken = false;
    try { hasToken = Boolean(localStorage.getItem('token')); } catch { /* sin storage */ }
    // import dinámico: redux/actions/auth trae moment-timezone y no debe ir en el bundle de la landing
    if (hasToken) import('../redux/actions/auth').then(({ load_user }) => dispatch(load_user())).catch(() => {});
    getPublicBanks().then((list) => { if (alive && list.length) setBanks(list); }).catch(() => {});
    // solo cifras mayores que las del prerender: la página nunca "baja" un número ya pintado
    getPublicStats().then((s) => {
      if (alive && s && s.automated_transactions >= FALLBACK_STATS.automated_transactions) setStats(s);
    }).catch(() => {});
    return () => { alive = false; };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard');
  }, [isAuthenticated, navigate]);

  return <LandingPage banks={banks} stats={stats} />;
};

const mapStateToProps = (state) => ({ isAuthenticated: state.Auth.isAuthenticated });

export default connect(mapStateToProps)(Landing);
