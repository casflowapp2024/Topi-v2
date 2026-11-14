import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ClockIcon, XCircleIcon, HeartIcon } from '@heroicons/react/20/solid';
import Layout from '../hocs/Layout';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Skeleton from '../components/ui/Skeleton';
import SupportSheet from '../components/support/SupportSheet';
import { formatMoney } from '../components/helpers';
import { getPayment, getBillingConfig, PENDING_STATUSES } from '../apiCalls/billing';

// Cuántas veces y cada cuánto se pregunta a la API mientras el pago está en proceso. La API consulta a Mercado
// Pago desde el servidor: lo que Mercado Pago agrega a la URL de regreso no se usa para nada.
export const POLL_TRIES = 10;
export const POLL_MS = 3000;

/** Estado de la página según el pago: loading | approved | pending | failed | missing */
export const thanksState = (payment, { loading, error } = {}) => {
  if (loading && !payment) return 'loading';
  if (error || !payment) return 'missing';
  if (payment.status === 'approved') return 'approved';
  if (PENDING_STATUSES.includes(payment.status)) return 'pending';
  return 'failed';
};

export const SupportThanksContent = ({ paymentId, pollMs = POLL_MS, tries = POLL_TRIES }) => {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(Boolean(paymentId));
  const [error, setError] = useState(!paymentId);
  const [retryOpen, setRetryOpen] = useState(false);
  const [billing, setBilling] = useState(null);
  const attempts = useRef(0);

  useEffect(() => {
    if (!paymentId) return undefined;
    let alive = true;
    let timer = null;
    const load = async () => {
      attempts.current += 1;
      try {
        const p = await getPayment(paymentId);
        if (!alive) return;
        setPayment(p);
        setError(false);
        if (PENDING_STATUSES.includes(p?.status) && attempts.current < tries) timer = setTimeout(load, pollMs);
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [paymentId, pollMs, tries]);

  useEffect(() => {
    getBillingConfig().then((cfg) => setBilling(cfg?.enabled ? cfg : null)).catch(() => {});
  }, []);

  const state = thanksState(payment, { loading, error });
  const amount = payment ? formatMoney(payment.amount, payment.currency) : '';

  return (
    <div className="flex justify-center pt-6 pb-24">
      <Card className="w-full max-w-md">
        {state === 'loading' && (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="Confirmando tu pago">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}

        {state === 'approved' && (
          <div className="flex flex-col gap-3" role="status">
            <CheckCircleIcon className="w-12 h-12 text-status-ok dark:text-emerald-400" aria-hidden="true" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">¡Gracias por apoyar a Topi!</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Recibimos tu aporte de <strong className="tabular-nums">{amount}</strong>. Te enviamos el recibo a tu correo.
            </p>
            <p className="text-sm text-ink-2 dark:text-gray-400">Fue un pago único: no se vuelve a cobrar y todo en Topi sigue igual para ti.</p>
            <Link to="/dashboard" className="mt-2"><Button className="w-full">Volver al Inicio</Button></Link>
          </div>
        )}

        {state === 'pending' && (
          <div className="flex flex-col gap-3" role="status">
            <ClockIcon className="w-12 h-12 text-status-warn dark:text-amber-300" aria-hidden="true" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tu pago está en proceso</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Mercado Pago todavía no lo confirma{amount ? ` (${amount})` : ''}. Algunos medios, como PSE o Efecty, tardan un
              poco. Cuando se apruebe te llega el recibo al correo; no tienes que hacer nada más.
            </p>
            <Link to="/dashboard" className="mt-2"><Button variant="secondary" className="w-full">Volver al Inicio</Button></Link>
          </div>
        )}

        {state === 'failed' && (
          <div className="flex flex-col gap-3" role="status">
            <XCircleIcon className="w-12 h-12 text-status-crit dark:text-red-400" aria-hidden="true" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">El pago no se completó</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">No se te cobró nada. Si quieres, puedes intentarlo otra vez.</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              {billing && <Button icon={HeartIcon} className="w-full sm:flex-1" onClick={() => setRetryOpen(true)}>Intentar de nuevo</Button>}
              <Link to="/dashboard" className="sm:flex-1"><Button variant="secondary" className="w-full">Volver al Inicio</Button></Link>
            </div>
          </div>
        )}

        {state === 'missing' && (
          <div className="flex flex-col gap-3" role="status">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">No encontramos ese pago</h1>
            <p className="text-sm text-gray-700 dark:text-gray-300">Si pagaste, el recibo te llega al correo cuando Mercado Pago lo confirme.</p>
            <Link to="/dashboard" className="mt-2"><Button variant="secondary" className="w-full">Volver al Inicio</Button></Link>
          </div>
        )}
      </Card>
      {billing && <SupportSheet open={retryOpen} onClose={() => setRetryOpen(false)} config={billing} />}
    </div>
  );
};

/** /apoyar/gracias?payment=<id>: regreso del checkout de Mercado Pago */
const SupportThanks = () => {
  const [params] = useSearchParams();
  return (
    <Layout>
      <SupportThanksContent paymentId={params.get('payment')} />
    </Layout>
  );
};

export default SupportThanks;
