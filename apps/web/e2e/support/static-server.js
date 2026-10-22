// Servidor estático con las mismas reglas que nginx.conf (fallback SPA, /static sin fallback,
// no-cache en index.html/SW/manifest). Se puede cambiar el directorio servido en caliente para
// simular un deploy sobre el mismo origen.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.map': 'application/json',
};
const NO_CACHE = new Set(['/index.html', '/service-worker.js', '/manifest.json']);

function startStaticServer(root, port) {
  let current = path.resolve(root);
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(current, pathname);
    let served = pathname;
    const exists = file.startsWith(current) && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists) {
      if (pathname.startsWith('/static/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('not found');
      }
      file = path.join(current, 'index.html');
      served = '/index.html';
    }
    const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
    if (NO_CACHE.has(served)) headers['Cache-Control'] = 'no-cache';
    else if (served.startsWith('/static/')) headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => resolve({
      url: `http://localhost:${port}`,
      setRoot: dir => { current = path.resolve(dir); },
      close: () => new Promise(r => { server.close(r); server.closeAllConnections(); }),
    }));
  });
}

module.exports = { startStaticServer };
