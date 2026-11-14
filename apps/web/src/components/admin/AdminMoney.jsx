import { useCallback, useEffect, useState } from 'react';
import { formatMoney } from '../helpers';
import { getAdminMoney } from '../../apiCalls/billing';
import { isForbidden } from '../../apiCalls/admin';
import { Panel, PanelSkeleton, PanelError, Stat, StatGrid, SimpleTable, fmtInt, fmtDateTime } from './AdminUi';

// Aportes de "Apoyar a Topi" (plan/22, N1). Sin correos de usuarios: solo un id corto.
export const PAYMENT_STATUS = {
  created: 'Abierto', pending: 'En proceso', approved: 'Aprobado', rejected: 'Rechazado',
  cancelled: 'Cancelado', refunded: 'Devuelto',
};

const monthFmt = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const fmtMonth = (month) => {
  const d = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return month;
  const text = monthFmt.format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const AdminMoneyView = ({ data }) => {
  const currency = data.currency || 'COP';
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Apoyar a Topi" subtitle={data.enabled ? 'Pagos únicos y voluntarios · Mercado Pago' : 'Pagos apagados: BILLING_PROVIDER vacío'}>
        <StatGrid>
          <Stat label="Total aportado" value={formatMoney(data.total, currency)} hint="Aportes aprobados, toda la historia" />
          <Stat label="Aportes" value={fmtInt(data.payments)} />
          <Stat label="Personas que aportaron" value={fmtInt(data.supporters)} />
          <Stat label="En proceso (7 días)" value={fmtInt(data.pending)} hint="Checkouts abiertos o pagos sin confirmar"
            tone={data.pending > 0 ? 'warn' : undefined} />
        </StatGrid>
      </Panel>

      <Panel title="Por mes" subtitle="Últimos 12 meses · días de Bogotá">
        <SimpleTable rows={data.months || []} rowKey={(m) => m.month} empty="Todavía no hay aportes aprobados"
          columns={[
            { key: 'month', label: 'Mes', render: (m) => fmtMonth(m.month) },
            { key: 'payments', label: 'Aportes', align: 'right', render: (m) => fmtInt(m.payments) },
            { key: 'supporters', label: 'Personas', align: 'right', render: (m) => fmtInt(m.supporters) },
            { key: 'amount', label: 'Total', align: 'right', render: (m) => formatMoney(m.amount, currency) },
          ]} />
      </Panel>

      <Panel title="Últimos pagos" subtitle="Usuario = primeros 8 caracteres del id">
        <SimpleTable rows={data.recent || []} rowKey={(p) => p.id} empty="Sin pagos"
          columns={[
            { key: 'created_at', label: 'Fecha', render: (p) => fmtDateTime(p.created_at) },
            { key: 'user', label: 'Usuario', render: (p) => <code className="text-xs">{p.user}</code> },
            { key: 'status', label: 'Estado', render: (p) => PAYMENT_STATUS[p.status] || p.status },
            { key: 'amount', label: 'Monto', align: 'right', render: (p) => formatMoney(p.amount, p.currency) },
          ]} />
      </Panel>
    </div>
  );
};

const AdminMoney = ({ reloadKey }) => {
  const [state, setState] = useState({ data: null, loading: true, error: null, forbidden: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await getAdminMoney(), loading: false, error: null, forbidden: false });
    } catch (err) {
      setState({ data: null, loading: false, error: err, forbidden: isForbidden(err) });
    }
  }, []);
  useEffect(() => { load(); }, [load, reloadKey]);

  if (state.loading && !state.data) return <PanelSkeleton rows={3} />;
  if (state.error) return <PanelError state={state} />;
  return <AdminMoneyView data={state.data} />;
};

export default AdminMoney;
