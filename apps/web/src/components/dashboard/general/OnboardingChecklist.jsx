import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import Card from '../../ui/Card';
import UnsupportedBankNotice from './UnsupportedBankNotice';
import { getOnboardingStatus, getReadingStatus } from '../../../apiCalls/reading';
import { emitDataChanged, onDataChanged } from '../../../lib/dataEvents';
import { readingLine } from './readingText';

// Mientras se lee por primera vez (o justo después de ligar una cuenta) el estado se pide cada 5 s, con tope:
// así el Inicio se llena en vivo sin quedarse consultando para siempre (plan/30, bloque 2)
export const FAST_MS = 3 * 1000;
export const WATCH_MS = 10 * 60 * 1000;

// "¡Listo!" sale solo si en esta sesión se vio el checklist sin terminar (no a quien lo terminó hace meses)
const SEEN_KEY = 'topi_onboarding_en_curso';
const storage = {
    get: () => { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch (_) { return false; } },
    set: () => { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (_) { /* sin storage: no hay cierre */ } },
    clear: () => { try { sessionStorage.removeItem(SEEN_KEY); } catch (_) { /* nada */ } },
};

// huella de lo leído: cambia cuando el worker procesa correos o crea movimientos
const totals = (reading) => (reading?.connections || [])
    .map(c => `${c.id}:${c.emails_processed || 0}:${c.transactions_created || 0}`).join('|');

const STEP_TEXT = {
    connect_email: {
        title: 'Conecta tu correo',
        detail: 'El correo donde te llegan las notificaciones de tu banco. Topi solo lee las de tus bancos.',
        cta: { to: '/dashboard/connect-email', label: 'Conectar correo' },
    },
    first_auto_tx: {
        title: 'Recibe tu primer movimiento leído',
        detail: 'Llega solo, sin digitar nada, en cuanto ligues la cuenta de tu banco.',
    },
    budget: {
        title: 'Pon tu primer presupuesto',
        detail: 'Elige una categoría, como Comida o Transporte, y cuánto quieres gastar al mes.',
        cta: { to: '/dashboard/budgets', label: 'Crear presupuesto' },
    },
    review: {
        title: 'Revisa tus movimientos',
        detail: 'Topi pone una categoría a cada movimiento. Confirma las que no supo y dinos si alguna compra fue a cuotas.',
    },
};

const ReadingLines = ({ lines, className = '' }) => (lines.length === 0 ? null : (
    <div className={`flex flex-col gap-2 ${className}`}>
        {lines.map(({ id, line }) => (
            <div key={id} role="status" className={`rounded-xl px-3 py-2 text-sm ${TONES[line.tone]}`}>
                <p className="font-medium">{line.title}</p>
                {line.detail && <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-300">{line.detail}</p>}
                {typeof line.progress === 'number' && (
                    <div className="h-1.5 mt-2 rounded-full bg-white/70 dark:bg-gray-800 overflow-hidden" role="progressbar"
                        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(line.progress * 100)}>
                        <div className="h-full bg-topi-500 rounded-full transition-all duration-500" style={{ width: `${Math.max(4, Math.round(line.progress * 100))}%` }} />
                    </div>
                )}
                {line.tone === 'warn' && line.createAccount && <Link to="/dashboard?crear-cuenta=1" className="text-xs font-medium text-topi-600 dark:text-topi-200 hover:underline">Crear la cuenta de tu banco</Link>}
                {line.tone === 'warn' && !line.createAccount && !line.retrying && <Link to="/dashboard/accounts" className="text-xs font-medium text-topi-600 dark:text-topi-200 hover:underline">Ir a Cuentas</Link>}
            </div>
        ))}
    </div>
));

const TONES = {
    ok: 'bg-status-ok-soft dark:bg-emerald-950/40 text-gray-800 dark:text-gray-100',
    info: 'bg-topi-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100',
    warn: 'bg-amber-50 dark:bg-amber-950/40 text-gray-800 dark:text-gray-100',
};

/**
 * Bienvenida en el Inicio (plan/27 §B): checklist de 4 pasos con el estado real de la API (no del front), que se
 * oculta al completarse, más el estado "Leyendo tus correos…" y, por banco, el aviso que pide el remitente o dice
 * que aún no sabemos leerlo (plan/30).
 */
