// Textos del estado de lectura (plan/27 §B). Sin montos ni contenido de correos: solo fechas y conteos.

const providerName = (provider) => (provider === 'outlook' ? 'Outlook' : provider === 'gmail' ? 'Gmail' : 'tu correo');

// "hace 5 min", "hace 3 h", "hace 2 días"
export const timeAgo = (iso, now = Date.now()) => {
    if (!iso) return null;
    const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
    if (minutes < 1) return 'hace un momento';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `hace ${hours} h`;
    const days = Math.round(hours / 24);
    return `hace ${days} día${days === 1 ? '' : 's'}`;
};

const bankList = (banks) => (banks || []).map(b => b.name).join(', ');

/**
 * Una línea por conexión: qué pasa con la lectura. Devuelve { tone, title, detail } o null si no hay nada
 * que decir (lectura funcionando).
 */
// "Listo" se muestra este tiempo después de terminar la lectura (plan/31)
export const DONE_VISIBLE_MS = 10 * 60 * 1000;

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Avance de la última lectura prioritaria (plan/31). Devuelve { tone, title, detail, progress } o null.
 * progress (0–1) solo mientras lee.
 */
export const jobLine = (job, now = Date.now()) => {
    if (!job) return null;
    const listed = Number(job.listed) || 0;
    const processed = Math.min(Number(job.processed) || 0, listed);
    const created = Number(job.created) || 0;
    switch (job.state) {
        case 'queued':
            return { tone: 'info', title: 'Preparando la lectura de tus correos…', detail: 'Empieza en unos segundos.', progress: 0 };
        case 'running':
            return {
                tone: 'info',
                title: listed > 0 ? `Leyendo ${processed} de ${plural(listed, 'correo')}…` : 'Buscando los correos de tu banco…',
                detail: created > 0 ? `${plural(created, 'movimiento')} hasta ahora. Puedes seguir usando Topi mientras tanto.` : 'Puedes seguir usando Topi mientras tanto.',
                progress: listed > 0 ? processed / listed : 0,
            };
        case 'done': {
            const finished = job.finished_at ? new Date(job.finished_at).getTime() : now;
            if (created === 0 || now - finished > DONE_VISIBLE_MS) return null;
            return {
                tone: 'ok',
                title: `Listo: encontramos ${plural(created, 'movimiento')} en tus correos`,
                detail: 'Ya están en tu Inicio. De aquí en adelante Topi los lee solo, cada hora.',
            };
        }
        case 'failed':
            return { tone: 'warn', title: 'No pudimos terminar de leer tus correos', detail: 'Lo reintentamos solos en unos minutos.', retrying: true };
        default:
            return null;
    }
};

export const readingLine = (connection, now = Date.now()) => {
    if (!connection) return null;
    // mientras hay una lectura en curso (o recién terminada), su avance manda (plan/31)
    const job = jobLine(connection.job, now);
    if (job) return job;
    const banks = bankList(connection.banks);
    const lastRead = timeAgo(connection.last_read_at, now);
    const processed = Number(connection.emails_processed) || 0;
    const created = Number(connection.transactions_created) || 0;
    switch (connection.reading) {
        case 'reading_first':
            return {
                tone: 'info',
                title: 'Leyendo tus correos…',
                detail: [
                    banks ? `Esperamos movimientos de ${banks}.` : null,
                    processed > 0
                        ? `Revisamos ${processed} correo${processed === 1 ? '' : 's'}${created > 0 ? ` · ${created} movimiento${created === 1 ? '' : 's'}` : ''}.`
                        : (lastRead ? `Última lectura ${lastRead}.` : 'Suele tardar menos de un minuto.'),
                    'La primera trae tus movimientos recientes.',
                ].filter(Boolean).join(' '),
            };
        case 'no_accounts':
            return {
                tone: 'warn',
                title: 'Falta un paso: crea la cuenta de tu banco',
                detail: `Tu correo de ${providerName(connection.provider)} ya está conectado. Crea la cuenta del banco que te escribe ahí para que Topi sepa dónde anotar tus movimientos.`,
                createAccount: true,
            };
        case 'no_transactions':
            return {
                tone: 'warn',
                title: 'Todavía no vemos movimientos de tu banco',
                detail: lastRead ? `Leímos tu correo ${lastRead}, pero no encontramos notificaciones que sepamos leer.` : null,
            };
        default:
            return null;
    }
};
