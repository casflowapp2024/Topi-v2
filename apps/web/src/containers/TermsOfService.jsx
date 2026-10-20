import { useEffect } from "react";
import Footer from "../components/navigation/Footer";
const TermsOfService = () => {

    const brandName = "Topi";

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);



    return (
        <>
            <div className='px-8 font-Inter bg-gradient-to-r from-[#9fa7da] from-0% to-gray-200 to-95% h-min-screen flex justify-center'>
                <div className='max-w-3xl flex flex-col justify-center items-center mt-16'>
                    <h1 className='py-8 w-full text-left text-3xl font-bold text-gray-950 mt-10'>Términos de Servicio y Condiciones</h1>
                    <p className="w-full text-left mt-2 font-bold">Ultima actualización: Julio 7, 2025</p>

                    <p className='text-gray-700 font-semibold mt-4'>
                        Bienvenido, y gracias por tu interes en {brandName}. Al utilizar nuestros servicios, aceptas cumplir con los siguientes términos y condiciones.
                    </p>

                    <div>
                        <p className='text-gray-700 mt-4 text-justify'>
                            AL UTILIZAR EL {brandName.toUpperCase()} O AL HACER CLIC EN «ESTOY DE ACUERDO», INDICAS QUE ACEPTAS ESTAS CONDICIONES Y TE COMPROMETES A CUMPLIRLAS, ASÍ COMO TODAS LAS LEYES Y REGLAMENTOS APLICABLES. NO ESTÁS AUTORIZADO A UTILIZAR EL SERVICIO SI NO ESTÁS DE ACUERDO CON ESTAS CONDICIONES. {brandName.toUpperCase()} PUEDE CAMBIAR, MODIFICAR, COMPLEMENTAR Y/O ACTUALIZAR ESTAS CONDICIONES EN CUALQUIER MOMENTO. HAREMOS TODOS LOS ESFUERZOS RAZONABLES PARA NOTIFICARTE CON ANTELACIÓN CUALQUIER CAMBIO SUSTANCIAL DE ESTAS CONDICIONES. EL USO CONTINUADO DEL SERVICIO DESPUÉS DE LA MODIFICACIÓN DE ESTOS TÉRMINOS SIGNIFICA QUE ACEPTAS TODOS ESOS CAMBIOS. DEBES CONSULTAR ESTAS CONDICIONES CADA VEZ QUE ACCEDAS AL SERVICIO PARA COMPROBAR SI SE HAN PRODUCIDO CAMBIOS. ESTAS CONDICIONES FUERON MODIFICADAS POR ÚLTIMA VEZ EN LA FECHA ARRIBA INDICADA.
                        </p>
                    </div>

                    <div className='mt-8'>
                        <div>
                            <h2 className='text-xl font-semibold mb-2'>1. Uso del Servicio</h2>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Servicio.</h3>
                                El “Servicio” incluye el sitio web de {brandName} disponible en https://www.{brandName.toLowerCase()}.cash (el “Sitio”), así como las aplicaciones móviles asociadas (las “Apps”), que pueden ser actualizadas, trasladadas o modificadas ocasionalmente. También comprende todos los contenidos y funcionalidades que {brandName} pone a disposición a través del Sitio o las Apps, junto con toda la propiedad intelectual involucrada.
                                {brandName} es una herramienta de gestión financiera personal que te permite organizar y hacer seguimiento a tus finanzas, incluyendo la posibilidad de centralizar tu información financiera (“Datos de Cuenta”) desde instituciones financieras y otras fuentes externas seleccionadas por ti y con las que tienes relación contractual (“Fuentes de Datos de Terceros”).
                                Toda persona que acceda o use el Servicio, ya sea en su nombre o en representación de un tercero, será referida como “Usuario de {brandName}”.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Restricciones del Servicio.</h3>
                                Tu cuenta de {brandName} es personal e intransferible. No está permitido utilizar el Servicio con fines comerciales. Para acceder al Servicio necesitas conexión a Internet.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">C. Licencia.</h3>
                                Siempre que cumplas con estos Términos, {brandName} te concede una licencia limitada, revocable, no exclusiva e intransferible para descargar las Apps y acceder y utilizar el Servicio únicamente para uso personal y no para su reventa.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">D. Autorización.</h3>
                                Al acceder y utilizar el Servicio, autorizas a {brandName}, actuando como tu representante y en tu nombre, a obtener electrónicamente tus Datos de Cuenta desde las Fuentes de Datos de Terceros.
                                De acuerdo con nuestra Política de Privacidad, {brandName} puede colaborar con proveedores tecnológicos de servicios financieros de terceros para acceder y recuperar dicha información.
                                A los fines de este acuerdo, y exclusivamente para obtener y proporcionarte tus Datos de Cuenta como parte del Servicio, otorgas a {brandName} un poder limitado, nombrando a {brandName} como tu representante legal (apoderado) con plena facultad de actuación y delegación, para acceder a sitios, servidores o documentos administrados por las Fuentes de Datos de Terceros, recuperar tu información y usarla conforme a los fines del Servicio, como si lo hicieras tú directamente.
                                Reconoces y aceptas que, al acceder a estos datos, {brandName} actúa como tu agente personal y no en representación de ninguna entidad externa. Asimismo, las Fuentes de Datos de Terceros podrán confiar en esta autorización y poder otorgados por ti. Comprendes que ninguna de estas fuentes patrocina ni respalda el Servicio.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">E. Desactivación.</h3>
                                {brandName} se reserva el derecho, en cualquier momento y sin previo aviso, de restringir, suspender o eliminar tu acceso al Servicio (o parte del mismo); o Modificar o descontinuar el Servicio (o parte del mismo).
                                {brandName} no será responsable ante ti ni ante terceros por dichas decisiones. Si no estás satisfecho con algún cambio o cancelación del Servicio, tu única opción es dejar de utilizarlo.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">F. Política de Privacidad.</h3>
                                La forma en que recopilamos y utilizamos tu información personal está descrita en nuestra Política de Privacidad. Al aceptar estos Términos, confirmas que estás de acuerdo con dicha Política.
                            </p>
                            <div className="h-8"></div>
                        </div>

                        <div>
                            <h2 className='text-xl font-semibold mb-2'>2. Registro, Elegibilidad y Restricciones</h2>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Usuarios de {brandName}.</h3>
                                Para convertirte en usuario de {brandName}, debes completar el proceso de registro proporcionando información actual, veraz y completa, según lo solicitado en el formulario correspondiente.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Veracidad de la información.</h3>
                                Reconoces que, si proporcionas información falsa, inexacta, desactualizada o incompleta, {brandName} podrá cancelar tu cuenta y restringir el acceso al Servicio.
                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">C. Elegibilidad.</h3>
                                Declaras y garantizas que tienes al menos 18 años de edad y que no has sido suspendido o eliminado anteriormente del Servicio. Este Servicio no está dirigido a menores de 18 años ni a usuarios que hayan sido previamente suspendidos o eliminados por {brandName}. Si eres menor de 18 años, no debes utilizar ni acceder al Servicio en ningún momento ni bajo ninguna circunstancia.


                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">D. Credenciales de acceso.</h3>
                                Durante el registro, es posible que debas seleccionar un nombre de usuario y contraseña u otras credenciales de acceso. Eres completamente responsable de mantener la confidencialidad y seguridad de tus datos de acceso.
                                Te comprometes a notificar a {brandName} inmediatamente si sospechas de un uso no autorizado de tu cuenta o cualquier otra brecha de seguridad. Puedes escribirnos a: [cashflowapp2024@gmail.com].
                                Eres responsable por todo uso del Servicio que se realice desde tu cuenta, así como por el contenido publicado desde la misma.
                                {brandName} no se hace responsable por pérdidas causadas por el uso no autorizado de tus credenciales, con o sin tu conocimiento. Tú podrías ser responsable por daños causados a {brandName} u otras personas debido al uso indebido de tu cuenta.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">E. Intransferibilidad de la cuenta.</h3>
                                Tu cuenta, suscripciones y membresías no pueden ser transferidas ni asignadas a terceros. Nos reservamos el derecho de aceptar, rechazar o cancelar cualquier cuenta o suscripción en cualquier momento, a nuestra discreción exclusiva.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">F. Responsabilidades del usuario.</h3>
                                Puedes usar el Servicio únicamente para fines legales y según las funcionalidades ofrecidas. No debes utilizar el Servicio de manera que afecte, dañe o sobrecargue nuestros servidores, redes o interfiera con el uso del Servicio por parte de otros usuarios.
                                Tampoco debes intentar obtener acceso no autorizado a cuentas, sistemas o redes relacionadas con {brandName}, ya sea mediante hacking, minería de contraseñas u otros métodos.
                                <ul className="flex flex-col gap-1 pl-6 mt-1 text-gray-700">
                                    Sin limitar lo anterior, te comprometes a no (ni permitir o ayudar a otros a):
                                    <li>1. Usar, copiar, instalar, transferir o distribuir el Servicio salvo en lo permitido en estos Términos.
                                    </li>
                                    <li>2. Modificar, adaptar, traducir, descompilar o desensamblar cualquier parte del Servicio.
                                    </li>
                                    <li>3. Eliminar o alterar derechos de autor, marcas u otros avisos de propiedad intelectual.
                                    </li>
                                    <li>4. Investigar, escanear o probar vulnerabilidades de nuestros sistemas o medidas de seguridad.
                                    </li>
                                    <li>5. Reproducir o embeber el Servicio dentro de otro sitio (framing o mirroring).
                                    </li>
                                    <li>6. Afirmar o insinuar que hablas en nombre de {brandName} sin nuestro consentimiento previo por escrito.
                                    </li>
                                    <li>7. Transmitir virus, malware u otros elementos disruptivos.
                                    </li>
                                    <li>8. Usar herramientas automáticas (robots, scrapers, spiders) para recopilar o extraer datos.
                                    </li>
                                    <li>9. Recoger o solicitar información personal de otros usuarios sin su consentimiento.
                                    </li>
                                    <li>10. Intentar traducir, hackear o revertir cualquier parte del Servicio fuera de lo legalmente permitido.
                                    </li>
                                    <li>11. Acceder o manipular áreas privadas del Servicio o infraestructura técnica de {brandName} o sus proveedores.
                                    </li>
                                    <li>12. Acosar, amenazar o incitar al daño hacia otros usuarios o empleados de {brandName}.
                                    </li>
                                    <li>11. Acceder o manipular áreas privadas del Servicio o infraestructura técnica de {brandName} o sus proveedores.
                                    </li>
                                    <li>13. Solicitar información personal de otros usuarios fuera de las funcionalidades permitidas.
                                    </li>
                                    <li>14. Inhibir o desalentar el uso del Servicio por parte de otras personas, divulgar información personal sin consentimiento, o recolectar datos de otros usuarios.
                                    </li>
                                    <li>15. Obtener acceso no autorizado a cuentas o información personal de otros usuarios.
                                    </li>
                                    <li>16. Violar leyes locales, estatales o nacionales aplicables.
                                    </li>
                                    <li>17. Utilizar el Servicio para actividades ilegales, inapropiadas o violaciones de derechos de propiedad intelectual.
                                    </li>
                                    <li>18. Usar el Servicio para desarrollar productos o servicios que compitan con {brandName}.
                                    </li>
                                    {brandName} se reserva el derecho de tomar acciones legales y aplicar medidas técnicas para evitar el incumplimiento de estas condiciones y hacer cumplir los Términos.

                                </ul>
                            </p>

                            <div className="h-8"></div>

                        </div>

                        <div>
                            <h2 className='text-xl font-semibold mb-2'>3. Consentimiento para Comunicaciones Electrónicas</h2>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Aceptación de comunicaciones electrónicas.</h3>
                                Al utilizar el Servicio o proporcionarnos información personal, aceptas que {brandName} pueda comunicarse contigo por medios electrónicos en relación con temas de seguridad, privacidad y aspectos administrativos relacionados con el uso del Servicio.
                                Podremos enviarte notificaciones por cualquier medio razonable que permita informarte adecuadamente. Aceptas que todos los avisos, divulgaciones y otras comunicaciones que te proporcionemos por vía electrónica cumplen con cualquier requisito legal de que dicha información sea entregada por escrito o de manera específica.
                                Confirmas que tienes la capacidad de almacenar estas comunicaciones electrónicas de forma que permanezcan accesibles y sin alteraciones.
                                En caso de que llegáramos a tener conocimiento de una brecha de seguridad, podríamos intentar notificártelo electrónicamente mediante un aviso dentro de la plataforma o por correo electrónico, si contamos con tu dirección de correo. En algunos casos, podrías tener derecho legal a recibir esta notificación por escrito. Si deseas recibir una copia gratuita de dicho aviso por escrito (o retirar tu consentimiento a comunicaciones electrónicas), puedes escribirnos a: cashflowapp2024@gmail.com.

                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Notificaciones Push.</h3>
                                Al registrarte en {brandName}, podrás recibir notificaciones automáticas (push) según las preferencias de notificación que hayas configurado (“Notificaciones”). Algunas notificaciones podrían estar activadas por defecto.
                                Al utilizar el Servicio, aceptas recibir Notificaciones sobre tu uso del Servicio y sobre tu información financiera conectada. Aunque estas notificaciones están diseñadas para mejorar tu experiencia, puedes desactivarlas en cualquier momento desde la configuración de tu dispositivo.
                                Ten en cuenta que, dependiendo de las preferencias elegidas, las Notificaciones podrían contener información sensible.

                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">C. Cancelación de suscripción.</h3>
                                Si deseas dejar de recibir comunicaciones por correo electrónico (con excepción de las Notificaciones push descritas en el punto anterior), puedes escribirnos a cashflowapp2024@gmail.com indicando en el asunto: “BAJA”, “NO MÁS”, “ELIMINAR” o “UNSUBSCRIBE”, o haciendo clic en el enlace de “cancelar suscripción” incluido en los correos que recibas de nosotros.
                                Ten en cuenta que, dependiendo de las preferencias elegidas, las Notificaciones podrían contener información sensible.

                            </p>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">D. Entrega de mensajes.</h3>
                                {brandName} no puede garantizar ciertos aspectos técnicos relacionados con la entrega de mensajes. Es posible que algunas Notificaciones no lleguen en tiempo real o de forma precisa. No asumimos responsabilidad por retrasos, errores, o fallos en la entrega de mensajes, ni por acciones que tomes (o no tomes) basadas en dichas Notificaciones.

                            </p>
                            <div className="h-8"></div>


                        </div>

                        <div>
                            <h2 className='text-xl font-semibold mb-2'>4. Contenido Enviado al Servicio</h2>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Materiales.</h3>
                                Al enviarnos o transmitirnos cualquier tipo de información, ideas, sugerencias, opiniones, notas, conceptos u otros contenidos (en conjunto, los “Materiales”), o al publicar dichos Materiales en cualquier sección del Servicio, otorgas a {brandName} y sus representantes una licencia mundial, no exclusiva, transferible, sublicenciable, irrevocable y libre de regalías, para usar, reproducir, distribuir (en múltiples niveles), modificar, crear obras derivadas, mostrar públicamente, ejecutar públicamente, almacenar, vender o incorporar dichos Materiales en cualquier medio conocido o por desarrollarse, con el objetivo de operar, mejorar o expandir el Servicio, sin que se genere compensación para ti.
                                No usaremos tu nombre en actividades publicitarias relacionadas con tus Materiales sin tu consentimiento previo.

                                Renuncias a cualquier derecho moral o derecho de atribución como autor que pudieras tener conforme a la legislación aplicable.
                                Ninguno de los Materiales estará sujeto a deberes de confidencialidad o atribución por parte de {brandName}, y no asumimos responsabilidad por el uso o divulgación de los mismos. {brandName} se reserva el derecho de eliminar o modificar cualquier Material en cualquier momento y por cualquier motivo.
                                No respaldamos ni somos responsables por opiniones, consejos, o información publicada por otros usuarios en el Servicio. Tampoco nos hacemos responsables por errores en publicaciones, enlaces incluidos en los mensajes, o decisiones que tomes en base a dicha información. En ningún caso, {brandName} o sus afiliados serán responsables por pérdidas causadas por confiar en contenido generado por otros usuarios.

                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Supervisión.</h3>
                                {brandName} se reserva el derecho (aunque no está obligado) a:
                                <ul className="flex flex-col gap-1 pl-6 mt-1 text-gray-700">

                                    <li>1. Supervisar el contenido del Servicio y los Materiales publicados.
                                    </li>
                                    <li>2. Eliminar o modificar cualquier Material en cualquier momento.
                                    </li>
                                    <li>3. Revelar Materiales y las circunstancias de su publicación a terceros, en caso de ser necesario para operar el Servicio, protegernos a nosotros, a nuestros usuarios o cumplir obligaciones legales o requerimientos gubernamentales.
                                    </li>
                                    Si consideras que algún contenido infringe nuestras políticas, escríbenos a cashflowapp2024@gmail.com para evaluarlo.
                                </ul>
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">C. Derechos sobre los Materiales.</h3>
                                Eres el único responsable de los Materiales que publiques y de las consecuencias que esto genere. Al publicar, declaras y garantizas que:

                                <ul className="flex flex-col gap-1 pl-6 mt-1 text-gray-700">

                                    <li>1. Eres el autor y titular de los derechos sobre los Materiales, o cuentas con las autorizaciones necesarias para conceder a {brandName} los derechos descritos aquí.
                                    </li>
                                    <li>2. Tus Materiales no infringen ni infractarán ningún derecho de terceros, incluyendo propiedad intelectual, privacidad, imagen o reputación.
                                    </li>
                                    <li>3. Tus Materiales están libres de virus, spyware, malware u otros elementos dañinos.
                                    </li>
                                    <li>4. No contienen información confidencial de terceros, a menos que tengas autorización por escrito para compartirla.
                                    </li>
                                    Nos reservamos todos los derechos legales contra cualquier usuario que incumpla estas condiciones o garantías.
                                </ul>

                            </p>


                            <div className="h-8"></div>


                        </div>

                        <div>
                            <h2 className='text-xl font-semibold mb-2'>5. Términos de Pago y Procesamiento de Órdenes</h2>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Tarifas.</h3>
                                El acceso al Servicio, o a ciertas funciones del mismo, puede requerir el pago de tarifas bajo un modelo de suscripción, incluyendo la activación de pagos automáticos recurrentes. Antes de realizar cualquier pago, se te dará la oportunidad de revisar el valor que se te cobrará.
                                Si adquieres una suscripción recurrente, autorizas a {brandName} (o a sus proveedores externos de pago) a cobrarte periódicamente la tarifa correspondiente de forma automática según el intervalo elegido (mensual, anual, etc.), hasta que canceles tu suscripción.
                                El primer cobro se realizará el día en que actives tu suscripción o al finalizar tu periodo de prueba gratuito. La suscripción se renovará automáticamente a menos que, al menos 24 horas antes del siguiente periodo: (a) canceles tu cuenta, (b) canceles tu suscripción como se indica más abajo, (c) decidamos no renovarla, o (d) estos Términos hayan sido legalmente terminados.
                                La tarifa de suscripción no es reembolsable, salvo que se indique lo contrario en estos Términos o según la ley vigente.

                                Si el cobro falla o no puede procesarse, nos reservamos el derecho de suspender, cancelar o desactivar tu acceso al Servicio. Serás responsable de cubrir cualquier monto pendiente. También podríamos recibir actualizaciones de tu tarjeta de crédito por parte de tu banco y usarlas para evitar interrupciones. Puedes actualizar tu método de pago en la configuración de tu cuenta o tienda de aplicaciones.

                                Al usar el Servicio, aceptas nuestras políticas de precios y cobro vigentes al momento del pago. No ofrecemos reembolsos por diferencias de precio ni promociones pasadas.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Autorización de Cobro.</h3>
                                Debes proporcionarnos información válida de un método de pago autorizado a tu nombre (tarjeta, tienda de apps u otro aceptado por nosotros). Nos autorizas a realizar los cobros relacionados con tu cuenta. También serás responsable de cualquier cargo adicional por funciones o servicios adquiridos.
                                Todas las tarifas están en dólares estadounidenses y no son reembolsables. {brandName} (o sus proveedores) puede cambiar los precios en cualquier momento.

                                Si no se completa el pago, aceptas cubrir el monto adeudado cuando lo solicitemos y serás responsable de cualquier disputa con tu entidad financiera. También serás responsable de cualquier cargo por sobregiro o penalización relacionada.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">C. Cancelación.</h3>
                                Al cancelar una suscripción, solo detienes los cobros futuros. La cancelación entra en vigor al final del periodo actual de suscripción. Para evitar cargos futuros, debes cancelar al menos 24 horas antes del siguiente cobro.
                                Si compraste directamente con {brandName}, puedes cancelar desde la configuración de tu cuenta o escribirnos a cashflowapp2024@gmail.com.
                                Si adquiriste la suscripción a través de un tercero (como App Store), deberás cancelarla desde esa plataforma. {brandName} no gestiona cancelaciones de terceros.

                                Luego de cancelar, podrás seguir usando el Servicio hasta el fin del periodo que ya pagaste, salvo que se te otorgue un reembolso o se transfiera ese saldo a otro servicio o producto.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">D.  Política de reembolsos limitada.</h3>
                                SALVO QUE LA LEY INDIQUE LO CONTRARIO, NO HAY REEMBOLSOS. Si:
                                <ul className="flex flex-col gap-1 pl-6 mt-1 text-gray-700">

                                    <li>1. Compraste directamente con {brandName}
                                    </li>
                                    <li>2. Cancelas durante el primer mes
                                    </li>
                                    <li>3. Nos contactas en los cinco días siguientes a la cancelación
                                    </li>
                                    …te haremos un reembolso completo por ese periodo.
                                    Fuera de ese plazo, no hay reembolsos ni parciales ni totales, salvo disposición legal. {brandName} puede otorgar reembolsos o créditos a su entera discreción, sin que esto genere precedentes.
                                </ul>
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">E. Pruebas Gratuitas y Promociones.</h3>
                                {brandName} puede ofrecer periodos gratuitos o tarifas promocionales. Estos están sujetos a estos Términos, salvo indicación contraria en la oferta.
                                Si tu suscripción incluye prueba gratuita, no se te cobrará hasta que finalice el periodo de prueba. Debes proporcionar un método de pago para asegurar continuidad. Al finalizar la prueba, si no cancelas, se aplicará el cobro de la tarifa estándar.

                                Si accedes a un precio promocional, se aplicará durante el número indicado de periodos. Al finalizar ese tiempo, se renovará al precio normal. Si no deseas continuar, cancela antes del fin del periodo promocional.

                                Nos reservamos el derecho de cancelar o no procesar suscripciones con errores de precio. Solo se permite una prueba gratuita o promoción por usuario.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">F. Terminación.</h3>
                                Podemos cancelar tu suscripción en cualquier momento y sin previo aviso. Si la cancelación no es por una violación de los Términos o de la ley, podemos otorgarte un reembolso proporcional al tiempo no utilizado.
                                Si tu cuenta fue cancelada por uso indebido, fraude o incumplimiento, no recibirás reembolso alguno.
                                Al cancelarse la suscripción, podrías perder el acceso al contenido, funciones o información generada dentro del Servicio.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">G. Cambios en la Suscripción o el Servicio.</h3>
                                Podemos modificar los términos o precios en cualquier momento. Si el precio cambia, te notificaremos y podrás cancelar antes del próximo cobro. Si no cancelas, se considerará que aceptas los nuevos términos.
                            </p>

                            <div className="h-8"></div>


                        </div>

                        <div>
                            <h2 className='text-xl font-semibold mb-2'>6. Plazo y Terminación</h2>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Vigencia.</h3>
                                Estos Términos entrarán en vigor desde el momento en que accedas o utilices por primera vez el Servicio de cualquier forma, y permanecerán vigentes mientras continúes haciéndolo, salvo que {brandName} los dé por terminados con anterioridad.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Terminación y otras medidas.</h3>
                                {brandName} podrá tomar todas las acciones legales que considere apropiadas en respuesta a violaciones reales o sospechadas de estos Términos, incluyendo la cancelación de los mismos, la suspensión o terminación de tu cuenta o acceso, o el bloqueo de tu ingreso al Servicio.
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">C. Efectos de la terminación.</h3>
                                Las siguientes secciones de estos Términos seguirán vigentes incluso después de la terminación o expiración de los mismos: 1.A, 1.B, 1.D, 1.E, 1.F, 2, 4, 5, y 6.C.
                                Todos los pagos que se hayan generado o adeuden antes de la finalización de los Términos seguirán siendo exigibles, y cualquier monto pendiente con {brandName} en el momento de la terminación continuará siendo tu responsabilidad.
                            </p>
                            <div className="h-8"></div>


                        </div>

                        <div>
                            <h2 className='text-xl font-semibold mb-2'>7. Propiedad</h2>
                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">A. Información Propietaria</h3>
                                Reconoces y aceptas que:
                                <ul className="flex flex-col gap-1 pl-6 mt-1 text-gray-700">

                                    <li>1. El Servicio, incluyendo su contenido, modificaciones, mejoras, actualizaciones, originales y copias, ya sea en parte o en su totalidad, y todos los derechos de propiedad intelectual relacionados (en adelante, la “Información Propietaria”), son propiedad de {brandName} y sus licenciantes, según corresponda.
                                    </li>
                                    <li>2. Esta Información Propietaria incluye material protegido por derechos de autor y otros derechos legales valiosos.
                                    </li>
                                    <li>3. La Información Propietaria te es licenciada, no vendida, bajo estos Términos.
                                    </li>
                                    <li>4. No tienes derechos sobre dicha Información Propietaria más allá de lo expresamente otorgado en estos Términos.
                                    </li>

                                </ul>
                            </p>

                            <p className='text-gray-700 mb-4 text-justify'>
                                <h3 className="font-semibold">B. Marcas Registradas.</h3>
                                Reconoces que {brandName} posee derechos registrados o de uso común sobre la marca “{brandName}” y otras marcas comerciales o gráficas asociadas con el Servicio.
                                Reconoces también que estas marcas gozan de reconocimiento y reputación internacional.
                                Te comprometes a no disputar, en ningún momento ni por ninguna razón, la validez o propiedad de estas marcas por parte de {brandName}, y renuncias a cualquier derecho que tengas para hacerlo.

                                No puedes utilizar el nombre o las marcas de {brandName} en relación con productos o servicios que no sean nuestros, ni de manera que pueda generar confusión.
                                Toda utilización de estas marcas por tu parte será en beneficio exclusivo de {brandName}.
                                Las marcas que aparezcan en el Servicio pero que no sean propiedad de {brandName} pertenecen a sus respectivos titulares.
                            </p>



                            <div className="h-8"></div>


                        </div>


                        <h2 className='text-xl font-semibold mb-2'>8. Ley Aplicable</h2>
                        <p className='text-gray-700 mb-4'>
                            Estos términos se regirán e interpretarán de acuerdo con las leyes del país en el que operamos, sin tener en cuenta sus principios de conflicto de leyes.
                        </p>
                        <h2 className='text-xl font-semibold mb-2'>9. Contacto</h2>
                        <p className='text-gray-700 mb-4'>
                            Si tienes alguna pregunta sobre estos términos, por favor contáctanos a través de nuestro correo electrónico de soporte cashflowapp2024@gmail.com.
                        </p>


                    </div>

                </div>
            </div>
            <Footer />
        </>

    )
}



export default TermsOfService




