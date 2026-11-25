import { useMemo, useState } from 'react';
import { CheckIcon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/20/solid';
import { FOUNDERS, OFFER_STACK } from './site';

/**
 * Oferta "Tu mes en automático" (plan/28 §11). Piezas puras (sin redux ni router) para la landing prerenderizada:
 * la pila de valor, el buscador "¿Topi lee mi banco?" y los fundadores. Sin precios.
 */

export const OfferStack = () => (
  <ul className="grid gap-3 sm:grid-cols-2">
    {OFFER_STACK.map(({ title, removes, text }) => (
      <li key={title} className="lp-reveal flex gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-topi-500 text-white flex items-center justify-center">
          <CheckIcon className="w-4 h-4" aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-money-in dark:text-money-in-dark">{removes}</p>
          <p className="mt-1.5 text-gray-700 dark:text-gray-300">{text}</p>
        </div>
      </li>
    ))}
  </ul>
);

const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// "¿Topi lee mi banco?": busca en el catálogo (GET /public/banks); si no está, explica cómo agregarlo
export const BankChecker = ({ banks }) => {
  const [query, setQuery] = useState('');
  const q = normalize(query);
  const match = useMemo(() => (q.length < 2 ? null : banks.find((b) => normalize(b).includes(q) || q.includes(normalize(b)))), [banks, q]);
  return (
    <div className="lp-reveal rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6">
      <label htmlFor="lp-banco" className="text-lg font-semibold text-gray-900 dark:text-white">¿Topi lee mi banco?</label>
      <div className="mt-3 relative">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input id="lp-banco" type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Escribe el nombre de tu banco"
          autoComplete="off" className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-topi-500" />
      </div>
      <p aria-live="polite" className="mt-3 min-h-[3rem] text-sm text-gray-700 dark:text-gray-300">
        {q.length < 2 ? 'Escribe al menos dos letras.'
          : match ? <><b className="text-money-in dark:text-money-in-dark">Sí, {match} ya está probado.</b> Lo eliges y Topi ya sabe de qué correos vienen sus avisos.</>
            : <><b className="text-gray-900 dark:text-white">También lo puede leer.</b> Creas tu banco con el correo desde el que te escribe (el campo «De» de un aviso) y Topi lee solo ese remitente.</>}
      </p>
    </div>
  );
};

export const FoundersNote = ({ className = '' }) => (
  <p className={`inline-flex items-start gap-2 rounded-2xl border border-[#7ee2b8]/30 bg-[#7ee2b8]/10 px-4 py-3 text-sm text-gray-200 ${className}`}>
    <SparklesIcon className="w-4 h-4 mt-0.5 shrink-0 text-[#7ee2b8]" aria-hidden="true" />
    <span><b className="text-white">{FOUNDERS.title}.</b> {FOUNDERS.text} <span className="text-gray-400">{FOUNDERS.note}</span></span>
  </p>
);
