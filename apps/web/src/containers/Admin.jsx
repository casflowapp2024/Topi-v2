import { useEffect, useState } from 'react';
import { connect } from 'react-redux';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowPathIcon } from '@heroicons/react/20/solid';
import Layout from '../hocs/Layout';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import AdminSummary from '../components/admin/AdminSummary';
import AdminUsers from '../components/admin/AdminUsers';
import AdminReading from '../components/admin/AdminReading';
import AdminCatalog from '../components/admin/AdminCatalog';
import AdminCosts from '../components/admin/AdminCosts';
import { refreshAdminMetrics } from '../apiCalls/admin';

// Panel de administración (plan/25): agregados, sin montos de nadie. Solo rol admin (la API lo exige
// en cada ruta y audita cada acceso; el front solo esconde el enlace).
export const ADMIN_TABS = [
  { id: 'resumen', label: 'Resumen', component: AdminSummary },
  { id: 'usuarios', label: 'Usuarios', component: AdminUsers },
  { id: 'lectura', label: 'Lectura', component: AdminReading },
  { id: 'catalogo', label: 'Catálogo', component: AdminCatalog },
  { id: 'costos', label: 'Costos', component: AdminCosts },
];

const Admin = ({ user }) => {
  const { section = 'resumen' } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, [section]);

  const tab = ADMIN_TABS.find((t) => t.id === section);
  if (!tab) return <Navigate to="/admin" replace />;
  const Section = tab.component;

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      await refreshAdminMetrics();
      setReloadKey((k) => k + 1);
    } catch {
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Layout>
      {user && !user.is_admin ? (
        <Card className="mt-4"><p className="text-sm text-gray-800 dark:text-gray-200">Esta página es solo para administradores.</p></Card>
      ) : (
        <div className="flex flex-col gap-4 pt-3 pb-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Panel admin</h1>
              <p className="text-sm text-ink-2 dark:text-gray-400">Métricas agregadas de Topi. Cada consulta queda auditada.</p>
            </div>
            <div className="flex items-center gap-2">
              {refreshError && <span className="text-xs text-status-crit-text dark:text-red-400">No se pudo recalcular</span>}
              <Button variant="secondary" size="sm" icon={ArrowPathIcon} loading={refreshing} onClick={refresh}>Recalcular</Button>
            </div>
          </div>

          <nav aria-label="Secciones del panel admin"
            className="flex gap-1 overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0 border-b border-gray-200 dark:border-gray-700">
            {ADMIN_TABS.map((t) => {
              const active = t.id === tab.id;
              return (
                <Link key={t.id} to={t.id === 'resumen' ? '/admin' : `/admin/${t.id}`} aria-current={active ? 'page' : undefined}
                  className={`-mb-px shrink-0 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 rounded-t ${active
                    ? 'border-topi-500 text-gray-900 dark:text-white'
                    : 'border-transparent text-ink-2 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <Section reloadKey={reloadKey} />
        </div>
      )}
    </Layout>
  );
};

const mapStateToProps = (state) => ({ user: state.Auth.user });

export default connect(mapStateToProps)(Admin);
