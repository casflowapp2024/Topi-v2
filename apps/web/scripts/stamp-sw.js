// Escribe la versión de la caché en build/service-worker.js (corre después de react-scripts build).
// Cada build produce un SW distinto, así que el navegador siempre instala el del último deploy.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'build', 'service-worker.js');
const buildId = process.env.BUILD_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const source = fs.readFileSync(file, 'utf8');
if (!source.includes('__BUILD_ID__')) {
  throw new Error('build/service-worker.js no tiene __BUILD_ID__');
}
fs.writeFileSync(file, source.replace(/__BUILD_ID__/g, buildId));
console.log(`service-worker.js: topi-v2-${buildId}`);
