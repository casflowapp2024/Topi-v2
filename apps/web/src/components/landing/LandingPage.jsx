import { CheckIcon, XMarkIcon, EnvelopeOpenIcon, SparklesIcon, ChartPieIcon, LockClosedIcon, ShieldCheckIcon, LinkSlashIcon, ServerIcon } from '@heroicons/react/24/outline';
import { FAQ, FALLBACK_BANKS, SUPPORT_EMAIL } from './site';

/**
 * Página pública de Topi (plan/27 §F). Componente puro (sin redux ni router: enlaces <a>) para poder
 * prerenderizarlo en el build (scripts/prerender.js) y que el HTML ya traiga el contenido.
 * Sin precios, planes ni "Apoyar a Topi".
 */

const STEPS = [
  { icon: EnvelopeOpenIcon, title: 'Conecta tu correo', text: 'El correo donde te llegan las notificaciones de tu banco. Gmail u Outlook, con permiso de solo lectura.' },
  { icon: SparklesIcon, title: 'Topi lee tus bancos', text: 'Cada compra, pago o transferencia que te notifica tu banco se anota sola en la cuenta correcta.' },
  { icon: ChartPieIcon, title: 'Tú solo revisas', text: 'Gastos del mes, presupuestos, flujo y patrimonio al día. Lo que Topi no sepa clasificar te lo pregunta.' },
];

const READS = [
  'Solo los correos de los remitentes de tus bancos (por ejemplo, las alertas de compra).',
  'De cada notificación: el monto, el comercio, la fecha y la cuenta.',
  'Para leerla usa un modelo de IA de Google (Gemini) que solo extrae el movimiento.',
];

const NEVER = [
  'No guarda el cuerpo de tus correos: solo el movimiento que sacó de ahí.',
  'No pide ni abre tus demás correos (personales, trabajo, otros servicios).',
  'No puede enviar, borrar ni cambiar nada en tu buzón.',
  'No se conecta a tu banco, no te pide sus claves y no puede mover tu dinero.',
];

const SECURITY = [
  { icon: LockClosedIcon, title: 'Solo lectura', text: 'Pedimos el permiso mínimo para leer correos: nunca el de enviar ni el de modificar.' },
  { icon: ServerIcon, title: 'El permiso se queda en el servidor', text: 'El acceso a tu correo vive solo en nuestro servidor: nunca llega a tu navegador ni a otras apps.' },
  { icon: LinkSlashIcon, title: 'Desconecta en un clic', text: 'Quita la conexión desde Ajustes → Conexiones o desde los permisos de tu cuenta de Google o Microsoft.' },
  { icon: ShieldCheckIcon, title: 'Tus datos no se venden', text: 'Sin anuncios y sin vender datos. Los usamos solo para darte el servicio, como explica la Política de privacidad.' },
];

const buttonPrimary = 'inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-topi-500 hover:bg-topi-600 text-white font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-topi-500';
const buttonSecondary = 'inline-flex items-center justify-center h-12 px-6 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500';

