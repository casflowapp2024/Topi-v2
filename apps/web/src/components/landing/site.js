// Datos públicos de la landing (plan/27 §F, plan/28 dirección B "Un mes"). Sin precios ni planes: todo lo que Topi
// promete hoy existe.

export const SITE_URL = 'https://topi.cash';
export const SUPPORT_EMAIL = 'cashflowapp2024@gmail.com';

// Bancos del catálogo (GET /public/banks): respaldo del prerender y si la API no responde.
export const FALLBACK_BANKS = ['AirTm', 'BBVA', 'Bancolombia', 'Hapi', 'Itaú', 'Lulo Bank', 'Nubank', 'RappiPay', 'ScotiaBank', 'Trii'];

// Respaldo de GET /public/stats para el prerender: cifras ya superadas (dump del 17-oct-2026: 7.485 automáticas de 8.748).
// La API las reemplaza al cargar si son mayores; banks_read en 0 = no se muestra.
export const FALLBACK_STATS = { automated_transactions: 7400, automated_pct: 85, banks_read: 0 };

// Título del hero (plan/28 §13): "Saber" fijo, lo que sabes cambia, "Sin anotar nada." fijo
export const HERO_ROTATING = ['cuánto puedes gastar.', 'si cumples tus presupuestos.', 'cómo crece tu dinero.'];

// D2 (plan/28 §6): beta con cupos, sin hablar de cobros.
export const BETA_LABEL = 'Beta · cupos limitados';

// Hero (plan/28 §9): las preguntas que Topi responde, una por una, con su animación (QuestionsDemo). Montos de
// ejemplo, nunca de una persona.
export const SHOWCASE = [
  { id: 'falta', q: '¿Cuánto te falta por gastar?', a: 'Lo que te queda del mes, antes de pasarte.' },
  { id: 'flujo', q: '¿Cómo va tu flujo del mes?', a: 'Lo que entró, lo que salió y lo que te quedó.' },
  { id: 'presupuestos', q: '¿Estás cumpliendo tus presupuestos?', a: 'De gastos y de ingresos, categoría por categoría.' },
  { id: 'historial', q: '¿En qué se te fue la plata?', a: 'Todo tu historial de movimientos, para buscar cuando quieras.' },
  { id: 'patrimonio', q: '¿Cómo crecen tus balances y tu patrimonio?', a: 'Todas tus cuentas y balances, mes a mes, en un solo lugar.' },
];

// Para qué sirve Topi (plan/28 §9): frases grandes que se llenan al bajar y lo que gana una persona que quiere crecer
export const PURPOSE_LINES = [
  'Para saber, sin anotar nada, a dónde se va tu plata.',
  'Para decidir con los números de hoy, no con los del mes pasado.',
  'Para que ahorrar deje de ser un propósito y se vuelva algo que ves crecer.',
];
export const PURPOSE_INTRO = 'Crecer con tu plata empieza por saber qué pasa con ella. Topi te quita el trabajo de anotar y te deja lo importante: mirar, decidir y avanzar.';

// Lo que te da Topi (plan/28 §11 y §15): dentro de "Para qué sirve Topi", seis resultados con el valor que aportan.
// Sin precios; todo existe hoy en la app.
export const OFFER_STACK = [
  { title: 'Cada movimiento, anotado solo', removes: 'Claridad', text: 'Lo que te avisa tu banco queda en su cuenta y su categoría, al instante, sin que lo escribas.' },
  { title: 'Sabes cuánto puedes gastar hoy', removes: 'Control', text: 'Lo que te queda para el resto del mes y cómo vas a cerrar al ritmo de hoy, antes de pasarte.' },
  { title: 'Presupuestos que se cuadran solos', removes: 'Control', text: 'De gastos y de ingresos, categoría por categoría, con su historia mes a mes.' },
  { title: 'Lo dudoso te lo pregunta', removes: 'Confianza', text: 'Lo que no sabe clasificar lo deja en «Por revisar» para que lo confirmes en un toque. No inventa.' },
  { title: 'Tus tarjetas sin sorpresas', removes: 'Tranquilidad', text: 'Lo que debes por corte y las cuotas que vienen, estimado con tus compras y pagos.' },
  { title: 'Ves crecer tu dinero', removes: 'Crecimiento', text: 'Todas tus cuentas y monedas en tu patrimonio, mes a mes, y qué lo mueve.' },
];

// D9: los primeros 30 son fundadores (plan/22: de por vida, para quienes sigan usando Topi). Sin hablar de planes ni precios.
export const FOUNDERS = {
  title: 'Sé de los primeros 30',
  text: 'Los primeros 30 que conecten su correo serán fundadores de Topi: todo lo que lancemos, de por vida.',
  note: 'Para quienes sigan usando Topi.',
};

export const FAQ = [
  {
    q: '¿Es seguro darle acceso a mi correo?',
    a: 'Topi pide solo permiso de lectura: no puede enviar, borrar ni cambiar nada en tu buzón. Lee únicamente los avisos de los remitentes de tus bancos, no guarda el cuerpo de los correos, no se conecta a tu banco ni te pide sus claves, y lo desconectas en un clic cuando quieras.',
  },
  {
    q: '¿Funciona con mi banco y en mi país?',
    a: 'Sí, si tu banco te avisa por correo cada compra, pago o transferencia. Topi ya conoce los remitentes de los bancos que más hemos probado; para cualquier otro, creas tu banco con el correo desde el que te escribe y Topi lee solo ese remitente.',
  },
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
    q: '¿Y si mi banco no aparece en la lista?',
    a: 'Puedes crearlo tú e indicar el correo desde el que te escribe: Topi leerá solo ese remitente. Mientras aprendemos a leer ese banco, sus movimientos llegan a Por revisar para que los confirmes.',
  },
  {
    q: '¿Y si mi banco solo me avisa por la app o por SMS?',
    a: 'Topi lee correos: activa en tu banco las notificaciones por correo (casi todos lo permiten). Mientras tanto puedes anotar tus movimientos a mano.',
  },
  {
    q: '¿Sirve si tengo cuentas en varias monedas?',
    a: 'Sí. Cada cuenta lleva su moneda (por ejemplo, pesos, dólares o euros) y Topi suma tu patrimonio en tu moneda principal con la tasa del día.',
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
    q: '¿Qué es ser fundador?',
    a: 'Las primeras 30 personas que conecten su correo serán fundadoras de Topi: tendrán de por vida todo lo que lancemos después, mientras sigan usando Topi.',
  },
  {
    q: '¿Por qué dice beta?',
    a: 'Porque estamos abriendo cupos poco a poco, para acompañar bien a cada persona que entra y agregar rápido lo que le falte.',
  },
  {
    q: '¿Cómo desconecto mi correo o borro mi cuenta?',
    a: `Desconecta el correo en un clic desde Ajustes → Conexiones. Para borrar tu cuenta y tus datos, escríbenos a ${SUPPORT_EMAIL}.`,
  },
];
