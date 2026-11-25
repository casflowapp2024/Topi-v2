import { useEffect } from 'react';
import { SiteFooter } from '../components/landing/LandingPage';
import { SITE_URL, SUPPORT_EMAIL } from '../components/landing/site';
import usePageMeta from '../hocs/usePageMeta';

export const PRIVACY_UPDATED = '17 de noviembre de 2026';

const H2 = ({ id, children }) => (
  <h2 id={id} className="scroll-mt-20 mt-10 text-xl font-bold text-gray-900 dark:text-white">{children}</h2>
);
const P = ({ children }) => <p className="mt-3 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>;
const UL = ({ children }) => <ul className="mt-3 flex flex-col gap-2 list-disc pl-6 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</ul>;
const A = ({ href, children }) => <a href={href} className="text-topi-600 dark:text-topi-200 underline">{children}</a>;

const SECTIONS = [
  ['quienes-somos', '1. Quiénes somos'],
  ['datos', '2. Qué datos tratamos'],
  ['google-microsoft', '3. Datos de Gmail y Outlook'],
  ['uso-limitado', '4. Uso limitado de los datos de Google'],
  ['para-que', '5. Para qué usamos tus datos'],
  ['compartimos', '6. Con quién los compartimos'],
  ['seguridad', '7. Cómo los protegemos'],
  ['conservacion', '8. Cuánto tiempo los guardamos'],
  ['correos', '9. Correos que te enviamos'],
  ['derechos', '10. Tus derechos'],
  ['menores', '11. Menores de edad'],
  ['cambios', '12. Cambios y contacto'],
];

/**
 * Política de privacidad (plan/27 §F y §A). Debe decir con exactitud qué se lee de Gmail/Outlook, para qué, que no se
 * guarda el cuerpo de los correos y que se cumple la Google API Services User Data Policy, incluido "Limited Use".
 * Si cambia lo que hace la app (otro proveedor de IA, cobros, analítica), actualizar esta página y la fecha.
 */
