import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SHOWCASE } from './site';

/**
 * Hero (plan/28 §9–§10): las preguntas que Topi responde, cada una con el componente REAL de la app que la responde
 * (demo/DemoScenes, con datos de ejemplo). Cambia sola cada STEP segundos; tocar una pregunta la muestra y reinicia el
 * tiempo; con el puntero o el foco encima se pausa; con prefers-reduced-motion no avanza sola.
 *
 * Los componentes reales traen Redux, recharts y moment: van en un trozo aparte que se descarga cuando la vitrina
 * entra en pantalla. En el HTML prerenderizado (y mientras carga) se ve un esqueleto del mismo tamaño: sin saltos.
 * Cada escena se centra en la caja y, si no cabe, se reduce lo justo (Fit en DemoScenes).
 */

export const STEP = 6; // segundos por pregunta

const DemoScenes = lazy(() => import('./demo/DemoScenes'));

const Skeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-3 animate-pulse">
    <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="h-8 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
    <div className="h-40 w-full rounded-2xl bg-gray-200 dark:bg-gray-700" />
  </div>
);

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

const QuestionsDemo = () => {
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0); // cambia con cada selección: reinicia el temporizador y la barra
  const [paused, setPaused] = useState(false);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const stage = useRef(null);

  // Los componentes reales (recharts, moment) se descargan cuando la vitrina está en pantalla Y la persona ya
  // interactuó (mueve el puntero, toca, hace scroll o usa el teclado): la primera carga de la página no los paga.
  useEffect(() => {
    setAuto(!reducedMotion());
    const el = stage.current;
    let inView = false;
    let touched = false;
    const go = () => { if (inView && touched) { setVisible(true); cleanup(); } };
    const onTouch = () => { touched = true; go(); };
    const events = ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onTouch, { passive: true }));
    const io = typeof IntersectionObserver !== 'undefined' && el
      ? new IntersectionObserver((entries) => { inView = entries.some((e) => e.isIntersecting); go(); })
      : null;
    if (io) io.observe(el); else inView = true;
    function cleanup() {
      events.forEach((e) => window.removeEventListener(e, onTouch));
      if (io) io.disconnect();
    }
    return cleanup;
  }, []);

  useEffect(() => {
    if (!auto || paused || !visible) return undefined;
    const t = setTimeout(() => setActive((i) => (i + 1) % SHOWCASE.length), STEP * 1000);
    return () => clearTimeout(t);
  }, [active, run, paused, auto, visible]);

  const choose = (i) => { setActive(i); setRun((r) => r + 1); };
  const pause = { onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false), onFocus: () => setPaused(true), onBlur: () => setPaused(false) };
  const current = SHOWCASE[active];
  const barState = paused || !auto || !visible ? 'qd-paused' : '';

  return (
    <div data-demo="preguntas" className="qd mt-12 sm:mt-16 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:items-stretch [&>*]:min-w-0" {...pause}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8d92ab] mb-3">Topi te dice</p>
        {/* en móvil: una fila de preguntas que se desliza; en PC: la lista */}
        <ul className="flex lg:flex-col gap-2 lg:gap-1 overflow-x-auto lg:overflow-visible -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 snap-x hide-scrollbar bg-[#0f1220]">
          {SHOWCASE.map(({ id, q, a }, i) => {
            const on = i === active;
            return (
              <li key={id} className="snap-start shrink-0 lg:shrink">
                <button type="button" onClick={() => choose(i)} aria-pressed={on} aria-controls="qd-stage"
                  className={`relative w-[15rem] lg:w-full h-full text-left rounded-xl px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 ${on ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'}`}>
                  <span className={`block font-semibold ${on ? 'text-white' : 'text-gray-400'}`}>{q}</span>
                  <span className={`block text-sm ${on ? 'text-[#a9aecb]' : 'text-[#8d92ab]'}`}>{a}</span>
                  {on && (
                    <span aria-hidden="true" className="absolute left-4 right-4 bottom-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                      <span key={`${active}-${run}`} className={`qd-progress block h-full w-full bg-topi-500 ${barState}`} style={{ animationDuration: `${STEP}s` }} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div id="qd-stage" ref={stage} aria-live="polite"
        className="relative rounded-3xl border border-[#262b45] bg-gray-100 dark:bg-[#0B0F19] p-3 sm:p-5 h-[520px] sm:h-[480px] lg:h-auto lg:min-h-[420px] overflow-hidden">
        <p className="sr-only">{current.q} {current.a}</p>
        <div className="relative h-full overflow-hidden">
          {visible ? (
            <Suspense fallback={<Skeleton />}>
              <div key={`${current.id}-${run}`} aria-hidden="true" className="h-full">
                <DemoScenes id={current.id} />
              </div>
            </Suspense>
          ) : <Skeleton />}
        </div>
      </div>
    </div>
  );
};

export default QuestionsDemo;
