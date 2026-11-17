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
export const readingLine = (connection, now = Date.now()) => {
    if (!connection) return null;
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
                title: `Tu correo de ${providerName(connection.provider)} no tiene cuentas ligadas`,
                detail: 'Crea (o edita) la cuenta del banco que te notifica a ese correo para que Topi sepa dónde anotar los movimientos.',
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
