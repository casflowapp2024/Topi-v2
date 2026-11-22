import { useCallback, useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/20/solid';
import Button from '../ui/Button';
import Sheet from '../ui/Sheet';
import BankLogo from '../ui/BankLogo';
import Field, { Input, Select } from '../ui/Field';
import { isForbidden } from '../../apiCalls/admin';
import {
  getCatalogBanks, getUserSenders, createCatalogBank, updateCatalogBank, setCatalogBankActive,
  addCatalogSender, updateCatalogSender, uploadCatalogLogo, deleteCatalogLogo, LOGO_MAX_BYTES, LOGO_TYPES,
} from '../../apiCalls/bankCatalog';
import { Panel, PanelSkeleton, PanelError, SimpleTable, fmtInt, fmtDate } from './AdminUi';

// Mensajes de la API (contrato en core/domain/error.go)
export const apiError = (err) => {
  const status = err?.response?.status;
  if (status === 409) return 'Ya existe un banco con ese nombre o ese identificador.';
  if (status === 400) {
    const msg = (err?.response?.data?.messages || []).join(' ');
    if (msg.includes('sender')) return 'Escribe un solo correo, por ejemplo alertas@banco.com.co.';
    if (msg.includes('logo')) return 'El logo debe ser PNG, WebP o SVG de hasta 100 KB.';
    return 'Revisa el nombre, el identificador (letras, números y guiones) y el color (#RRGGBB).';
  }
  if (status === 404) return 'Ese banco ya no existe. Recarga la página.';
  return 'No se pudo guardar. Inténtalo otra vez.';
};

/** Salud de un remitente en 30 días: leídos, con movimiento, sin movimiento, con error. */
export const HealthLine = ({ health }) => {
  const h = health || {};
  if (!h.read) return <span className="text-xs text-status-warn-text dark:text-amber-300">Sin correos en 30 días</span>;
  return (
    <span className="text-xs text-ink-2 dark:text-gray-400 tabular-nums">
      {fmtInt(h.read)} leídos · {fmtInt(h.transactions)} con movimiento · {fmtInt(h.no_transaction)} sin movimiento
      {h.errors > 0 && <span className="text-status-crit-text dark:text-red-400"> · {fmtInt(h.errors)} con error</span>}
      {h.last_email_at && <> · último {fmtDate(h.last_email_at)}</>}
    </span>
  );
};

const Badge = ({ children, tone = 'default' }) => (
  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone === 'off'
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    : 'bg-topi-50 text-topi-600 dark:bg-gray-700 dark:text-topi-200'}`}>{children}</span>
);

/** Un banco del catálogo: logo, uso y sus remitentes con su salud. */
export const CatalogBankCard = ({ bank, onEdit }) => (
  <li className="py-4 flex flex-col gap-3">
    <div className="flex items-center gap-3">
      <BankLogo name={bank.name} logoUrl={bank.logo_url} color={bank.color} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-gray-100">{bank.name}</span>
          {!bank.active && <Badge tone="off">Inactivo</Badge>}
          <code className="text-xs text-ink-2 dark:text-gray-400">{bank.slug}</code>
        </div>
        <p className="text-xs text-ink-2 dark:text-gray-400">
          {fmtInt(bank.users)} usuarios · {fmtInt(bank.connected_users)} con correo conectado
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => onEdit(bank)}>Editar</Button>
    </div>
    <ul className="flex flex-col gap-1.5 pl-14">
      {(bank.senders || []).length === 0 && <li className="text-xs text-status-warn-text dark:text-amber-300">Sin remitentes: no se lee</li>}
      {(bank.senders || []).map((s) => (
        <li key={s.id} className={`flex flex-col ${s.active ? '' : 'opacity-60'}`}>
          <span className="text-sm text-gray-800 dark:text-gray-200 break-all">
            {s.email} {!s.active && <Badge tone="off">Desactivado</Badge>}
            {s.note && <span className="text-xs text-ink-2 dark:text-gray-400"> · {s.note}</span>}
          </span>
          <HealthLine health={s.health} />
        </li>
      ))}
    </ul>
  </li>
);

/** Crear o editar un banco: datos, logo y remitentes. Cada cambio se guarda al momento y recarga la lista. */
export const BankSheet = ({ bank, creating, onClose, onChanged, api = {
  createCatalogBank, updateCatalogBank, setCatalogBankActive, addCatalogSender, updateCatalogSender, uploadCatalogLogo, deleteCatalogLogo,
} }) => {
  const open = Boolean(bank) || creating;
  const [form, setForm] = useState({ name: '', slug: '', color: '' });
  const [newSender, setNewSender] = useState({ email: '', note: '' });
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({ name: bank?.name || '', slug: bank?.slug || '', color: bank?.color || '' });
    setNewSender({ email: '', note: '' });
    setError(null);
  }, [bank, creating]);

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      const out = await fn();
      await onChanged(out);
      return true;
    } catch (err) {
      setError(apiError(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const payload = () => ({ name: form.name, slug: form.slug, country: bank?.country || 'CO', color: form.color || null });
  const save = () => run('save', () => (creating ? api.createCatalogBank(payload()) : api.updateCatalogBank(bank.id, payload())));
  const addSender = async () => {
    if (await run('sender', () => api.addCatalogSender(bank.id, newSender.email, newSender.note))) setNewSender({ email: '', note: '' });
  };
  const onLogo = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > LOGO_MAX_BYTES || (file.type && !LOGO_TYPES.includes(file.type))) {
      setError('El logo debe ser PNG, WebP o SVG de hasta 100 KB.');
      return;
    }
    run('logo', () => api.uploadCatalogLogo(bank.id, file));
  };

  return (
    <Sheet open={open} onClose={onClose} size="lg" title={creating ? 'Nuevo banco' : bank?.name}
      description={creating ? 'Después de crearlo podrás agregar remitentes y el logo.' : 'Los cambios se guardan al momento y llegan a los usuarios en el siguiente job.'}
      footer={(
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button loading={busy === 'save'} onClick={save} disabled={!form.name.trim()}>{creating ? 'Crear banco' : 'Guardar datos'}</Button>
        </div>
      )}>
      <div className="flex flex-col gap-5 px-5 py-4">
        {error && <p role="alert" className="text-sm text-status-crit-text dark:text-red-400">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre" required className="sm:col-span-2" help="Así lo ve el usuario. Los bancos de usuario con este nombre quedan ligados.">
            <Input value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Identificador" help="Vacío: sale del nombre.">
            <Input value={form.slug} maxLength={60} placeholder="banco-de-bogota" onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Color" help="#RRGGBB, para las iniciales sin logo.">
            <div className="flex items-center gap-2">
              <Input value={form.color} maxLength={7} placeholder="#FDDA24" onChange={(e) => setForm({ ...form, color: e.target.value })} />
              <BankLogo name={form.name} color={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : null} />
            </div>
          </Field>
        </div>

        {!creating && bank && (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Logo</h3>
              <div className="flex flex-wrap items-center gap-3">
                <BankLogo name={bank.name} logoUrl={bank.logo_url} color={bank.color} size="lg" />
                <label className="inline-flex">
                  <span className="sr-only">Subir logo</span>
                  <input type="file" accept={LOGO_TYPES.join(',')} onChange={onLogo} disabled={busy === 'logo'}
                    className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-topi-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-topi-600 dark:file:bg-gray-700 dark:file:text-topi-200" />
                </label>
                {bank.logo_url && (
                  <Button size="sm" variant="ghost" loading={busy === 'logo-del'} onClick={() => run('logo-del', () => api.deleteCatalogLogo(bank.id))}>Quitar logo</Button>
                )}
              </div>
              <p className="text-xs text-ink-2 dark:text-gray-400">PNG, WebP o SVG de hasta 100 KB. Cuadrado y con fondo se ve mejor.</p>
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Remitentes</h3>
              <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
                {(bank.senders || []).map((s) => (
                  <li key={s.id} className="py-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-sm break-all ${s.active ? '' : 'line-through opacity-60'}`}>{s.email}</p>
                      {s.note && <p className="text-xs text-ink-2 dark:text-gray-400">{s.note}</p>}
                      <HealthLine health={s.health} />
                    </div>
                    <Button size="sm" variant={s.active ? 'ghost' : 'secondary'} loading={busy === `s${s.id}`}
                      onClick={() => run(`s${s.id}`, () => api.updateCatalogSender(bank.id, s.id, !s.active, s.note))}>
                      {s.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-2 items-end">
                <Field label="Correo nuevo">
                  <Input type="email" value={newSender.email} placeholder="alertas@banco.com.co" onChange={(e) => setNewSender({ ...newSender, email: e.target.value })} />
                </Field>
                <Field label="Nota">
                  <Input value={newSender.note} maxLength={200} placeholder="Opcional" onChange={(e) => setNewSender({ ...newSender, note: e.target.value })} />
                </Field>
                <Button icon={PlusIcon} loading={busy === 'sender'} disabled={!newSender.email.trim()} onClick={addSender}>Agregar</Button>
              </div>
              <p className="text-xs text-ink-2 dark:text-gray-400">Los remitentes no se borran: se desactivan, para que no vuelvan desde una copia vieja.</p>
            </section>

            <section className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <p className="text-sm text-ink-2 dark:text-gray-300">
                {bank.active ? 'Si lo desactivas, no aparece para elegir, pero sigue leyendo a quien ya lo tiene.' : 'Inactivo: no aparece para elegir.'}
              </p>
              <Button size="sm" variant={bank.active ? 'ghost' : 'secondary'} loading={busy === 'active'}
                onClick={() => run('active', () => api.setCatalogBankActive(bank.id, !bank.active))}>
                {bank.active ? 'Desactivar banco' : 'Activar banco'}
              </Button>
            </section>
          </>
        )}
      </div>
    </Sheet>
  );
};

