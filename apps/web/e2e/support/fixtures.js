// `guard`: falla el test si hubo errores de consola, excepciones o respuestas 4xx/5xx de la app o
// de la API. Los casos esperados se declaran con guard.allow(status, urlPart).
const base = require('@playwright/test');

const API_URL = process.env.API_URL || 'http://localhost:8080';
const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const OWN = [API_URL, WEB_URL];

const test = base.test.extend({
  guard: [async ({ page }, use, testInfo) => {
    const problems = [];
    const allowed = [];
    const isAllowed = (status, url) => allowed.some(a => a.status === status && url.includes(a.urlPart));

    page.on('response', r => {
      const url = r.url();
      if (r.status() >= 400 && OWN.some(o => url.startsWith(o)) && !isAllowed(r.status(), url)) {
        problems.push(`HTTP ${r.status()} ${r.request().method()} ${url}`);
      }
    });
    page.on('console', m => {
      if (m.type() !== 'error') return;
      // el navegador registra cada respuesta >= 400 como error de consola: ya se evalúan arriba
      const src = m.location().url || '';
      const failed = m.text().match(/Failed to load resource: the server responded with a status of (\d+)/);
      if (failed) {
        const status = Number(failed[1]);
        if (isAllowed(status, src) || status < 400) return;
      }
      problems.push(`console.error ${m.text().slice(0, 300)} (${src})`);
    });
    page.on('pageerror', e => problems.push(`pageerror ${e.message.slice(0, 300)}`));

    const guard = {
      allow: (status, urlPart) => allowed.push({ status, urlPart }),
      problems,
    };
    await use(guard);
    if (problems.length) {
      await testInfo.attach('problemas', { body: problems.join('\n'), contentType: 'text/plain' });
    }
    base.expect(problems, 'errores de consola / respuestas 4xx-5xx').toEqual([]);
  }, { auto: true }],
});

module.exports = { test, expect: base.expect, API_URL, WEB_URL };
