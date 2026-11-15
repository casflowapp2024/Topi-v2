import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircleIcon } from '@heroicons/react/20/solid';
import Card from '../../ui/Card';
import UnsupportedBankNotice from './UnsupportedBankNotice';
import { getOnboardingStatus, getReadingStatus } from '../../../apiCalls/reading';
import { readingLine } from './readingText';

// Mientras una conexión está en su primera lectura, el estado se refresca cada minuto
const REFRESH_MS = 60 * 1000;

const STEP_TEXT = {
    connect_email: {
        title: 'Conecta tu correo',
        detail: 'El correo donde te llegan las notificaciones de tu banco. Topi solo lee las de tus bancos.',
        cta: { to: '/dashboard/connect-email', label: 'Conectar correo' },
    },
    first_auto_tx: {
        title: 'Recibe tu primer movimiento leído',
        detail: 'Llega solo, sin digitar nada, unos minutos después de conectar.',
    },
    review: {
        title: 'Revisa lo que está en Por revisar',
        detail: 'Confirma los movimientos que Topi no pudo clasificar del todo.',
    },
    budget: {
        title: 'Pon tu primer presupuesto',
        detail: 'Elige una categoría y cuánto quieres gastar al mes.',
        cta: { to: '/dashboard/budgets', label: 'Ir a Presupuestos' },
    },
};

const TONES = {
    info: 'bg-topi-50 dark:bg-gray-700/60 text-gray-800 dark:text-gray-100',
    warn: 'bg-amber-50 dark:bg-amber-950/40 text-gray-800 dark:text-gray-100',
};

/**
 * Bienvenida en el Inicio (plan/27 §B): checklist de 4 pasos con el estado real de la API (no del front), que se
 * oculta al completarse, más el estado "Leyendo tus correos…" y el aviso de banco no soportado (§C).
 */
export const OnboardingChecklist = ({ load = getOnboardingStatus, loadReading = getReadingStatus, now = Date.now }) => {
    const [onboarding, setOnboarding] = useState(null);
    const [reading, setReading] = useState(null);

    const refresh = useCallback(async () => {
        const [o, r] = await Promise.all([load().catch(() => null), loadReading().catch(() => null)]);
        setOnboarding(o);
        setReading(r);
        return r;
    }, [load, loadReading]);

    useEffect(() => {
        let alive = true;
        let timer;
        const tick = async () => {
            const r = await refresh();
            if (alive && (r?.connections || []).some(c => c.reading === 'reading_first')) {
                timer = setTimeout(tick, REFRESH_MS);
            }
        };
        tick();
        return () => { alive = false; clearTimeout(timer); };
    }, [refresh]);

    const connections = reading?.connections || [];
    const silent = connections.filter(c => c.reading === 'no_transactions');
    const lines = connections.map(c => ({ id: c.id, line: readingLine(c, now()) }))
        .filter(x => x.line && x.line.title !== 'Todavía no vemos movimientos de tu banco');

    const notices = silent.map(c => (
        <UnsupportedBankNotice key={`u${c.id}`} connection={c}
            supportedBanks={reading?.supported_banks || []} samplesAddress={reading?.samples_address || ''} />
    ));

    if (!onboarding || onboarding.complete) {
        return notices.length > 0 ? <div className="flex flex-col gap-2 lg:gap-6">{notices}</div> : null;
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
                            ? `Tienes ${onboarding.pending_review} movimiento${onboarding.pending_review === 1 ? '' : 's'} por revisar en el Inicio.`
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
                {lines.length > 0 && (
                    <div className="flex flex-col gap-2 mt-4">
                        {lines.map(({ id, line }) => (
                            <div key={id} role="status" className={`rounded-xl px-3 py-2 text-sm ${TONES[line.tone]}`}>
                                <p className="font-medium">{line.title}</p>
                                {line.detail && <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-300">{line.detail}</p>}
                                {line.tone === 'warn' && <Link to="/dashboard/accounts" className="text-xs font-medium text-topi-600 dark:text-topi-200 hover:underline">Ir a Cuentas</Link>}
                            </div>
                        ))}
                    </div>
                )}
            </Card>
            {notices}
        </div>
    );
};

export default OnboardingChecklist;