const Section = ({ id, title, intro, children, className = '' }) => (
  <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-16 px-4 sm:px-6 py-14 sm:py-20 ${className}`}>
    <div className="max-w-5xl mx-auto">
      <h2 id={`${id}-title`} className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">{title}</h2>
      {intro && <p className="mt-3 max-w-2xl text-gray-700 dark:text-gray-300">{intro}</p>}
      <div className="mt-8">{children}</div>
    </div>
  </section>
);

export const SiteFooter = ({ year = new Date().getFullYear() }) => (
  <footer className="px-4 sm:px-6 py-10 border-t border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400">
    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4 justify-between">
      <p>© {year} Topi · Hecho en Colombia</p>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
        <a href="/privacy-policy/" className="hover:underline">Política de privacidad</a>
        <a href="/terms-of-service/" className="hover:underline">Términos</a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">Contacto</a>
      </nav>
    </div>
  </footer>
);

const LandingPage = ({ banks = FALLBACK_BANKS, year = new Date().getFullYear() }) => (
  <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-Inter">
    <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white text-topi-600 p-2 rounded">Ir al contenido</a>
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-b border-gray-100 dark:border-gray-800">
      <nav aria-label="Principal" className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
          <img src="/T1.svg" alt="" width="32" height="32" className="w-8 h-8" />
          Topi
        </a>
        <div className="hidden md:flex items-center gap-6 text-sm text-gray-700 dark:text-gray-300">
          <a href="#como-funciona" className="hover:text-topi-600">Cómo funciona</a>
          <a href="#que-lee" className="hover:text-topi-600">Qué lee</a>
          <a href="#seguridad" className="hover:text-topi-600">Seguridad</a>
          <a href="#bancos" className="hover:text-topi-600">Bancos</a>
          <a href="#preguntas" className="hover:text-topi-600">Preguntas</a>
        </div>
        <div className="flex items-center gap-2">
          <a href="/login/" className="text-sm font-medium px-3 py-2 rounded-xl text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">Iniciar sesión</a>
          <a href="/create_account/" className="text-sm font-semibold px-4 py-2 rounded-xl bg-topi-500 hover:bg-topi-600 text-white">Crear cuenta</a>
        </div>
      </nav>
    </header>

    <main id="contenido">
      <section aria-labelledby="hero-title" className="px-4 sm:px-6 pt-14 pb-16 sm:pt-24 sm:pb-24 bg-gradient-to-b from-topi-50 to-white dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm font-semibold text-topi-600 dark:text-topi-200">Finanzas personales para Colombia</p>
          <h1 id="hero-title" className="mt-3 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Tus finanzas al día, sin digitar nada
          </h1>
          <p className="mt-5 text-lg text-gray-700 dark:text-gray-300">
            Topi lee las notificaciones que te envían tus bancos y arma solo tus gastos, cuentas y presupuestos. Tú solo revisas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/create_account/" className={buttonPrimary}>Crear mi cuenta</a>
            <a href="#que-lee" className={buttonSecondary}>Qué lee y qué no</a>
          </div>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Solo lectura · No pide las claves de tu banco · Desconecta cuando quieras</p>
        </div>
      </section>

      <Section id="como-funciona" title="Cómo funciona">
        <ol className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-full bg-topi-50 dark:bg-gray-800 text-topi-600 dark:text-topi-200 flex items-center justify-center">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Paso {i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-gray-700 dark:text-gray-300">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="que-lee" title="Qué lee Topi y qué no" className="bg-gray-50 dark:bg-gray-800/40"
        intro="Para anotar tus movimientos sin que digites, Topi necesita leer las notificaciones de tus bancos. Nada más.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold">Lo que lee</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {READS.map((item) => (
                <li key={item} className="flex gap-3 text-gray-700 dark:text-gray-300">
                  <CheckIcon className="w-5 h-5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />{item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold">Lo que nunca hace</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {NEVER.map((item) => (
                <li key={item} className="flex gap-3 text-gray-700 dark:text-gray-300">
                  <XMarkIcon className="w-5 h-5 mt-0.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />{item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section id="seguridad" title="Seguridad">
        <ul className="grid gap-6 sm:grid-cols-2">
          {SECURITY.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-topi-50 dark:bg-gray-800 text-topi-600 dark:text-topi-200 flex items-center justify-center">
                <Icon className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="bancos" title="Bancos que Topi lee hoy" className="bg-gray-50 dark:bg-gray-800/40"
        intro="Agregamos bancos según los pidan. Si el tuyo no está, puedes anotar tus movimientos a mano mientras tanto y avisarnos.">
        <ul className="flex flex-wrap gap-2" aria-label="Bancos soportados">
          {banks.map((bank) => (
            <li key={bank} className="px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm font-medium">{bank}</li>
          ))}
        </ul>
        <p className="mt-6 text-gray-700 dark:text-gray-300">
          ¿Falta tu banco? Escríbenos a <a className="text-topi-600 dark:text-topi-200 underline" href={`mailto:${SUPPORT_EMAIL}?subject=Quiero%20que%20Topi%20lea%20mi%20banco`}>{SUPPORT_EMAIL}</a>.
        </p>
      </Section>

      <Section id="preguntas" title="Preguntas frecuentes">
        <div className="flex flex-col divide-y divide-gray-200 dark:divide-gray-700 border-y border-gray-200 dark:border-gray-700">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none flex justify-between gap-4 font-semibold text-gray-900 dark:text-white">
                {q}
                <span className="text-topi-600 dark:text-topi-200 group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-gray-700 dark:text-gray-300">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <section aria-labelledby="cta-title" className="px-4 sm:px-6 py-16 bg-topi-500 text-white text-center">
        <h2 id="cta-title" className="text-2xl sm:text-3xl font-bold">Deja de digitar tus gastos</h2>
        <p className="mt-3 text-white">Conecta tu correo y mira tus finanzas al día en minutos.</p>
        <a href="/create_account/" className="mt-8 inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-white text-topi-600 font-semibold hover:bg-topi-50">Crear mi cuenta</a>
      </section>
    </main>

    <SiteFooter year={year} />
  </div>
);

export default LandingPage;
