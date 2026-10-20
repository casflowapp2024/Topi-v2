import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import store from './store';
import { setupAuthInterceptor } from './lib/authInterceptor';

// renueva la sesión con el refresh token ante un 401
setupAuthInterceptor(store);

const root = ReactDOM.createRoot(document.getElementById('root'));

// Register Service Worker for PWA setup
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

