import { InformationCircleIcon } from '@heroicons/react/20/solid';

/**
 * Antes del permiso de Gmail (plan/27 §A): mientras Google revisa la app, su pantalla dice que no la verificó.
 * Explica cómo seguir para que nadie abandone ahí. Solo se muestra para Gmail.
 */
const GoogleUnverifiedHint = ({ className = '' }) => (
    <p className={`flex gap-2 text-xs text-gray-600 dark:text-gray-300 ${className}`}>
        <InformationCircleIcon className="w-4 h-4 mt-0.5 shrink-0 text-topi-500 dark:text-topi-200" aria-hidden="true" />
        <span>
            Google está revisando Topi. Si ves <strong>«Google no verificó esta app»</strong>, toca{' '}
            <strong>Configuración avanzada</strong> y luego <strong>Ir a Topi</strong>. Topi solo lee los correos
            que te envían tus bancos: no puede enviar correos ni mover tu dinero.
        </span>
    </p>
);

export default GoogleUnverifiedHint;
