import {
  CheckIcon, XMarkIcon, EnvelopeOpenIcon, BuildingLibraryIcon, InboxArrowDownIcon, LockClosedIcon, ServerIcon,
  LinkSlashIcon, ShieldCheckIcon, KeyIcon, BellAlertIcon, TrashIcon, PencilSquareIcon,
} from '@heroicons/react/24/outline';
import QuestionsDemo from './QuestionsDemo';
import { OfferStack, BankChecker, FoundersNote } from './Offer';
import { FAQ, FALLBACK_BANKS, FALLBACK_STATS, SUPPORT_EMAIL, BETA_LABEL, HERO_ROTATING, PURPOSE_LINES, PURPOSE_INTRO } from './site';

/**
 * Página pública de Topi (plan/27 §F; plan/28: propuesta de valor, dirección B "Un mes"). Componente puro (sin redux
 * ni router: enlaces <a>) para prerenderizarlo en el build (scripts/prerender.js). Sin precios, planes ni "Apoyar a
 * Topi"; sin prometer cifrado de los permisos; cifras solo de GET /public/stats. Oferta "Tu mes en automático"
 * (plan/28 §11) en Offer.jsx. Animaciones en CSS (qd-*, lp-*).
 */

const STEPS = [
  { icon: EnvelopeOpenIcon, title: 'Conecta tu correo', time: 'Un minuto', text: 'Gmail u Outlook, donde te llegan los avisos de tu banco. Solo lectura.' },
  { icon: BuildingLibraryIcon, title: 'Dile qué cuentas tienes', time: 'Un par de minutos', text: 'Tu banco y tus cuentas, para que cada movimiento caiga en su lugar.' },
  { icon: InboxArrowDownIcon, title: 'Topi anota solo', time: 'Desde hoy', text: 'Trae lo que va del mes y, desde ahí, cada aviso nuevo se anota solo.' },
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

// Reversión de riesgo sin precio (plan/28 §1). Sin prometer cifrado de los permisos.
const RISK = [
  { icon: LockClosedIcon, title: 'Solo lectura', text: 'Pedimos el permiso mínimo para leer correos: nunca el de enviar ni el de modificar.' },
  { icon: KeyIcon, title: 'Sin las claves de tu banco', text: 'Topi no entra a tu banco. Lee los avisos que tu banco ya te manda.' },
  { icon: LinkSlashIcon, title: 'Desconecta en un clic', text: 'Desde Ajustes → Conexiones o desde los permisos de tu cuenta de Google o Microsoft.' },
  { icon: TrashIcon, title: 'Tus datos, cuando quieras', text: 'Pide borrar tu cuenta y borramos tus datos, como dice la Política de privacidad.' },
  { icon: BellAlertIcon, title: 'Si no lee tu banco, te lo decimos', text: 'Con la primera lectura te decimos si encontramos los correos de tu banco y qué hacer si no.' },
  { icon: ServerIcon, title: 'El permiso se queda en el servidor', text: 'El acceso a tu correo nunca llega a tu navegador ni a otras apps. Sin anuncios y sin vender datos.' },
];

const buttonPrimary = 'inline-flex items-center justify-center h-12 px-6 rounded-2xl bg-topi-500 hover:bg-topi-600 text-white font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f1220] focus-visible:ring-topi-500';

const formatCount = (n) => new Intl.NumberFormat('es-CO').format(n);

// "Saber cuánto puedes gastar, si estás cumpliendo tus presupuestos y cómo crece tu dinero. Sin anotar nada."
const plain = HERO_ROTATING.map((p) => p.replace(/\.$/, ''));
const heroSentence = `Saber ${plain.slice(0, -1).join(', ')} y ${plain[plain.length - 1]}. Sin anotar nada.`;

const Section = ({ id, title, intro, children, className = '' }) => (
  <section id={id} aria-labelledby={`${id}-title`} className={`scroll-mt-16 px-4 sm:px-6 py-16 sm:py-24 ${className}`}>
    <div className="max-w-5xl mx-auto">
      <h2 id={`${id}-title`} className="lp-reveal text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h2>
      {intro && <p className="lp-reveal mt-4 max-w-2xl text-lg text-gray-700 dark:text-gray-300">{intro}</p>}
      <div className="mt-10">{children}</div>
    </div>
  </section>
);

const IconBadge = ({ icon: Icon }) => (
  <span className="w-10 h-10 shrink-0 rounded-xl bg-topi-50 dark:bg-gray-800 text-topi-600 dark:text-topi-200 flex items-center justify-center">
    <Icon className="w-5 h-5" aria-hidden="true" />
  </span>
);

// Prueba social con cifras reales (D1): sin testimonios
const Proof = ({ stats }) => {
  const items = [
    stats.automated_transactions > 0 && { value: `${formatCount(stats.automated_transactions)}+`, label: 'movimientos anotados solos en Topi' },
    stats.automated_pct > 0 && { value: `${stats.automated_pct} %`, label: 'de los movimientos llegan sin escribirlos' },
    stats.banks_read > 0 && { value: formatCount(stats.banks_read), label: 'bancos leídos' },
    { value: 'Solo lectura', label: 'en tu Gmail u Outlook' },
  ].filter(Boolean);
  return (
    <section aria-label="Topi en cifras" className="px-4 sm:px-6 py-10 border-b border-gray-100 dark:border-gray-800">
      <dl className={`max-w-5xl mx-auto grid grid-cols-2 gap-6 ${items.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {items.map(({ value, label }) => (
          <div key={label} className="lp-reveal flex flex-col-reverse justify-end">
            <dt className="mt-1 text-sm text-gray-600 dark:text-gray-400">{label}</dt>
            <dd className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

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

const LandingPage = ({ banks = FALLBACK_BANKS, stats = FALLBACK_STATS, year = new Date().getFullYear() }) => (
  <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-Inter">
    <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-white text-topi-600 p-2 rounded">Ir al contenido</a>
    <header className="sticky top-0 z-20 bg-[#0f1220]/90 backdrop-blur border-b border-white/5 text-white">
      <nav aria-label="Principal" className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2 font-bold text-lg">
          <img src="/T1.svg" alt="" width="32" height="32" className="w-8 h-8" />
          Topi
        </a>
        <div className="flex items-center gap-2">
          <a href="/login/" className="text-sm font-medium px-3 py-2 rounded-xl text-gray-200 hover:bg-white/10">Iniciar sesión</a>
          <a href="/create_account/" className="text-sm font-semibold px-4 py-2 rounded-xl bg-white text-gray-900 hover:bg-gray-100">Crear cuenta</a>
        </div>
      </nav>
    </header>

    <main id="contenido">
      <section aria-labelledby="hero-title" className="px-4 sm:px-6 pt-10 pb-16 sm:pt-16 sm:pb-24 bg-[#0f1220] text-white">
        <div className="max-w-5xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm font-semibold text-topi-200">
            <span className="w-2 h-2 rounded-full bg-topi-500" aria-hidden="true" />{BETA_LABEL}
          </span>
          <h1 id="hero-title" className="mt-5 text-[2.6rem] leading-[1.02] sm:text-6xl font-extrabold tracking-tight">
            {/* lectores de pantalla y buscadores: la frase completa; a la vista, lo que sabes cambia cada 3 s (CSS, lp-rot) */}
            <span className="sr-only">{heroSentence}</span>
            <span aria-hidden="true">
              Saber{' '}
              <span className="lp-rot inline-grid align-top">
                {HERO_ROTATING.map((phrase) => (
                  <span key={phrase} className="lp-rot-item col-start-1 row-start-1 text-[#a9b4ff]">{phrase}</span>
                ))}
              </span>
              <br />
              <span className="text-[#5b6078]">Sin anotar</span> <span className="text-[#7ee2b8]">nada.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-gray-300">
            Con Topi es posible. Conecta el correo donde te llegan las notificaciones de tus movimientos y en un minuto ve todo lo que va del mes: lo que gastaste, lo que te queda y cómo vas a cerrar. Para cualquier banco que te avise por correo.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="/create_account/" className={buttonPrimary}>Conectar mi correo</a>
          </div>
          <p className="mt-4 text-sm text-gray-400">Solo lectura · Sin claves del banco · Desconecta en un clic</p>
          <FoundersNote className="mt-5 max-w-2xl" />

          <QuestionsDemo />
        </div>
      </section>

      <Proof stats={stats} />

      <section id="como-funciona" aria-labelledby="como-funciona-title" className="scroll-mt-16 px-4 sm:px-6 py-12 sm:py-14 bg-gray-50 dark:bg-gray-800/40">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h2 id="como-funciona-title" className="lp-reveal text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">Cómo funciona</h2>
            <p className="lp-reveal text-gray-600 dark:text-gray-400">Lo configuras una vez. Después no tienes que anotar nada.</p>
          </div>
          <ol className="mt-6 grid gap-3 sm:grid-cols-3">
            {STEPS.map(({ icon, title, time, text }, i) => (
              <li key={title} className="lp-reveal flex gap-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
                <IconBadge icon={icon} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Paso {i + 1} · {time}</p>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="para-que" aria-labelledby="para-que-title" className="scroll-mt-16 px-4 sm:px-6 py-20 sm:py-28">
        <div className="max-w-5xl mx-auto">
          <h2 id="para-que-title" className="text-sm font-semibold uppercase tracking-wider text-topi-600 dark:text-topi-200">Para qué sirve Topi</h2>
          <p className="mt-6 text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.12] text-gray-900 dark:text-white">
            {PURPOSE_LINES.map((line) => <span key={line} className="lp-fill block mt-3 first:mt-0">{line}</span>)}
          </p>
          <p className="lp-reveal mt-10 max-w-2xl text-lg text-gray-700 dark:text-gray-300">{PURPOSE_INTRO}</p>
          <div className="mt-10"><OfferStack /></div>
        </div>
      </section>

      <Section id="que-lee" title="Qué lee Topi y qué no" className="bg-gray-50 dark:bg-gray-800/40"
        intro="Para anotar tus movimientos sin que los escribas, Topi necesita leer las notificaciones de tus bancos. Nada más.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="lp-reveal rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold">Lo que lee</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {READS.map((item) => (
                <li key={item} className="flex gap-3 text-gray-700 dark:text-gray-300">
                  <CheckIcon className="w-5 h-5 mt-0.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />{item}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-reveal rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
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

      <Section id="sin-riesgo" title="Pruébalo sin riesgo" intro="Darle acceso a tu correo es una decisión seria. Por eso todo es reversible.">
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {RISK.map(({ icon, title, text }) => (
            <li key={title} className="lp-reveal flex gap-4">
              <IconBadge icon={icon} />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-10 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <ShieldCheckIcon className="w-5 h-5 shrink-0" aria-hidden="true" />
          Los detalles están en la <a href="/privacy-policy/" className="underline text-topi-600 dark:text-topi-200">Política de privacidad</a>.
        </p>
      </Section>

      <section id="bancos" aria-labelledby="bancos-title" className="scroll-mt-16 py-16 sm:py-24 bg-gray-50 dark:bg-gray-800/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 id="bancos-title" className="lp-reveal text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">Funciona con tu banco</h2>
          <p className="lp-reveal mt-4 max-w-2xl text-lg text-gray-700 dark:text-gray-300">
            Con cualquier banco que te avise por correo cada compra, pago o transferencia, en tu país y en tu moneda.
          </p>
        </div>
        <div className="mt-10 overflow-hidden" aria-hidden="true">
          <div className="lp-marquee flex w-max gap-3">
            {[...banks, ...banks].map((bank, i) => (
              <span key={`${bank}-${i}`} className="px-5 py-2.5 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-base font-semibold whitespace-nowrap">{bank}</span>
            ))}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-10 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <BankChecker banks={banks} />
            <p className="sr-only">Bancos ya probados: {banks.join(', ')}.</p>
          </div>
          <div className="lp-reveal rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold">¿El tuyo no está? Agrégalo</h3>
            <ol className="mt-4 flex flex-col gap-3 text-gray-700 dark:text-gray-300">
              <li className="flex gap-3"><PencilSquareIcon className="w-5 h-5 mt-0.5 shrink-0 text-topi-600 dark:text-topi-200" aria-hidden="true" />Crea tu banco con su nombre.</li>
              <li className="flex gap-3"><EnvelopeOpenIcon className="w-5 h-5 mt-0.5 shrink-0 text-topi-600 dark:text-topi-200" aria-hidden="true" />Pega el correo desde el que te escribe (el campo «De» de una notificación).</li>
              <li className="flex gap-3"><CheckIcon className="w-5 h-5 mt-0.5 shrink-0 text-topi-600 dark:text-topi-200" aria-hidden="true" />Topi lee solo ese remitente; mientras aprende tu banco, lo que lea llega a Por revisar.</li>
            </ol>
          </div>
        </div>
      </section>

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

      <section aria-labelledby="cta-title" className="px-4 sm:px-6 py-20 bg-[#0f1220] text-white">
        <div className="max-w-5xl mx-auto">
          <h2 id="cta-title" className="lp-reveal text-4xl sm:text-6xl font-extrabold tracking-tight">
            Este mes, <span className="text-[#7ee2b8]">no anotes nada.</span>
          </h2>
          <p className="lp-reveal mt-4 text-lg text-gray-300">Conecta tu correo y mira tus finanzas al día en minutos. {BETA_LABEL}.</p>
          <div className="mt-6"><FoundersNote /></div>
          <a href="/create_account/" className={`mt-8 ${buttonPrimary}`}>Quiero mi mes en automático</a>
        </div>
      </section>
    </main>

    <SiteFooter year={year} />
  </div>
);

export default LandingPage;
