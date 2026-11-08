import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import store from './store';
import { setupAuthInterceptor, whenRefreshIdle } from './lib/authInterceptor';

// renueva la sesión con el refresh token ante un 401
setupAuthInterceptor(store);

const root = ReactDOM.createRoot(document.getElementById('root'));

// Service worker (PWA). Al activarse una versión nueva toma el control (skipWaiting + claim) y se
// recarga la página una sola vez para que use los bundles nuevos.
if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'production') {
  // En desarrollo no hay PWA: se quitan el SW y sus cachés que hayan quedado de otra corrida.
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(reg => reg.unregister()));
  if (window.caches) window.caches.keys().then(names => names.forEach(name => window.caches.delete(name)));
} else if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    // Tras un deploy, el SW nuevo toma el control justo al abrir la app: el mismo momento en que el
    // token vencido dispara el refresh. Recargar a mitad del POST pierde el refresh token nuevo
    // (la API ya rotó el viejo) y el siguiente intento cierra todas las sesiones por reuso.
    await whenRefreshIdle();
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(err => {
      console.warn('ServiceWorker registration failed: ', err);
    });
  });
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

