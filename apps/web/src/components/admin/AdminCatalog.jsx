import { useAdminMetric, Panel, PanelSkeleton, PanelError, Stat, StatGrid, BarList, SimpleTable, fmtInt, fmtPct } from './AdminUi';

const CLASS_LABEL = { deposit: 'Depósito', investment: 'Inversión', credit: 'Crédito' };

const AdminCatalog = ({ reloadKey }) => {
  const catalog = useAdminMetric('catalog', reloadKey);
  if (catalog.loading && !catalog.data) return <PanelSkeleton rows={3} />;
  if (catalog.error) return <PanelError state={catalog} />;
  const c = catalog.data;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Presupuestos" subtitle="Categorías con presupuesto mayor a 0">
        <StatGrid>
          <Stat label="Usuarios con presupuesto" value={fmtPct(c.budget_pct)} hint={`${fmtInt(c.users_with_budget)} de ${fmtInt(c.users_total)}`} />
          <Stat label="Se pasan este mes" value={fmtPct(c.over_budget_pct)} hint={`${fmtInt(c.users_over_budget)} usuarios con alguna categoría pasada (aprox.)`} />
        </StatGrid>
      </Panel>

      <p className="text-xs text-ink-2 dark:text-gray-400 px-1">
        Los nombres de categorías y bancos solo aparecen si los usan 5 o más usuarios: un nombre personalizado puede tener datos personales.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Categorías más usadas" subtitle="Por número de usuarios · transacciones en 90 días">
          <SimpleTable rowKey={(r) => r.name} rows={c.categories || []} empty="Ninguna categoría con 5 o más usuarios" columns={[
            { key: 'name', label: 'Categoría' },
            { key: 'users', label: 'Usuarios', align: 'right', render: (r) => fmtInt(r.users) },
            { key: 'tx', label: 'Transacciones', align: 'right', render: (r) => fmtInt(r.tx) },
          ]} />
        </Panel>
        <Panel title="Candidatas a categoría por defecto" subtitle="Nombres personalizados más repetidos">
          <BarList items={(c.custom_candidates || []).map((r) => ({ name: r.name, value: r.users, hint: 'usuarios' }))}
            empty="Ningún nombre personalizado con 5 o más usuarios" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Cuentas por clase">
          <BarList items={(c.accounts_by_class || []).map((r) => ({ name: CLASS_LABEL[r.name] || r.name, value: r.count }))} />
        </Panel>
        <Panel title="Cuentas por moneda">
          <BarList items={(c.accounts_by_currency || []).map((r) => ({ name: r.name, value: r.count }))} />
        </Panel>
        <Panel title="Cuentas por banco" subtitle="Bancos con 5 o más usuarios">
          <BarList items={(c.accounts_by_bank || []).map((r) => ({ name: r.name, value: r.tx, hint: `${fmtInt(r.users)} usuarios` }))}
            empty="Ningún banco con 5 o más usuarios" />
        </Panel>
      </div>
    </div>
  );
};

export default AdminCatalog;
