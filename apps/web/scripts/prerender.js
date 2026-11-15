// Prerender de la landing (plan/27 §F): CRA no hace SSR, así que después de `react-scripts build` se renderiza
// LandingPage con react-dom/server y se escribe dentro de #root de build/index.html. Así el HTML de "/" ya trae el
// contenido (buscadores, verificación de Google, primera pintura rápida en móvil).
//
// build/app.html queda como el index.html sin prerender: nginx lo sirve en las demás rutas de la SPA, para que
// /login o /dashboard no muestren la landing un instante antes de cargar el JS.
const fs = require('fs');
const path = require('path');
const { addHook } = require('sucrase/dist/register');

// solo para este proceso: JSX + imports de ESM (sin dependencias nuevas, sucrase ya viene con CRA)
addHook('.jsx', { transforms: ['imports', 'jsx'], jsxRuntime: 'automatic', production: true });
addHook('.js', { transforms: ['imports'] }, { matcher: (file) => file.includes(`${path.sep}src${path.sep}components${path.sep}landing`) });

const React = require('react');
const { renderToString } = require('react-dom/server');
const LandingPage = require('../src/components/landing/LandingPage.jsx').default;

// BUILD_PATH: el mismo que usa react-scripts build (por defecto build/)
const build = process.env.BUILD_PATH ? path.resolve(process.env.BUILD_PATH) : path.join(__dirname, '..', 'build');
const indexFile = path.join(build, 'index.html');
const appFile = path.join(build, 'app.html');

const shell = fs.readFileSync(indexFile, 'utf8');
if (!shell.includes('<div id="root"></div>')) {
  throw new Error('build/index.html no tiene <div id="root"></div> vacío (¿prerender corrido dos veces?)');
}
fs.writeFileSync(appFile, shell);

const html = renderToString(React.createElement(LandingPage, { year: new Date().getFullYear() }));
// antes de pintar: tema oscuro si el sistema lo pide (solo la landing; la app aplica la preferencia del usuario)
const theme = "<script>try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}</script>";
const out = shell
  .replace('</head>', `${theme}</head>`)
  .replace('<div id="root"></div>', `<div id="root">${html}</div>`);
fs.writeFileSync(indexFile, out);

const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
console.log(`prerender: build/index.html con la landing (${words} palabras); build/app.html para las demás rutas`);