export const OnboardingChecklist = ({ load = getOnboardingStatus, loadReading = getReadingStatus, now = Date.now }) => {
    const [onboarding, setOnboarding] = useState(null);
    const [reading, setReading] = useState(null);
    const [closing, setClosing] = useState(false);
    const lastTotals = useRef(null);
    const watchUntil = useRef(0);
    const timer = useRef(null);
    const alive = useRef(true);

    const refresh = useCallback(async () => {
        const [o, r] = await Promise.all([load().catch(() => null), loadReading().catch(() => null)]);
        if (!alive.current) return r;
        setOnboarding(o);
        setReading(r);
        // llegaron movimientos o correos leídos: que las demás tarjetas del Inicio se actualicen
        if (r) {
            const t = totals(r);
            if (lastTotals.current !== null && t !== lastTotals.current) emitDataChanged('transactions');
            lastTotals.current = t;
        }
        if (o && !o.complete) storage.set();
        if (o?.complete && storage.get()) setClosing(true);
        return r;
    }, [load, loadReading]);

    const tick = useCallback(async () => {
        clearTimeout(timer.current);
        const r = await refresh();
        const firstRead = (r?.connections || []).some(c => c.reading === 'reading_first'
            || c.job?.state === 'queued' || c.job?.state === 'running');
        if (alive.current && (firstRead || now() < watchUntil.current)) {
            timer.current = setTimeout(tick, FAST_MS);
        }
    }, [refresh, now]);

    useEffect(() => {
        alive.current = true;
        tick();
        const off = onDataChanged((kind) => {
            if (kind === 'transactions') return; // lo emite este mismo componente
            // una cuenta o un correo nuevo arrancan una lectura: mirar de cerca un rato
            if (kind === 'account' || kind === 'connection') watchUntil.current = now() + WATCH_MS;
            tick();
        });
        return () => { alive.current = false; clearTimeout(timer.current); off(); };
    }, [tick, now]);

    const closeDone = () => { storage.clear(); setClosing(false); };

    const connections = reading?.connections || [];
    // un aviso por banco que no está dando movimientos (plan/30); las conexiones leídas antes del plan 30 no
    // traen estado por banco: se pregunta el remitente del primero
    const silentBanks = connections
        .filter(c => c.reading !== 'down' && c.reading !== 'inactive')
        .flatMap(c => {
            const flagged = (c.banks || []).filter(b => b.reading === 'no_emails' || b.reading === 'unreadable');
            if (flagged.length > 0) return flagged.map(b => ({ connection: c.id, bank: b }));
            if (c.reading === 'no_transactions' && (c.banks || [])[0]) {
                return [{ connection: c.id, bank: { ...c.banks[0], reading: 'no_emails' } }];
            }
            return [];
        });
    const lines = connections.map(c => ({ id: c.id, line: readingLine(c, now()) }))
        .filter(x => x.line && x.line.title !== 'Todavía no vemos movimientos de tu banco');

    const fixedSender = () => { watchUntil.current = now() + WATCH_MS; tick(); };
    const notices = silentBanks.map(({ connection, bank }) => (
        <UnsupportedBankNotice key={`u${connection}-${bank.id}`} bank={bank} onSaved={fixedSender} />
    ));

    if (onboarding?.complete && closing) {
        return (
            <div className="flex flex-col gap-2 lg:gap-6">
                <Card aria-labelledby="onboarding-done-title">
                    <div className="flex items-start gap-3">
                        <CheckCircleIcon className="w-7 h-7 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                        <div className="flex flex-col gap-1 min-w-0">
                            <h2 id="onboarding-done-title" className="text-base font-semibold text-gray-900 dark:text-white">¡Listo! Topi ya anota tus movimientos solo</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Cada vez que tu banco te escriba, lo verás aquí. Solo revisa lo que llegue a Por revisar.</p>
                        </div>
                        <button type="button" onClick={closeDone}
                            className="ml-auto shrink-0 text-sm font-medium text-topi-600 dark:text-topi-200 hover:underline">
                            Entendido
                        </button>
                    </div>
                </Card>
                {notices}
            </div>
        );
    }

    if (!onboarding || onboarding.complete) {
        // terminado el onboarding, una lectura nueva (otra cuenta, otro correo) también muestra su avance
        const jobLines = lines.filter(({ line }) => line.tone === 'ok' || typeof line.progress === 'number');
        if (notices.length === 0 && jobLines.length === 0) return null;
        return (
            <div className="flex flex-col gap-2 lg:gap-6">
                {jobLines.length > 0 && <Card><ReadingLines lines={jobLines} /></Card>}
                {notices}
            </div>
        );
    }

    const steps = onboarding.steps || [];
    const done = steps.filter(s => s.done).length;
    const next = steps.find(s => !s.done)?.id;

    return (
        <div className="flex flex-col gap-2 lg:gap-6">
            <Card aria-labelledby="onboarding-title">
                <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 id="onboarding-title" className="text-base font-semibold text-gray-900 dark:text-white">Empieza con Topi</h2>
                    <span className="text-xs text-ink-2 dark:text-gray-400">{done} de {steps.length}</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 mb-4 overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-topi-500 rounded-full transition-all" style={{ width: `${(100 * done) / (steps.length || 1)}%` }} />
                </div>
                <ol className="flex flex-col gap-3 lg:grid lg:grid-cols-4 lg:gap-4">
                    {steps.map((step, i) => {
                        const text = STEP_TEXT[step.id] || { title: step.id };
                        const isNext = step.id === next;
                        const detail = step.id === 'review' && onboarding.pending_review > 0
                            ? `Te ${onboarding.pending_review === 1 ? 'queda 1' : `quedan ${onboarding.pending_review}`} por revisar aquí abajo, en Por revisar.`
                            : text.detail;
                        return (
                            <li key={step.id} className={`flex gap-3 ${step.done ? 'opacity-70' : ''}`}>
                                {step.done
                                    ? <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400 shrink-0" aria-hidden="true" />
                                    : <span className={`w-6 h-6 shrink-0 rounded-full border-2 text-xs font-semibold flex items-center justify-center ${isNext ? 'border-topi-500 text-topi-600 dark:text-topi-200' : 'border-gray-300 dark:border-gray-600 text-gray-400'}`}>{i + 1}</span>}
                                <div className="min-w-0 flex flex-col gap-1">
                                    <p className={`text-sm font-medium ${step.done ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                        {text.title}
                                        <span className="sr-only">{step.done ? ' (hecho)' : ' (pendiente)'}</span>
                                    </p>
                                    {!step.done && <p className="text-xs text-gray-600 dark:text-gray-300">{detail}</p>}
                                    {!step.done && isNext && text.cta && (
                                        <Link to={text.cta.to} className="text-sm font-medium text-topi-600 dark:text-topi-200 hover:underline w-max">{text.cta.label}</Link>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
                <ReadingLines lines={lines} className="mt-4" />
            </Card>
            {notices}
        </div>
    );
};

export default OnboardingChecklist;
