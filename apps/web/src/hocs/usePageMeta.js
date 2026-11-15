import { useEffect } from 'react';

const DEFAULT_TITLE = 'Topi · Tus finanzas al día, sin digitar nada';

const setMeta = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el && value) el.setAttribute(attr, value);
};

/**
 * Título y descripción por ruta (SEO básico, plan/27 §F). Al salir de la vista vuelve al título por defecto.
 */
export default function usePageMeta(title, description) {
  useEffect(() => {
    const previous = document.title;
    document.title = title || DEFAULT_TITLE;
    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    return () => { document.title = previous || DEFAULT_TITLE; };
  }, [title, description]);
}