/** Remitentes que escribieron los usuarios y el catálogo no tiene. Nunca dice quién. */
export const UserSendersPanel = ({ data, banks, onPromote, promoting }) => {
  const [target, setTarget] = useState({});
  const rows = data?.senders || [];
  const minUsers = data?.min_users || 5;
  return (
    <Panel title="Lo que agregaron los usuarios"
      subtitle={`Correos que el catálogo no tiene para ese banco. Los de gmail, hotmail y parecidos se ocultan si los usan menos de ${minUsers} usuarios; el nombre del banco, igual.`}>
      <SimpleTable rowKey={(r) => r.email} rows={rows} empty="Ningún correo fuera del catálogo" columns={[
        { key: 'email', label: 'Correo', render: (r) => <span className="break-all whitespace-normal">{r.email}</span> },
        { key: 'users', label: 'Usuarios', align: 'right', render: (r) => fmtInt(r.users) },
        { key: 'bank', label: 'Banco', render: (r) => r.catalog_bank || r.bank_name || <span className="text-ink-2 dark:text-gray-400">—</span> },
        { key: 'health', label: 'Lectura en 30 días', render: (r) => <HealthLine health={r.health} /> },
        { key: 'action', label: '', render: (r) => (r.masked ? (
          <span className="text-xs text-ink-2 dark:text-gray-400">Oculto</span>
        ) : r.in_catalog_as ? (
          <span className="text-xs text-ink-2 dark:text-gray-400">Ya está en {r.in_catalog_as}</span>
        ) : (
          <div className="flex items-center gap-2">
            <Select aria-label={`Banco para ${r.email}`} className="h-9 text-sm" value={target[r.email] || ''}
              onChange={(e) => setTarget({ ...target, [r.email]: e.target.value })}>
              <option value="">Elegir banco…</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Button size="sm" variant="secondary" disabled={!target[r.email]} loading={promoting === r.email}
              onClick={() => onPromote(Number(target[r.email]), r.email)}>Agregar al catálogo</Button>
          </div>
        )) },
      ]} />
    </Panel>
  );
};

