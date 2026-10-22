import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import store from './store';
import { setupAuthInterceptor } from './lib/authInterceptor';

// renueva la sesión con el refresh token ante un 401
setupAuthInterceptor(store);

const root = ReactDOM.createRoot(document.getElementById('root'));

// Service worker (PWA). Al activarse una versión nueva toma el control (skipWaiting + claim) y se
// recarga la página una sola vez para que use los bundles nuevos.
if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
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

