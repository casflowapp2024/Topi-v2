import { useEffect } from "react";
import Footer from "../components/navigation/Footer";
const PrivacyPolicy = () => {

    const brandName = "Topi";
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <>
            <div className='px-8 font-Inter bg-gradient-to-r from-[#9fa7da] from-0% to-gray-200 to-95% h-min-screen flex justify-center'>
                <div className='max-w-3xl flex flex-col justify-center items-center mt-16'>
                    <h1 className='py-8 w-full text-left text-3xl font-bold text-gray-950 mt-10'>Política de Privacidad</h1>
                    <p className="w-full text-left mt-2 font-bold">Ultima actualización: Julio 7, 2025</p>

                    <p className='text-gray-700 font-semibold mt-4 text-justify'>
                        Esta Política de Privacidad describe cómo {brandName} recopila, utiliza y divulga la información obtenida a través de nuestros sitios web y aplicaciones móviles que enlazan a esta Política de Privacidad, como la aplicación móvil de {brandName} y el sitio web www.topi.cash, así como cualquier otra interacción (por ejemplo, atención al cliente u otras comunicaciones) que usted pueda tener con {brandName} (en conjunto, los “Servicios”).
                    </p>

                    <div>
                        <p className='text-gray-700 mt-4 text-justify'>
                            POR FAVOR, LEA DETENIDAMENTE ESTA POLÍTICA DE PRIVACIDAD PARA ENTENDER CÓMO MANEJAMOS SU INFORMACIÓN. SI NO ESTÁ DE ACUERDO CON ESTA POLÍTICA, LE RECOMENDAMOS NO UTILIZAR LOS SERVICIOS.
                        </p>
                    </div>

                    <p className='w-full text-gray-700 my-4 text-left'>
                        <ul className="flex flex-col gap-2 pl-6 mt-1 text-gray-700">
                            Esta Política de Privacidad incluye las siguientes secciones:
                            <a className="text-blue-700"
                                href="#info-que-recopilamos">1. Información que recopilamos.
                            </a>
                            <a className="text-blue-700"
                                href="#como-usamos-la-info">2. Cómo usamos su información.
                            </a>
                            <a className="text-blue-700"
                                href="#cookies-similares">3. Cookies y tecnologías similares.
                            </a>
                            <a className="text-blue-700"
                                href="#analitica-publicidad">4. Analítica en línea y publicidad.
                            </a>
                            <a className="text-blue-700"
                                href="#compartimos-info">5. Cómo compartimos su información.
                            </a>
                            <a className="text-blue-700"
                                href="#protegemos-info">6. Cómo protegemos su información.
                            </a>
                            <a className="text-blue-700"
                                href="#conservacion-info">7. Conservación de la información.
                            </a>
                            <a className="text-blue-700"
                                href="#enlaces-terceros">8. Enlaces y funcionalidades de terceros.
                            </a>
                            <a className="text-blue-700"
                                href="#privacidad-menores">9. Privacidad de los menores de edad.
                            </a>
                            <a className="text-blue-700"
                                href="#opciones">10. Sus opciones.
                            </a>
                            <a className="text-blue-700"
                                href="#cambio-politicas">11. Cambios a esta Política de Privacidad.
                            </a>
                            <a className="text-blue-700"
                                href="#contacto">12. Información de contacto.
                            </a>

                        </ul>
                    </p>


                    <div >
                        <div className='py-4' id="info-que-recopilamos">
                            <h2 className='text-xl font-semibold mb-2'>1. INFORMACIÓN QUE RECOPILAMOS</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Información que usted proporciona directamente. Recopilamos la información que usted nos proporciona cuando utiliza los Servicios o se comunica con nosotros por cualquier medio. Por ejemplo, recopilamos información cuando usted:
                            </p>
                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Crea una cuenta para usar los Servicios: Podemos recopilar información de contacto y registro, como su nombre y dirección de correo electrónico. También podemos recopilar información de pago, como el número de su tarjeta y los datos de facturación asociados, así como cualquier otra información de perfil que usted cargue en su cuenta.
                                    </li>
                                    <li>Interactúa con los Servicios: Podemos recopilar la información que usted proporciona o carga, incluyendo información financiera como su saldo de cuenta, descripciones de transacciones, intereses de inversión, nombres y montos de presupuestos (“Información Financiera”), información sobre otros usuarios, credenciales para facilitar integraciones con fuentes de datos financieras, y descripciones relacionadas con lo anterior.
                                    </li>
                                    <li>Nos contacta con preguntas, comentarios o solicitudes de atención al cliente: Podemos recopilar su nombre, correo electrónico y cualquier otra información que usted proporcione en su mensaje. También recopilamos cualquier contenido que usted publique en las partes públicas de los Servicios, como foros o comentarios de sugerencias de funciones.
                                    </li>
                                    <li>Participa en promociones, eventos, encuestas o sorteos: Podemos recopilar información básica de contacto y cualquier otra información que usted decida proporcionar en relación con estas actividades.
                                    </li>
                                    <li>Elige integrar los Servicios con otras aplicaciones o funcionalidades de su dispositivo móvil (por ejemplo, sus fotos o contactos): Recopilaremos la información contenida en esas otras aplicaciones o funcionalidades, de acuerdo con la configuración de su dispositivo y de la aplicación.
                                    </li>

                                </ul>
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Información de otras fuentes. También podemos obtener información de otras fuentes, como otros usuarios de los Servicios, proveedores de servicios de pago que nos proporcionen datos de pagos o saldos, proveedores de servicios analíticos y de seguridad que nos ayuden a proteger nuestros sistemas y prevenir fraudes.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Información proporcionada a través de integraciones con fuentes de datos financieras. Recopilamos información cuando usted conecta su cuenta registrada con {brandName} a instituciones financieras u otras fuentes externas de datos (“Fuentes de Datos Financieras”), o cuando nos proporciona acceso directo a esta información. Por ejemplo, usted puede conectar sus cuentas bancarias o de inversión con su cuenta en {brandName}. Para sincronizar esta información, recopilaremos sus datos financieros, como saldo, transacciones y activos. También podemos recopilar credenciales necesarias para facilitar dicha integración, incluyendo claves API requeridas para conectar su cuenta con intercambios de criptomonedas o billeteras. Podemos utilizar servicios de terceros para ayudar a recopilar y sincronizar su información con estas fuentes, y al conectar su cuenta de {brandName} con una Fuente de Datos Financiera, usted acepta los términos y políticas de privacidad aplicables de dichos terceros.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Si accede a los Servicios a través de una conexión o inicio de sesión de un tercero (por ejemplo, “Iniciar sesión con Apple”), es posible que nos autorice a acceder y almacenar cierta información, según la configuración de su cuenta con dicho servicio. Si no desea compartir esta información, puede ajustar sus configuraciones de privacidad en ese servicio o elegir no usar estas conexiones. Por favor, revise las políticas de privacidad de dichos terceros para más información.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Información recopilada automáticamente. Podemos recibir y almacenar automáticamente cierta información sobre el dispositivo o computadora que usted utiliza para acceder a los Servicios. Como se describe más adelante, nosotros y nuestros proveedores podemos usar tecnologías como cookies para ayudar en esta recopilación.
                            </p>
                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>nformación del dispositivo: Recopilamos información técnica relacionada con el(los) dispositivo(s) que usted utiliza para acceder a nuestros Servicios, incluyendo datos sobre su navegador, sistema operativo, dirección IP (la dirección de internet de su equipo), identificadores únicos de dispositivo y el tipo de dispositivo.
                                    </li>
                                    <li>Información de uso: Recopilamos información sobre cómo usted utiliza nuestros Servicios, como páginas, pantallas o funcionalidades que visita, tiempo de permanencia, fecha y hora de acceso, interacción con los Servicios, preferencias de uso, apertura de correos electrónicos y clics en su contenido, registros de errores, entre otros datos similares. Si accede a nuestros Servicios mediante un enlace desde un sitio web de terceros, también podemos recibir datos relacionados con ese clic, como la página web que visitaba antes.
                                    </li>
                                    <li>Información de ubicación: Podemos recopilar la dirección IP de su dispositivo o, con su permiso y de acuerdo con la configuración de su dispositivo, la señal GPS de su dispositivo móvil cuando utilice ciertos Servicios. Esto puede incluir información como ciudad, departamento y código postal.
                                    </li>
                                </ul>
                            </p>

                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="como-usamos-la-info">
                            <h2 className='text-xl font-semibold mb-2'>2. CÓMO UTILIZAMOS SU INFORMACIÓN</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Utilizamos su información de diversas maneras para prestar los Servicios y operar nuestro negocio. En particular, podemos utilizar su información para:
                            </p>
                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Proporcionarle la información y los Servicios que solicita.
                                    </li>
                                    <li>Brindarle un servicio de atención al cliente eficaz.
                                    </li>
                                    <li>Personalizar su experiencia y nuestras comunicaciones con usted.
                                    </li>
                                    <li>Contactarlo con información operativa y notificaciones relacionadas con el uso de los Servicios.
                                    </li>
                                    <li>Enviarle ofertas especiales y otro contenido promocional relacionado con nuestros Servicios que consideramos pueden ser de su interés (de acuerdo con las preferencias de privacidad que nos haya indicado).
                                    </li>
                                    <li>Invitarlo a participar en promociones, sorteos, encuestas y solicitar su retroalimentación.
                                    </li>
                                    <li>Analizar el uso de los Servicios y mejorar el contenido, la funcionalidad y la usabilidad de los mismos.
                                    </li>
                                    <li>Proteger los Servicios, así como investigar y prevenir fraudes, problemas de seguridad o uso indebido.
                                    </li>
                                    <li>Comprender y resolver errores, fallas o interrupciones de la aplicación que se reporten.
                                    </li>
                                    <li>Cumplir con procedimientos legales, leyes y regulaciones, cuando sea necesario para nuestros intereses legítimos o los intereses legítimos de terceros.
                                    </li>
                                    <li>Establecer, ejercer o defender derechos legales, cuando sea necesario para nuestros intereses legítimos o los de terceros, incluyendo la aplicación de nuestros Términos de Servicio, otras políticas de uso o cualquier otra disposición legal aplicable.
                                    </li>
                                    <li>Para cualquier otro propósito con su consentimiento expreso y previo.
                                    </li>

                                </ul>
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Información combinada. Para los fines descritos en esta Política de Privacidad, podemos combinar la información que recopilamos a través de los Servicios con información que recibimos de otras fuentes, tanto en línea como fuera de línea, y utilizar dicha información combinada conforme a esta Política de Privacidad.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Información agregada o anonimizada. Podemos agregar y/o anonimizar cualquier información recopilada a través de los Servicios, de manera que dicha información no pueda asociarse a usted ni a su dispositivo (“Información Agregada/Anonimizada”). Podemos utilizar esta Información Agregada/Anonimizada para cualquier propósito, incluyendo, entre otros, fines de investigación y mercadeo, y también podemos compartir dichos datos con terceros a nuestra entera discreción.
                            </p>


                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="cookies-similares">
                            <h2 className='text-xl font-semibold mb-2'>3. COOKIES Y TECNOLOGÍAS SIMILARES</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Para recopilar la información mencionada en la sección “Información recopilada automáticamente”, tanto nosotros como nuestros proveedores de servicios podemos utilizar registros de servidores web, cookies, etiquetas, SDKs, píxeles de seguimiento y tecnologías de rastreo similares. Utilizamos estas tecnologías con el fin de ofrecerle una experiencia más personalizada en el futuro.
                            </p>
                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Un registro de servidor web es un archivo en el que se almacena la actividad del sitio web.
                                    </li>
                                    <li>Un SDK (Software Development Kit) es un conjunto de herramientas y/o código que incorporamos en nuestras aplicaciones o software para permitir que terceros recopilen información sobre cómo los usuarios interactúan con los Servicios.
                                    </li>
                                    <li>Una cookie es un pequeño archivo de texto que se almacena en su computador o dispositivo móvil cuando utiliza los Servicios. Esto nos permite:
                                        (i) reconocer su dispositivo;
                                        (ii) guardar sus preferencias y configuraciones;
                                        (iii) entender qué páginas de nuestros Servicios ha visitado;
                                        (iv) mejorar su experiencia como usuario mediante la entrega y medición de contenido y publicidad según sus intereses;
                                        (v) realizar análisis y búsquedas; y
                                        (vi) contribuir con funciones de seguridad y administración. Algunas cookies se almacenan en la memoria caché del navegador, mientras que las asociadas con tecnologías Flash pueden almacenarse en archivos del reproductor Adobe Flash.
                                    </li>
                                    <li>Los píxeles de seguimiento (también llamados balizas web o GIFs transparentes) son etiquetas electrónicas diminutas con un identificador único, incrustadas en sitios web, anuncios en línea y/o correos electrónicos, que están diseñadas para:
                                        (1) recopilar información de uso como impresiones o clics en anuncios y tasas de apertura de correos;
                                        (2) medir la popularidad de los Servicios y la publicidad asociada; y
                                        (3) acceder a cookies del usuario.
                                    </li>


                                </ul>
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                A medida que adoptemos nuevas tecnologías, también podríamos recopilar información por otros métodos similares.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                También podemos recopilar, acceder o almacenar cookies de sesión para facilitar integraciones con Fuentes de Datos Financieras.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Tenga en cuenta que usted puede modificar la configuración de su navegador para ser notificado cuando se establezca o actualice una cookie, o para bloquear completamente el uso de cookies. Por favor, consulte la sección de “Ayuda” de su navegador para obtener más información (por ejemplo: Internet Explorer, Google Chrome, Mozilla Firefox o Apple Safari). También puede gestionar el uso de tecnologías Flash, incluyendo cookies Flash y objetos de almacenamiento local, mediante las herramientas de administración disponibles en el sitio web de Adobe.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Tenga en cuenta que si bloquea, desactiva o gestiona alguna o todas las cookies, es posible que no tenga acceso a ciertas funcionalidades o servicios ofrecidos por la plataforma.
                            </p>


                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="analitica-publicidad">
                            <h2 className='text-xl font-semibold mb-2'>4. ANALÍTICA EN LINEA Y PUBLICIDAD</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Podemos utilizar servicios de análisis de terceros (como Google Analytics y Amplitude Analytics) en nuestros Servicios para recopilar y analizar información de uso mediante cookies y tecnologías similares; realizar auditorías, investigaciones o reportes; ayudar en la prevención de fraudes; y ofrecerle ciertas funcionalidades.
                                Si desea evitar que Google Analytics utilice su información con fines analíticos, puede instalar el complemento de inhabilitación para navegadores, disponible <a className="text-blue-600 underline" href="https://tools.google.com/dlpage/gaoptout">aquí.</a>
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Usamos esta información para medir el rendimiento de nuestra publicidad; por ejemplo, para evaluar qué anuncios o contenidos prefieren nuestros usuarios o cuáles son más efectivos. Además, nosotros o nuestros socios publicitarios podemos adaptar la publicidad que recibe en diferentes dispositivos.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Las actividades de estos terceros, y las opciones que usted tiene respecto al uso de su información para personalizar anuncios, están sujetas a sus propias políticas de privacidad. No tenemos acceso ni control sobre las cookies u otras tecnologías de rastreo que puedan ser instaladas en su computador, teléfono móvil u otro dispositivo por proveedores externos no afiliados. Tal como se indica más adelante, algunos de estos proveedores pueden ofrecerle opciones para excluirse de la recopilación de datos utilizados en la publicidad basada en intereses. No garantizamos que estas opciones estén siempre disponibles o que sus instrucciones no cambien, ya que son controladas por cada proveedor externo.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Para optar por no ver publicidad personalizada de Google, visite Configuración de anuncios de Google.
                                Para gestionar sus preferencias en anuncios de Facebook y/o Instagram, visite Configuración de anuncios en Facebook y Configuración de anuncios en Instagram.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Aviso sobre Do Not Track: “Do Not Track” (“DNT”) es una preferencia de privacidad que algunos navegadores web permiten configurar para indicar que el usuario no desea ser rastreado. En {brandName} estamos comprometidos con brindarle opciones significativas respecto a la información recopilada con fines de terceros, por lo cual ofrecemos varios mecanismos de exclusión como los mencionados anteriormente. Sin embargo, debido a la evolución tecnológica y a la falta de un estándar claro en la industria sobre el significado de las señales DNT, actualmente no garantizamos que respondamos a dichas señales.
                            </p>


                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="compartimos-info">
                            <h2 className='text-xl font-semibold mb-2'>5. CÓMO COMPARTIMOS SU INFORMACIÓN</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                No compartimos Información Financiera (ya sea proporcionada por usted manualmente o a través de una integración con una Fuente de Datos Financiera) con:
                                (1) otras empresas para fines de marketing conjunto; ni
                                (2) terceros que deseen utilizarla para promocionarle productos o servicios.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Podemos compartir, transferir o divulgar la información recopilada de usted o sobre usted en las siguientes circunstancias:
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Proveedores de servicios. Podemos compartir información con terceros seleccionados que nos prestan servicios, tales como atención al cliente, integraciones con Fuentes de Datos Financieras, análisis de datos, administración del sitio web, servicios de tecnología de la información y otros servicios similares. Estos terceros solo podrán utilizar la información conforme a nuestras instrucciones y únicamente para prestar los servicios contratados, en cumplimiento con nuestras políticas de privacidad y confidencialidad.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Fuentes de Datos Financieras. Podemos compartir información con las Fuentes de Datos Financieras con el fin de establecer o mantener una integración que usted haya autorizado expresamente. Otros usuarios del Servicio o el público. En la medida en que usted publique contenido en secciones de acceso público de los Servicios (por ejemplo, foros de sugerencias de funciones) o decida hacer visible cierta información de su cuenta a otros usuarios o al público, dicho contenido o información podrá ser leído, recopilado y utilizado por otras personas con permiso de acceso.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Cumplimiento de la ley y protección de derechos. Podemos divulgar su información cuando consideremos que es necesario o apropiado para:
                            </p>


                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Cumplir con leyes aplicables, procesos legales o requerimientos de autoridades públicas o gubernamentales (incluyendo aquellas fuera de su país de residencia).
                                    </li>
                                    <li>Hacer cumplir nuestros Términos de Servicio.
                                    </li>
                                    <li>Proteger los derechos, la privacidad, la seguridad o la propiedad de {brandName}, nuestros afiliados, usted u otras personas.
                                    </li>
                                    <li>Ejercer recursos legales disponibles o limitar los daños que pudiéramos sufrir..
                                    </li>

                                </ul>
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Transacciones corporativas. Nos reservamos el derecho de transferir su información a proveedores, asesores, posibles socios en procesos de fusión o adquisición, u otros terceros en el contexto de negociaciones, fusiones, adquisiciones o transferencias de activos, incluyendo liquidación o venta de la totalidad o una parte de nuestra empresa.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Con su consentimiento o bajo su instrucción. Podemos compartir su información con terceros cuando usted nos lo indique explícitamente o cuando haya otorgado su consentimiento para compartirla adicionalmente (incluyendo lo establecido en esta Política de Privacidad).
                            </p>
                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="protegemos-info">
                            <h2 className='text-xl font-semibold mb-2'>6. CÓMO PROTEGEMOS SU INFORMACIÓN</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                En {brandName}, implementamos diversas medidas de seguridad físicas, técnicas, administrativas y organizacionales diseñadas para proteger su información personal. Sin embargo, ningún método de transmisión por Internet o de almacenamiento electrónico es completamente seguro. Por tanto, no podemos garantizar que su información no pueda ser accedida, divulgada, alterada o destruida en caso de una vulneración de nuestras medidas de seguridad.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Cuando usted crea una cuenta, es posible que se le solicite crear un nombre de usuario y una contraseña. Usted es responsable de mantener la confidencialidad de sus credenciales y de todas las actividades que se realicen desde su cuenta. {brandName} no se hace responsable por pérdidas o daños derivados del uso no autorizado de su cuenta por terceros como consecuencia de la falta de protección de sus datos de acceso.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Le recomendamos tomar medidas de seguridad como:
                            </p>

                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Cambiar su contraseña con frecuencia.
                                    </li>
                                    <li>Utilizar combinaciones seguras de letras, números y símbolos.
                                    </li>
                                    <li>Asegurarse de acceder desde navegadores seguros y dispositivos confiables..
                                    </li>

                                </ul>
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Si sospecha que alguien está utilizando su cuenta sin autorización o si cree que su relación con nosotros ya no es segura, por favor contáctenos de inmediato utilizando los datos indicados en la sección “Información de contacto” más adelante.
                            </p>
                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="conservacion-info">
                            <h2 className='text-xl font-semibold mb-2'>7. CONSERVACIÓN DE LA INFORMACIÓN</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Conservaremos su información durante el tiempo que su cuenta permanezca activa o durante el período necesario para cumplir con nuestras obligaciones legales. También podremos conservar y utilizar su información según sea necesario para:
                            </p>

                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Resolver disputas.
                                    </li>
                                    <li>Proteger a {brandName} y a nuestros usuarios.
                                    </li>
                                    <li>Hacer cumplir nuestros acuerdos y condiciones de uso.
                                    </li>

                                </ul>
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Una vez cumplidas dichas finalidades, la información será eliminada de forma segura o anonimizada, de acuerdo con las políticas de conservación de datos y la normativa aplicable.
                            </p>

                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="enlaces-terceros">
                            <h2 className='text-xl font-semibold mb-2'>8. ENLACES Y FUNCIONALIDADES DE TERCEROS</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Los Servicios pueden contener enlaces, banners, complementos o widgets hacia sitios web, aplicaciones, servicios y funcionalidades de terceros, incluyendo Fuentes de Datos Financieras. También podemos incorporar software de terceros (incluyendo software de código abierto) dentro de nuestros Servicios.
                            </p>


                            <p className='text-gray-700 mb-4 text-justify'>
                                Estos enlaces y funcionalidades se ofrecen únicamente con fines informativos y para su comodidad, y no implican respaldo o asociación alguna por parte de {brandName} con los contenidos, operadores o prácticas de dichos terceros.
                                {brandName} no se hace responsable por las políticas, prácticas o contenido de privacidad de estos terceros.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Cualquier información que usted proporcione directamente a un tercero se regirá por las políticas de privacidad y condiciones de uso de ese tercero, y no por esta Política de Privacidad. Le recomendamos revisar cuidadosamente las políticas de privacidad y seguridad de dichos servicios antes de interactuar con ellos o proporcionarles información personal.
                            </p>

                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="privacidad-menores">
                            <h2 className='text-xl font-semibold mb-2'>9. PRIVACIDAD DE MENORES DE EDAD</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Los Servicios están dirigidos al público en general y no están destinados a menores de 13 años. No recopilamos, almacenamos ni utilizamos de manera consciente información personal de menores de 13 años.
                            </p>


                            <p className='text-gray-700 mb-4 text-justify'>
                                Si usted cree que podríamos haber recopilado información de un menor, por favor contáctenos inmediatamente a través de los datos indicados en la sección “Información de contacto” de esta Política.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                En caso de detectar que hemos recopilado información personal de un menor de 13 años sin el consentimiento adecuado, tomaremos las medidas necesarias para eliminar dicha información de forma inmediata y cerrar la cuenta correspondiente.
                            </p>

                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="opciones">
                            <h2 className='text-xl font-semibold mb-2'>10. SUS OPCIONES</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Comunicaciones de marketing.
                                Usted puede solicitarnos que no utilicemos su información para contactarlo por correo electrónico, correo postal o teléfono con fines de marketing, promoción de productos o servicios, eventos u ofertas especiales, comunicándose con nosotros a través de los datos de contacto que se indican más adelante.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Puede darse de baja de nuestros correos electrónicos promocionales haciendo clic en el enlace de “cancelar suscripción” incluido en dichos correos, o escribiéndonos directamente a: cashflowapp2024@gmail.com con alguna de las siguientes palabras en el asunto del mensaje: “BAJA”, “NO ENVIAR”, “CANCELAR SUSCRIPCIÓN” o “ELIMINAR”.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Tenga en cuenta que el retiro completo de su dirección de nuestras listas de envío puede tardar un tiempo razonable. Asimismo, tenga en cuenta que, sin importar su solicitud, podremos seguir utilizando y compartiendo cierta información de conformidad con esta Política de Privacidad y según lo requiera la ley aplicable.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Por ejemplo, no podrá optar por no recibir mensajes operativos esenciales, tales como los relacionados con la administración de su cuenta, actualizaciones legales, seguridad o notificaciones de transacciones.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Información de la cuenta. Para mantener su información personal actualizada, corregirla, completarla o solicitar su eliminación, puede contactarnos a través de la aplicación o escribirnos a: cashflowapp2024@gmail.com.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Información adicional sobre cookies.
                                Si no desea que el Servicio recopile información mediante cookies, su navegador puede permitirle configurar alertas para ser notificado cuando reciba cookies, así como bloquear o deshabilitar determinadas cookies.
                                Cada navegador es diferente, por lo que le sugerimos consultar la sección de “Ayuda” o “Configuración” de su navegador para conocer cómo cambiar sus preferencias de cookies.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Tenga en cuenta que si desactiva o rechaza cookies, es posible que algunas funcionalidades de los Servicios no se comporten correctamente o no estén disponibles.
                            </p>
                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="cambio-politicas">
                            <h2 className='text-xl font-semibold mb-2'>11. CAMBIOS A ESTA POLÍTICA DE PRIVACIDAD</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Nos reservamos el derecho de actualizar o modificar esta Política de Privacidad en cualquier momento, con el fin de reflejar:
                            </p>

                            <p className='w-full text-gray-700 my-4 text-left'>
                                <ul className="flex list-disc flex-col gap-2 pl-6 mt-1 text-gray-700">
                                    <li>Cambios en la legislación aplicable.
                                    </li>
                                    <li>Cambios en nuestras prácticas de recolección o uso de datos.
                                    </li>
                                    <li>La incorporación de nuevas funcionalidades en nuestros Servicios.
                                    </li>
                                    <li>Avances tecnológicos relevantes que impacten el tratamiento de datos personales.
                                    </li>

                                </ul>
                            </p>


                            <p className='text-gray-700 mb-4 text-justify'>
                                Publicaremos cualquier versión actualizada de esta Política de Privacidad a través de nuestros Servicios, por lo cual le recomendamos revisarla periódicamente.
                                Puede saber si esta Política ha cambiado desde la última vez que la revisó verificando la fecha de “Última Actualización” que aparece al inicio del documento.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                Si realizamos modificaciones sustanciales a esta Política, le notificaremos conforme lo exija la ley aplicable, a través de medios electrónicos o mediante avisos visibles dentro de nuestros Servicios.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                El uso continuo de los Servicios después de que se publiquen dichas actualizaciones implica que usted acepta que toda la información recopilada a partir de ese momento estará sujeta a los términos de la nueva Política de Privacidad.
                            </p>
                            <div className="h-8"></div>
                        </div>

                        <div className='py-4' id="contacto">
                            <h2 className='text-xl font-semibold mb-2'>12. INFORMACIÓN DE CONTACTO</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                Si tiene preguntas, comentarios o inquietudes sobre esta Política de Privacidad o sobre nuestras prácticas de tratamiento de datos personales, puede ponerse en contacto con nosotros en: cashflowapp2024@gmail.com.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                También podrá ejercer sus derechos como titular de datos personales (acceso, rectificación, cancelación, oposición o supresión) escribiéndonos a dicho correo, de conformidad con lo dispuesto en la Ley 1581 de 2012 y demás normas aplicables en Colombia y la región.
                            </p>

                            <div className="h-8"></div>
                        </div>




                    </div>



                </div>
            </div>
            <Footer />
        </>

    )
}



export default PrivacyPolicy




