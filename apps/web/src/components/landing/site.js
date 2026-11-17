// Datos públicos de la landing (plan/27 §F). Sin precios ni planes: todo lo que Topi promete hoy.

export const SITE_URL = 'https://topi.cash';
export const SUPPORT_EMAIL = 'cashflowapp2024@gmail.com';

// Mismos bancos que enums.OfficialBanks de la API (GET /public/banks). Respaldo del prerender y si la API no responde.
export const FALLBACK_BANKS = ['AirTm', 'BBVA', 'Bancolombia', 'Hapi', 'Itaú', 'Lulo Bank', 'Nubank', 'RappiPay', 'ScotiaBank', 'Trii'];

export const FAQ = [
  {
    q: '¿Topi puede mover mi dinero o entrar a mi banco?',
    a: 'No. Topi no se conecta a tu banco ni te pide sus claves. Solo lee las notificaciones que tu banco ya te envía por correo, con un permiso de solo lectura.',
  },
  {
    q: '¿Qué correos lee?',
    a: 'Solo los que te envían los remitentes de tus bancos (por ejemplo, las alertas de compra). Tus demás correos no se piden ni se abren. De cada notificación toma el monto, el comercio, la fecha y la cuenta, y no guarda el correo.',
  },
  {
    q: '¿Puede enviar o borrar correos?',
    a: 'No. El permiso es de solo lectura: Topi no puede enviar, borrar ni cambiar nada en tu buzón.',
  },
  {
    q: 'Google me dice que la app no está verificada, ¿qué hago?',
    a: 'Google está revisando Topi. Mientras tanto muestra ese aviso: toca «Configuración avanzada» y luego «Ir a Topi». Puedes revisar y quitar el permiso cuando quieras desde tu cuenta de Google o desde Topi.',
  },
  {
    q: '¿Funciona con Outlook o Hotmail?',
    a: 'Sí. Topi lee Gmail y Outlook (incluye Hotmail y Live).',
  },
  {
    q: '¿Y si mi banco no aparece en la lista?',
    a: 'Puedes crearlo tú e indicar el correo desde el que te escribe: Topi leerá solo ese remitente. Mientras aprendemos a leer ese banco, sus movimientos llegan a Por revisar para que los confirmes.',
  },
  {
    q: '¿Cómo desconecto mi correo o borro mi cuenta?',
    a: `Desconecta el correo en un clic desde Ajustes → Conexiones. Para borrar tu cuenta y tus datos, escríbenos a ${SUPPORT_EMAIL}.`,
  },
];
