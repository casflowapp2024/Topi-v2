// Página pública (plan/27 §F; plan/28: propuesta de valor, "Topi te dice" y "Para qué sirve Topi" con la oferta): qué
// lee y qué no, sin riesgo, bancos, preguntas; sin precios, planes, aportes ni cifrado; mensaje global.
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import LandingPage from './LandingPage';
import { BankChecker } from './Offer';
import {
  FALLBACK_BANKS, FALLBACK_STATS, SHOWCASE, PURPOSE_LINES, OFFER_STACK, FOUNDERS, FAQ,
} from './site';
import PrivacyPolicy from '../../containers/PrivacyPolicy';

global.IS_REACT_ACT_ENVIRONMENT = true;

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
// el texto sin la vitrina del hero
const withoutDemo = (html) => html.replace(/data-demo="preguntas"[\s\S]*?(?=<section aria-label="Topi en cifras")/, '>');

const mount = async (el) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(el); });
  return { container, root };
};
const typeIn = async (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
};

test('la landing tiene la propuesta de valor, la oferta, qué lee y qué no, sin riesgo, bancos y preguntas', () => {
  const html = renderToString(<LandingPage banks={['Bancolombia', 'Nubank']} year={2026} />);
  const t = text(html);
  ['para-que', 'como-funciona', 'que-lee', 'sin-riesgo', 'bancos', 'preguntas']
    .forEach((id) => expect(html).toContain(`id="${id}"`));
  expect(t).toContain('Saber cuánto puedes gastar, si cumples tus presupuestos y cómo crece tu dinero. Sin anotar nada.');
  expect(t).toContain('Con Topi es posible.');
  expect(t).not.toContain('Qué lee y qué no ');
  expect(html).not.toContain('href="#bancos"');
  expect(t).toContain('Beta · cupos limitados');
  expect(t).toContain('No guarda el cuerpo de tus correos');
  expect(t).toContain('No se conecta a tu banco');
  expect(t).toContain('Desconecta en un clic');
  expect(t).toContain('Bancolombia');
  expect(t).toContain('Configuración avanzada');
  expect(html).toContain('href="/privacy-policy/"');
  expect(html).toContain('href="/create_account/"');
});

test('"Topi te dice": las preguntas son botones; el prerender trae la primera elegida y un esqueleto, sin la app', () => {
  const html = renderToString(<LandingPage />);
  const t = text(html);
  expect(html).toContain('data-demo="preguntas"');
  expect(t).toContain('Topi te dice');
  SHOWCASE.forEach(({ q }) => expect(t).toContain(q));
  expect(html.match(/<button type="button" aria-pressed="(true|false)"/g)).toHaveLength(SHOWCASE.length);
  expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  expect(html).toContain('id="qd-stage"');
  // los componentes reales (con Redux, recharts y moment) no van en el HTML prerenderizado
  expect(t).not.toMatch(/Ritmo del mes|Flujo del mes|Patrimonio · hoy|Recibido este mes/);
});

test('"Para qué sirve Topi" dice el valor para una persona que quiere crecer, después de "Cómo funciona"', () => {
  const html = renderToString(<LandingPage />);
  const t = text(html);
  expect(html.indexOf('id="como-funciona"')).toBeLessThan(html.indexOf('id="para-que"'));
  expect(t).not.toMatch(/últimos dígitos/);
  expect(t).toContain('Para qué sirve Topi');
  PURPOSE_LINES.forEach((line) => expect(t).toContain(line));
  OFFER_STACK.forEach(({ title }) => expect(t).toContain(title));
  expect(t).not.toContain('De dónde salió Topi');
});

test('una sola sección de valor, menú sin enlaces de secciones, fundadores y la objeción de seguridad primero', () => {
  const html = renderToString(<LandingPage />);
  const t = text(html);
  const nav = html.slice(html.indexOf('aria-label="Principal"'), html.indexOf('</nav>'));
  expect(nav).not.toMatch(/href="#/); // el menú solo lleva a entrar o crear cuenta
  expect(html).not.toContain('id="comparacion"');
  expect(html).not.toContain('id="oferta"');
  expect(t.match(/Lo dudoso te lo pregunta/g)).toHaveLength(1);
  expect(t).toContain(FOUNDERS.text);
  expect(t).toContain('Quiero mi mes en automático');
  expect(FAQ[0].q).toBe('¿Es seguro darle acceso a mi correo?');
  expect(FAQ.some((f) => f.q === '¿Qué es ser fundador?')).toBe(true);
});

test('"¿Topi lee mi banco?" encuentra el banco sin tildes ni mayúsculas, y si no está explica cómo agregarlo', async () => {
  const { container, root } = await mount(<BankChecker banks={['Bancolombia', 'Itaú', 'Nubank']} />);
  const input = container.querySelector('input');
  await typeIn(input, 'itau');
  expect(container.textContent).toContain('Sí, Itaú ya está probado.');
  await typeIn(input, 'Banco de Bogotá');
  expect(container.textContent).toContain('También lo puede leer.');
  expect(container.textContent).toContain('campo «De»');
  act(() => root.unmount());
});

test('mensaje global: cualquier banco que avise por correo, sin "para Colombia" ni testimonios', () => {
  const t = text(renderToString(<LandingPage />));
  expect(t).toContain('Para cualquier banco que te avise por correo');
  expect(t).toContain('Pega el correo desde el que te escribe');
  expect(t).not.toMatch(/para Colombia|digitar[^ ]/i);
  expect(t.match(/Colombia/g) || []).toHaveLength(1); // solo "Hecho en Colombia" en el pie
  expect(t).not.toMatch(/testimoni|cliente feliz|★/i);
});

test('cifras reales: las de la API y, sin ellas, las del prerender; un 0 no se muestra', () => {
  const t = text(renderToString(<LandingPage stats={{ automated_transactions: 12000, automated_pct: 87, banks_read: 14 }} />));
  expect(t).toContain('movimientos anotados solos en Topi 12.000+');
  expect(t).toContain('87 %');
  expect(t).toContain('bancos leídos 14');
  const fallback = text(renderToString(<LandingPage />));
  expect(fallback).toContain(`${FALLBACK_STATS.automated_transactions.toLocaleString('es-CO')}+`);
  expect(fallback).not.toContain('bancos leídos');
});

test('sin Plus, precios ni Apoyar a Topi (los fundadores sí, sin hablar de planes)', () => {
  const html = renderToString(<LandingPage banks={FALLBACK_BANKS} />);
  const outside = text(withoutDemo(html));
  const banned = /\bPlus\b|\$\s?\d|€|COP|precio|suscrip|Apoyar|aporte|gratis|cobr|costo|mensualidad/i;
  expect(outside.match(banned)?.[0]).toBeUndefined();
  expect(outside).toContain('Para qué sirve Topi'); // el recorte solo quitó la vitrina
});

test('no promete cifrado de los permisos (hoy no están cifrados en la base)', () => {
  const t = text(renderToString(<LandingPage />));
  expect(t).not.toMatch(/cifrad|encript/i);
});

test('la Política de privacidad declara el Uso limitado y la huella de las cuentas de Gmail', () => {
  const html = renderToString(<PrivacyPolicy />);
  const t = text(html);
  expect(t).toContain('gmail.readonly');
  expect(t).toContain('Uso limitado');
  expect(html).toContain('https://developers.google.com/terms/api-services-user-data-policy');
  expect(t).toContain('No guarda el cuerpo de los correos');
  expect(t).toContain('No los usamos para publicidad');
  expect(t).toContain('huella (hash)');
  expect(t).not.toMatch(/Amplitude|Flash|Mercado Pago|Plus/);
});
