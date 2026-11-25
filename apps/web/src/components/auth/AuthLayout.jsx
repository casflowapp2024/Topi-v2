import { CheckIcon } from '@heroicons/react/20/solid';
import { FoundersNote } from '../landing/Offer';
import { BETA_LABEL } from '../landing/site';

/**
 * Marco de Iniciar sesión y Crear cuenta con el mismo estilo de la landing (plan/28 §16): fondo oscuro del hero, logo
 * arriba con el botón a la otra página y el formulario en una tarjeta. En PC, a la izquierda, lo que Topi promete.
 */

export const authLabel = 'block mb-1.5 text-sm font-medium text-gray-800 dark:text-gray-200';
export const authInput = 'block w-full h-12 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-topi-500 focus:border-topi-500 transition-colors';
export const authButton = 'w-full h-12 inline-flex items-center justify-center rounded-2xl bg-topi-500 hover:bg-topi-600 text-white font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-topi-500';
export const authLink = 'font-semibold text-topi-600 dark:text-topi-200 hover:underline';

// Lo que la persona gana al entrar (resultados, no garantías: las de seguridad viven en la landing, donde se buscan)
const PROMISES = ['Cada compra que te avise tu banco, anotada sola', 'Sabes cada día cuánto puedes gastar', 'Ves crecer tu dinero mes a mes'];

const AuthLayout = ({ title, subtitle, alt, children, footer }) => (
  <div className="min-h-screen bg-[#0f1220] text-white font-Inter flex flex-col">
    <header className="max-w-5xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
      <a href="/" className="flex items-center gap-2 font-bold text-lg">
        <img src="/T1.svg" alt="" width="32" height="32" className="w-8 h-8" />
        Topi
      </a>
      {alt && (
        <a href={alt.href} className="text-sm font-semibold px-4 py-2 rounded-xl bg-white text-gray-900 hover:bg-gray-100">{alt.label}</a>
      )}
    </header>

    <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 lg:py-14 grid gap-10 lg:grid-cols-2 lg:items-center">
      <section className="hidden lg:block" aria-label="Qué hace Topi">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-sm font-semibold text-topi-200">
          <span className="w-2 h-2 rounded-full bg-topi-500" aria-hidden="true" />{BETA_LABEL}
        </span>
        <p className="mt-5 text-5xl font-extrabold tracking-tight leading-[1.05]">
          Saber cuánto puedes gastar.<br />
          <span className="text-[#5b6078]">Sin anotar</span> <span className="text-[#7ee2b8]">nada.</span>
        </p>
        <ul className="mt-8 flex flex-col gap-3 text-gray-300">
          {PROMISES.map((p) => (
            <li key={p} className="flex items-center gap-3">
              <span className="w-6 h-6 shrink-0 rounded-full bg-topi-500/20 text-topi-200 flex items-center justify-center"><CheckIcon className="w-4 h-4" aria-hidden="true" /></span>
              {p}
            </li>
          ))}
        </ul>
        <FoundersNote className="mt-8" />
      </section>

      <div className="w-full max-w-md mx-auto lg:mr-0">
        <div className="rounded-3xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-2xl p-6 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-gray-400">{footer}</div>}
      </div>
    </main>
  </div>
);

export default AuthLayout;