const PrivacyPolicy = () => {
  usePageMeta('Política de privacidad · Topi',
    'Qué datos trata Topi, qué lee de tu correo y qué no, con quién los comparte y cómo ejercer tus derechos.');
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 font-Inter">
      <header className="border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
            <img src="/T1.svg" alt="" width="32" height="32" className="w-8 h-8" /> Topi
          </a>
          <a href="/create_account/" className="text-sm font-semibold px-4 py-2 rounded-xl bg-topi-500 hover:bg-topi-600 text-white">Crear cuenta</a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Política de privacidad</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Última actualización: {PRIVACY_UPDATED}</p>
        <P>
          Esta política explica qué datos trata Topi ({SITE_URL}), qué lee de tu correo y qué no, para qué los usa y cómo
          puedes ejercer tus derechos. Resumen: Topi lee solo las notificaciones que te envían tus bancos, no guarda el
          cuerpo de tus correos, no vende tus datos y no muestra anuncios.
        </P>

        <nav aria-label="Contenido" className="mt-6 rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-4">
          <ol className="grid sm:grid-cols-2 gap-1 text-sm">
            {SECTIONS.map(([id, label]) => <li key={id}><A href={`#${id}`}>{label}</A></li>)}
          </ol>
        </nav>

        <H2 id="quienes-somos">1. Quiénes somos</H2>
        <P>
          Topi es una aplicación de finanzas personales hecha en Colombia. Es la responsable del tratamiento de tus datos
          personales en los términos de la Ley 1581 de 2012. Puedes escribirnos a <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A>.
        </P>

        <H2 id="datos">2. Qué datos tratamos</H2>
        <UL>
          <li><strong>Tu cuenta:</strong> nombre, correo y contraseña (guardada solo como un hash; nunca en texto).</li>
          <li><strong>Tus finanzas en Topi:</strong> cuentas, categorías, presupuestos y movimientos (monto, fecha, comercio o descripción, cuenta y categoría), los que registras tú y los que Topi extrae de las notificaciones de tus bancos.</li>
          <li><strong>Tus conexiones de correo:</strong> la dirección conectada, el proveedor (Google o Microsoft) y el permiso de acceso que nos das (ver sección 3).</li>
          <li><strong>Uso de la app:</strong> los días en que la usas y algunos eventos (por ejemplo, que corregiste la categoría de un movimiento leído), sin montos, comercios ni textos; y cuántos tokens consume la lectura automática.</li>
          <li><strong>Lo que nos escribas:</strong> opiniones desde «¿Qué le falta a Topi?» y mensajes de soporte. Te pedimos no incluir datos bancarios.</li>
        </UL>

        <H2 id="google-microsoft">3. Datos de Gmail y Outlook</H2>
        <P>
          Para anotar tus movimientos sin que los digites, Topi te pide conectar el correo donde te llegan las
          notificaciones de tu banco. Pedimos el permiso de <strong>solo lectura</strong>:
          en Google, <code className="break-all">https://www.googleapis.com/auth/gmail.readonly</code>; en Microsoft, <code>Mail.Read</code> y
          <code> offline_access</code> (para leer sin que abras la app). Con ese permiso Topi:
        </P>
        <UL>
          <li><strong>Busca solo los correos de los remitentes de tus bancos</strong>: los que Topi ya conoce o el que tú le indicas como el correo de tu banco (por ejemplo, las alertas de compra). No pide, abre ni lista tus demás correos.</li>
          <li>De cada notificación extrae el monto, la fecha, el comercio o descripción y la cuenta, y crea el movimiento en tu cuenta de Topi. Para hacerlo, el texto de esa notificación se procesa con la API de Gemini de Google, solo para extraer el movimiento.</li>
          <li><strong>No guarda el cuerpo de los correos.</strong> Guarda el movimiento extraído y un identificador del mensaje para no leerlo dos veces.</li>
          <li>No puede enviar, borrar ni modificar correos, y no se conecta a tu banco ni puede mover tu dinero.</li>
        </UL>
        <P>
          Pedimos <code>gmail.readonly</code> porque Google no ofrece un permiso menor que permita leer el contenido de
          las notificaciones de un remitente. El permiso de acceso se guarda solo en nuestro servidor; nunca llega a tu
          navegador. Puedes quitarlo cuando quieras desde Ajustes → Conexiones en Topi (al desconectar borramos el
          permiso guardado) o desde <A href="https://myaccount.google.com/permissions">los permisos de tu cuenta de Google</A> o
          de <A href="https://account.live.com/consent/Manage">tu cuenta de Microsoft</A>.
        </P>

        <H2 id="uso-limitado">4. Uso limitado de los datos de Google</H2>
        <P>
          El uso y la transferencia a cualquier otra aplicación de la información recibida de las API de Google por parte
          de Topi se ajustan a la{' '}
          <A href="https://developers.google.com/terms/api-services-user-data-policy">Política de datos de usuario de los servicios de API de Google</A>,
          incluidos los requisitos de Uso limitado (Limited Use). En particular:
        </P>
        <UL>
          <li>Usamos los datos de Gmail solo para darte la función que ves en Topi: registrar los movimientos que te notifican tus bancos.</li>
          <li>No los transferimos a terceros, salvo lo necesario para prestar esa función (la extracción con la API de Gemini), para cumplir la ley o como parte de una fusión o adquisición con aviso previo.</li>
          <li>No los usamos para publicidad, ni los vendemos, ni los usamos para evaluar tu crédito.</li>
          <li>No los usamos para entrenar modelos de inteligencia artificial generales.</li>
          <li>Ninguna persona los lee, salvo que nos des tu consentimiento explícito (por ejemplo, para resolver un problema de soporte), por seguridad o abuso, por obligación legal, o de forma agregada y anónima para operar el servicio.</li>
        </UL>

        <H2 id="para-que">5. Para qué usamos tus datos</H2>
        <UL>
          <li>Darte el servicio: leer tus notificaciones bancarias, mostrar tus finanzas, presupuestos y avisos.</li>
          <li>Avisarte cuando algo deja de funcionar (por ejemplo, si Topi dejó de poder leer tu correo).</li>
          <li>Mejorar Topi con métricas agregadas de uso. Los nombres de categorías o bancos solo se ven en conjunto cuando los usan cinco o más personas, y cada consulta del equipo queda registrada.</li>
          <li>Seguridad: prevenir abusos y proteger tu cuenta.</li>
        </UL>

        <H2 id="compartimos">6. Con quién los compartimos</H2>
        <P>No vendemos tus datos. Solo los tratan, por encargo nuestro y para prestar el servicio:</P>
        <UL>
          <li><strong>Hetzner</strong> (servidores y base de datos).</li>
          <li><strong>Google</strong> (API de Gemini, para extraer el movimiento de cada notificación bancaria; y, si está activa, Google Analytics para medir visitas de forma agregada).</li>
          <li><strong>Resend</strong> (envío de los correos de Topi a tu dirección).</li>
        </UL>
        <P>También podemos compartir datos si la ley o una autoridad competente lo exige.</P>

        <H2 id="seguridad">7. Cómo los protegemos</H2>
        <UL>
          <li>Conexiones cifradas (HTTPS) entre tu navegador, nuestro servidor y los proveedores.</li>
          <li>Contraseñas guardadas con un hash (argon2id) y códigos de acceso de un solo uso que vencen.</li>
          <li>Los permisos de tu correo se quedan en el servidor y solo los usa el proceso que lee tus notificaciones.</li>
          <li>El acceso del equipo a la información está restringido y queda registrado.</li>
        </UL>

        <H2 id="conservacion">8. Cuánto tiempo los guardamos</H2>
        <P>
          Guardamos los datos de tu cuenta mientras la tengas. Los eventos de uso se guardan hasta 13 meses. Si pides eliminar tu cuenta,
          borramos tus datos, salvo lo que la ley nos obligue a conservar. Mientras Google revisa Topi, de cada cuenta de
          Gmail que se conecta guardamos una huella (hash) de la dirección, no la dirección, también después de
          desconectarla: la usamos solo para contar los cupos que Google nos asigna.
        </P>

        <H2 id="correos">9. Correos que te enviamos</H2>
        <UL>
          <li>Los que pides o necesitas: códigos para entrar o recuperar tu contraseña.</li>
          <li>Avisos de tus conexiones (por ejemplo, que Topi dejó de leer tu correo o que aún no vemos movimientos de tu banco).</li>
          <li>El resumen del mes, solo si lo activas.</li>
          <li>De vez en cuando, un correo personal del equipo para preguntarte cómo te va con Topi.</li>
        </UL>
        <P>Todos, salvo los códigos, traen un enlace para dejar de recibirlos.</P>

        <H2 id="derechos">10. Tus derechos</H2>
        <P>
          Puedes conocer, actualizar, rectificar y suprimir tus datos, revocar la autorización y presentar quejas ante la
          Superintendencia de Industria y Comercio (Ley 1581 de 2012). Escríbenos a{' '}
          <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A> y te respondemos en los plazos de la ley.
        </P>

        <H2 id="menores">11. Menores de edad</H2>
        <P>Topi no está dirigido a menores de 18 años.</P>

        <H2 id="cambios">12. Cambios y contacto</H2>
        <P>
          Si cambiamos esta política te lo diremos en la app o por correo antes de que el cambio aplique. Preguntas:{' '}
          <A href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</A>.
        </P>
      </main>
      <SiteFooter />
    </div>
  );
};

export default PrivacyPolicy;
