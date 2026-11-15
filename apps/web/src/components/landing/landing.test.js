// Página pública (plan/27 §F): qué lee y qué no, bancos, seguridad, preguntas; sin precios, planes ni aportes.
import { renderToString } from 'react-dom/server';
import LandingPage from './LandingPage';
import { FALLBACK_BANKS } from './site';
import PrivacyPolicy from '../../containers/PrivacyPolicy';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('la landing explica qué lee y qué no, con bancos, seguridad y preguntas', () => {
  const html = renderToString(<LandingPage banks={['Bancolombia', 'Nubank']} year={2026} />);
  const t = text(html);
  ['como-funciona', 'que-lee', 'seguridad', 'bancos', 'preguntas'].forEach((id) => expect(html).toContain(`id="${id}"`));
  expect(t).toContain('Tus finanzas al día, sin digitar nada');
  expect(t).toContain('No guarda el cuerpo de tus correos');
  expect(t).toContain('No se conecta a tu banco');
  expect(t).toContain('Bancolombia');
  expect(t).toContain('Configuración avanzada');
  expect(html).toContain('href="/privacy-policy/"');
  expect(html).toContain('href="/create_account/"');
});

test('sin Plus, precios ni Apoyar a Topi', () => {
  const t = text(renderToString(<LandingPage banks={FALLBACK_BANKS} />));
  expect(t).not.toMatch(/\bPlus\b|\$\s?\d|COP|precio|suscrip|Apoyar|aporte|gratis/i);
});

test('no promete cifrado de los permisos (hoy no están cifrados en la base)', () => {
  const t = text(renderToString(<LandingPage />));
  expect(t).not.toMatch(/cifrad|encript/i);
});

test('la Política de privacidad declara el Uso limitado de los datos de Google', () => {
  const html = renderToString(<PrivacyPolicy />);
  const t = text(html);
  expect(t).toContain('gmail.readonly');
  expect(t).toContain('Uso limitado');
  expect(html).toContain('https://developers.google.com/terms/api-services-user-data-policy');
  expect(t).toContain('No guarda el cuerpo de los correos');
  expect(t).toContain('No los usamos para publicidad');
  expect(t).not.toMatch(/Amplitude|Flash|Mercado Pago|Plus/);
});
