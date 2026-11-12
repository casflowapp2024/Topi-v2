import { useEffect, useState } from 'react';
import Card from '../ui/Card';
import Chip from '../ui/Chip';
import Button from '../ui/Button';
import { getAdminUsers, isForbidden } from '../../apiCalls/admin';
import { PanelError, SimpleTable, fmtInt, fmtDay, fmtDate, fmtDateTime } from './AdminUi';
import { SkeletonRows } from '../ui/Skeleton';

export const SEGMENTS = [
  { id: '', label: 'Todos' },
  { id: 'active7', label: 'Activos 7 d' },
  { id: 'active30', label: 'Activos 30 d' },
  { id: 'active90', label: 'Activos 90 d' },
  { id: 'inactive90', label: 'Inactivos > 90 d' },
  { id: 'no_connection', label: 'Sin conexión' },
  { id: 'broken', label: 'Conexión caída' },
];

const PAGE = 50;

export const FounderBadge = ({ row }) => {
  if (row.founder_confirmed_at) {
    return <span className="inline-flex px-2 h-6 items-center rounded-full text-xs font-semibold bg-status-ok-soft text-money-in dark:bg-emerald-500/15 dark:text-money-in-dark">Confirmado</span>;
  }
  if (row.founder_eligible) {
    return <span className="inline-flex px-2 h-6 items-center rounded-full text-xs font-semibold bg-topi-50 text-topi-600 dark:bg-topi-500/15 dark:text-topi-200">Elegible</span>;
  }
  return <span className="text-xs text-ink-2 dark:text-gray-400">—</span>;
};

const connections = (r) => (
  <span className="tabular-nums">
    {fmtInt(r.connections_ok)}
    {r.connections_error > 0 && <span className="ml-1 text-status-crit-text dark:text-red-400">· {fmtInt(r.connections_error)} con error</span>}
  </span>
);

const AdminUsers = ({ reloadKey }) => {
  const [segment, setSegment] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    const id = setTimeout(() => { setSearch(query.trim()); setOffset(0); }, 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    getAdminUsers({ segment, q: search, limit: PAGE, offset })
      .then((data) => alive && setState({ loading: false, data, error: null }))
      .catch((error) => alive && setState({ loading: false, data: null, error, forbidden: isForbidden(error) }));
    return () => { alive = false; };
  }, [segment, search, offset, reloadKey]);

  const rows = state.data?.rows || [];
  const total = state.data?.total || 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usuarios</h2>
        <p className="text-xs text-ink-2 dark:text-gray-400">Para soporte y fundadores. Sin montos ni transacciones: solo fechas y conteos.</p>
      </div>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filtrar usuarios">
        {SEGMENTS.map((s) => (
          <Chip key={s.id || 'all'} selected={segment === s.id} onClick={() => { setSegment(s.id); setOffset(0); }}>{s.label}</Chip>
        ))}
      </div>
      <label className="flex flex-col gap-1 text-xs text-ink-2 dark:text-gray-400">
        Buscar por nombre o correo
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          className="h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500" />
      </label>

      {state.error && <PanelError state={state} />}
      {state.loading && !state.data && <SkeletonRows rows={5} />}

      {state.data && (
        <>
          {/* PC: tabla */}
          <div className="hidden lg:block">
            <SimpleTable rowKey={(r) => r.id} rows={rows} empty="Ningún usuario en este filtro" columns={[
              { key: 'name', label: 'Nombre', render: (r) => <span className="block max-w-[170px] truncate capitalize" title={r.name}>{r.name || '—'}</span> },
              { key: 'email', label: 'Correo', render: (r) => <span className="block max-w-[190px] truncate" title={r.email}>{r.email}</span> },
              { key: 'signup_at', label: 'Registro', render: (r) => fmtDate(r.signup_at) },
              { key: 'last', label: 'Activo', render: (r) => fmtDay(r.last_active_day) },
              { key: 'conn', label: 'Conexiones', render: connections },
              { key: 'read', label: 'Último leído', render: (r) => fmtDateTime(r.last_email_read_at) },
              { key: 'auto', label: 'Auto. 30 d', align: 'right', render: (r) => fmtInt(r.auto_tx_30d) },
              { key: 'founder', label: 'Fundador', render: (r) => <FounderBadge row={r} /> },
            ]} />
          </div>
          {/* Móvil: lista */}
          <ul className="lg:hidden flex flex-col divide-y divide-gray-100 dark:divide-gray-700/60">
            {rows.length === 0 && <li className="py-3 text-sm text-ink-2 dark:text-gray-400">Ningún usuario en este filtro</li>}
            {rows.map((r) => (
              <li key={r.id} className="py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate capitalize">{r.name || r.email}</span>
                  <FounderBadge row={r} />
                </div>
                <span className="text-xs text-ink-2 dark:text-gray-400 truncate">{r.email}</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  Registro {fmtDate(r.signup_at)} · activo {fmtDay(r.last_active_day)} · {fmtInt(r.auto_tx_30d)} automáticas 30 d
                </span>
                <span className="text-xs text-gray-700 dark:text-gray-300">Conexiones sanas: {connections(r)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs text-ink-2 dark:text-gray-400">
              {total ? `${fmtInt(offset + 1)}–${fmtInt(Math.min(offset + PAGE, total))} de ${fmtInt(total)}` : '0 usuarios'}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Anterior</Button>
              <Button variant="secondary" size="sm" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export default AdminUsers;