const useLoad = (fn, reloadKey) => {
  const [state, setState] = useState({ data: null, loading: true, error: null, forbidden: false });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      setState({ data: await fn(), loading: false, error: null, forbidden: false });
    } catch (err) {
      setState({ data: null, loading: false, error: err, forbidden: isForbidden(err) });
    }
  }, [fn]);
  useEffect(() => { load(); }, [load, reloadKey]);
  return [state, load];
};

/** Panel → Bancos (plan/33): catálogo editable, salud por remitente y lo que agregaron los usuarios. */
const AdminBanks = ({ reloadKey }) => {
  const [catalog, reloadCatalog] = useLoad(getCatalogBanks, reloadKey);
  const [senders, reloadSenders] = useLoad(getUserSenders, reloadKey);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [promoting, setPromoting] = useState(null);
  const [promoteError, setPromoteError] = useState(null);

  if (catalog.loading && !catalog.data) return <PanelSkeleton rows={3} />;
  if (catalog.error) return <PanelError state={catalog} />;
  const banks = catalog.data?.banks || [];
  const editing = banks.find((b) => b.id === editingId) || null;

  const onChanged = async (created) => {
    await Promise.all([reloadCatalog(), reloadSenders()]);
    if (creating && created?.id) {
      setCreating(false);
      setEditingId(created.id);
    }
  };
  const onPromote = async (bankId, email) => {
    setPromoting(email);
    setPromoteError(null);
    try {
      await addCatalogSender(bankId, email, 'Agregado desde lo que escribieron los usuarios');
      await Promise.all([reloadCatalog(), reloadSenders()]);
    } catch (err) {
      setPromoteError(apiError(err));
    } finally {
      setPromoting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Catálogo de bancos"
        subtitle={`${fmtInt(banks.length)} bancos · salud de cada remitente en los últimos 30 días`}
        action={<Button size="sm" icon={PlusIcon} onClick={() => { setEditingId(null); setCreating(true); }}>Nuevo banco</Button>}>
        <ul className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700">
          {banks.map((b) => <CatalogBankCard key={b.id} bank={b} onEdit={(bank) => { setCreating(false); setEditingId(bank.id); }} />)}
        </ul>
      </Panel>

      {promoteError && <p role="alert" className="text-sm text-status-crit-text dark:text-red-400 px-1">{promoteError}</p>}
      {senders.error ? <PanelError state={senders} /> : senders.loading && !senders.data ? <PanelSkeleton rows={1} /> : (
        <UserSendersPanel data={senders.data} banks={banks} onPromote={onPromote} promoting={promoting} />
      )}

      <BankSheet bank={editing} creating={creating} onChanged={onChanged}
        onClose={() => { setEditingId(null); setCreating(false); }} />
    </div>
  );
};

export default AdminBanks;
