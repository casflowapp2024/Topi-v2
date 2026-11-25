# Landing con propuesta de valor (plan 28)

Rama `feat/landing-valor` (desde `feat/lanzamiento` 64ac059, sin merge). **Propuesta: no se codifica nada hasta el
OK de JuanMa.** Reemplaza la landing del plan 27 §F, pero conserva lo que exige la verificación de Google (qué lee y
qué no, Política con Uso limitado, enlaces legales).

Restricciones que no cambian: sin precios, Plus ni Apoyar a Topi; no prometer el cifrado de los tokens; Lighthouse
móvil ≥ 90 en rendimiento y accesibilidad (hoy 92/100/100/100, FCP 2,5 s, LCP 2,8 s, TBT 0, CLS 0); `LandingPage`
sigue siendo un componente puro prerenderizado; el bundle principal no importa `redux/actions` ni `helpers.js`.

## 1. Propuesta de valor (ecuación de Hormozi)

**Valor = (resultado soñado × probabilidad percibida) / (tiempo de espera × esfuerzo y sacrificio)**

| Palanca | Hoy en la landing | Propuesta |
|---|---|---|
| **Resultado soñado** | "Tus finanzas al día, sin digitar nada" (bien, pero abstracto) | Concreto y medible: *saber cada día en qué se te va la plata y cuánto te queda del mes, sin anotar nada*. El resultado no es "una app de finanzas", es **dejar de anotar y aun así tener control**. |
| **Probabilidad percibida** ("¿me va a funcionar a mí?") | Lista de 10 bancos de Colombia; nada que demuestre que funciona | 1) El hero **muestra** el producto haciendo el trabajo (§3). 2) Un número real: "más de 7.000 movimientos leídos solos" (7.485 automáticos en el dump del 17-oct; JuanMa confirma la cifra de hoy en el panel). 3) Historia del fundador. 4) Testimonios reales de I.1 cuando existan. 5) Honestidad visible: qué lee y qué no, y "lo que todavía no hace". 6) Red de seguridad real: si en 48 h no lee tu banco, te avisa (`bank_unsupported`). |
| **Tiempo de espera** | No se dice | "La primera lectura trae lo que va del mes" (verificado: sin `last_run`, el worker lee desde el día 1 del mes, `jobs.py` `first_day_of_month`; al conectar se encola con prioridad 1). No prometer minutos exactos. |
| **Esfuerzo y sacrificio** | "Conecta tu correo" | Esfuerzo: conectar el correo y decir qué cuentas tienes; después, cero. Sacrificio (el miedo real): **dar acceso al correo**. Se ataca con la reversión de riesgo (abajo), no escondiéndolo. |

### La oferta: "Topi anota por ti"

Una oferta irresistible por valor, no por precio. Cada pieza se escribe como **resultado**, no como función, y todas
existen hoy en producción (plan 22: "no se ofrece lo que no existe"):

1. **Cada movimiento, anotado solo** — compras, pagos y transferencias que te notifica tu banco, en su cuenta y su categoría.
2. **Lo dudoso te lo pregunta** — Por revisar: lo que no sabe clasificar no lo inventa.
3. **Sabes cuánto te queda** — presupuestos por categoría, con su historia mes a mes.
4. **Tus tarjetas sin sorpresas** — deuda estimada por corte y cuotas por cobrar (cifra aproximada, y se dice).
5. **Todo tu dinero en un número** — patrimonio con cuentas en varias monedas.
6. **Te avisa si deja de leer** — si se cae la conexión, te lo dice y reconectas en un toque.

**Reversión de riesgo (sin precio):**
- **Solo lectura**: no puede enviar, borrar ni cambiar correos; no se conecta a tu banco ni puede mover dinero.
- **Sin claves del banco** (la objeción n.º 1 frente a apps que piden usuario y clave del banco).
- **Desconecta en un clic** (Ajustes → Conexiones o permisos de Google/Microsoft).
- **Borra tus datos**: hoy es pidiéndolo por correo (no hay botón de borrar cuenta; la Política ya lo dice). Se
  escribe así, sin prometer un botón que no existe. Un "Borrar mi cuenta" en la app haría más fuerte la oferta → ver
  "Fuera de alcance".
- **"Si no lee tu banco, te lo decimos"**: a las 48 h sin movimientos, aviso en la app y correo, y lo agregamos con un
  correo de ejemplo. Es la garantía de Hormozi sin dinero: el riesgo de "perder el tiempo" lo asume Topi.

**Escasez honesta (decisión de JuanMa, D3):** el tope de Google es real (82 cupos de Gmail mientras no está
verificada). "Acceso anticipado: cupos limitados para Gmail mientras Google termina su revisión; Outlook sin límite".
Sin contador ni cuenta regresiva (no hay dato público en vivo y sería manipulación).

## 2. ¿Sección de precios? No

1. **Plan 22, principio 2: "No se ofrece lo que no existe."** Plus no está a la venta y sus funciones no están en
   producción; Apoyar a Topi está apagado hasta UAS ≥ 50 durante 4 semanas. Una tabla de planes tendría una sola
   columna o columnas ficticias.
2. **Mostrar "Plan gratis" ya es prometer límites** (2 conexiones, 1 pregunta/día) que dependen de `Entitlements`,
   que aún no existe (N2a). Publicarlos antes ata decisiones de la etapa 5.
3. **"¿Y cuándo me van a cobrar?"**: una sección de precios con todo en cero levanta justo la duda que no queremos y
   no sube la probabilidad percibida. En Hormozi el precio se presenta **después** de apilar valor; hoy el "precio"
   que paga el usuario es confianza y unos minutos, y eso lo baja la reversión de riesgo.
4. **Google**: la página de inicio para la verificación pide explicar la app y enlazar la Política; no pide precios.
   Menos superficie = menos inconsistencias con la Política.

Se reconsidera en la etapa 5 con la página Planes. Sí propongo decir **"sin tarjeta"** en el microtexto del CTA: es un
hecho, no un precio. La palabra "gratis" hoy está prohibida por `landing.test.js` → D2.

## 3. El hero: una animación de producto que da confianza

**Idea:** el visitante ve a Topi hacer su trabajo con un ejemplo concreto, en ~6 s, sin leer nada.

Guion (se repite con 3 ejemplos de países/monedas distintos para el mensaje global):

| t | Cuadro | Qué transmite |
|---|---|---|
| 0–1,2 s | Llega una **notificación de correo** de "Tu banco" (marca genérica, nunca un banco real): "Compra aprobada por $ 48.900 en Panadería La Espiga con tu tarjeta ··4821". | "Esto ya me llega todos los días." |
| 1,2–2,6 s | Se resaltan **monto, comercio y tarjeta** con subrayados de color y tres etiquetas pequeñas: "monto", "comercio", "cuenta". | Lee solo eso: *qué lee y qué no*, sin decirlo. |
| 2,6–4,0 s | La notificación **se convierte en una fila de movimiento** con el estilo real de la app: emoji 🥐 categoría "Comida", "Tarjeta ··4821", monto en rojo, chip "Anotado solo". | El resultado: no tuve que digitar. |
| 4,0–6,0 s | Debajo, la barra del **presupuesto de Comida** avanza de 62 % a 68 % y dice "Te quedan $ 312.000 este mes". | El resultado soñado: control. |

Ejemplos que rotan (solo monedas que Topi tiene hoy, §4): COP "$ 48.900 · Panadería", MXN "MX$ 320.00 · Farmacia",
EUR "12,50 € · Supermercado". Comercios genéricos, sin marcas reales.

**Por qué no parece una landing genérica de IA** (lista de lo que NO se hace): sin gradientes morados ni manchas, sin
ícono de "chispas" de IA (hoy el paso 2 usa `SparklesIcon`: se quita), sin "Revoluciona tus finanzas con IA", sin
mockups 3D ni fotos de stock, sin testimonios inventados ni logos de "como aparece en". En cambio: la UI real de la
app (mismas tarjetas `rounded-2xl`, Inter, Topi Blue `#5266EB`, verde/rojo de ingresos/gastos), cifras específicas,
la voz de JuanMa y las limitaciones dichas en voz alta.

**Implementación (sin biblioteca nueva):**
- **CSS puro** (`@keyframes` en `tailwind.config.js` o un bloque CSS de la landing): solo `transform` y `opacity`
  (compositor; TBT 0 y CLS 0). Cero JS: funciona en el HTML prerenderizado antes de que cargue React. Alto fijo del
  contenedor para no mover nada.
- `prefers-reduced-motion: reduce` → cuadro final estático (notificación + movimiento + presupuesto a la vez).
- Accesibilidad: el visual va con `role="img"` y un `aria-label` que cuenta la historia en una frase; lo interior
  `aria-hidden`. El LCP sigue siendo el `h1` (texto), no la animación.
- Claro y oscuro con las mismas clases `dark:` de la landing.
- **Biblioteca o skill: no hace falta.** Framer Motion (~30–50 KB gz) o Lottie (player ~60 KB + un diseñador para el
  JSON) costarían rendimiento y no aportan a una animación de 4 cuadros; además el HTML debe verse bien sin JS. Para
  revisar el resultado basta el navegador integrado (capturas y Lighthouse como en el plan 27).

**Qué hace falta y de quién:**
| Qué | Quién | Estado |
|---|---|---|
| Recreación en HTML de la fila de movimiento y la barra de presupuesto (nítida y con tema; mejor que una captura en el hero) | Yo | — |
| Sección "Así se ve Topi": 2–3 capturas reales (Inicio, Por revisar, Presupuestos) en WebP ≤ 60 KB, `loading="lazy"`, con `width/height` | Yo, con la cuenta ficticia `@topi.test` y datos de demo (nunca datos reales) | — |
| Historia del fundador: 3–4 frases en su voz (por qué la hizo, desde cuándo la usa, qué le cambió) y foto opcional ≤ 20 KB | **JuanMa** (puedo redactar un borrador a partir de sus respuestas) | Falta |
| Testimonios | De I.1, reales y con permiso (nombre y país). **El bloque no se muestra hasta tener ≥ 3**: nada inventado | I.1 no ha empezado |
| Cifra "más de 7.000 movimientos leídos solos" | **JuanMa** la confirma en el panel de producción | Falta |

## 4. Global, no solo Colombia: qué dice el código

Verificado en `feat/lanzamiento` (64ac059) el 16-nov-2026:

| Promesa | Resultado | Evidencia |
|---|---|---|
| El usuario crea su propio banco con sus remitentes | **Sí** | `POST /banks/create` (`createBankRequest.Email`, `binding:"omitempty,emails"`, varios separados por coma); `SetOfficialBank` solo pisa el correo si el nombre es uno oficial. En la web: `DropDownBanks` → `EditCreateBankForm` (varios remitentes). |
| El worker lee con esos remitentes | **Sí** | `Accounts.BuildReadEmailRequests` pone `Bank.Email` en `SenderEmail`; `jobs.py` → `split_senders` → `gmail_query` (`from:(a OR b)`) / `outlook_filter`. Sin remitente: el job se descarta (`jobqueue.go`) o falla permanente. |
| El prompt no asume COP | **Sí, con matices** | `prompt_v3.py` no menciona monedas: `amount` es un número; la moneda la fija la cuenta. Pero las instrucciones y palabras clave son en español (con algunas en inglés) y los ejemplos son de Colombia (`$25000`). **No está evaluado** con formatos como `1.234,56 €` o `$1,234.56` ni con correos en inglés. No se cambia sin evaluar. |
| Multimoneda | **Sí, pero solo 7 monedas** | `accounts.currency`, `user_extra.base_currency`, `amount_base`. La tabla `currencies` (000022) tiene **COP, USD, EUR, MXN, GBP, BRL, CAD**: alguien de Chile, Perú o Argentina **no puede elegir su moneda**. Además `base_currency` y `accounts.currency` tienen `DEFAULT 'COP'` y no hay selector de moneda base en la bienvenida. |
| Tasas solo de TRM y BCE | **Sí** | `worker/fx.py`: USD→COP de la TRM (datos.gov.co, `SFC_TRM`) y el resto de Frankfurter/BCE (`ECB`). El BCE no publica ARS, CLP, PEN ni COP. `fx_source_priority` acepta `manual`, pero no hay API para cargarla. |
| Aviso "Todavía no vemos movimientos de tu banco" | **Trata como no soportado todo banco fuera de `enums.OfficialBanks`** | `domain.IsSupportedBank` → `ConnectionBank.Supported` (`repository/reading.go`); el aviso dice "Topi aún no sabe leer las notificaciones de X. Hoy leemos: …" y el correo `bank_unsupported` dice "Lo más común es que tu banco aún no esté entre los que Topi sabe leer". Con la promesa "cualquier banco", eso es falso para un banco propio con remitentes. |

**Cambios que propongo en esta rama (pequeños, sin tocar el prompt):**
1. `ConnectionBank` gana `kind`: `official` | `custom` (tiene remitentes propios) | `no_senders`. `Supported` = oficial o
   con remitentes (se mantiene el campo por compatibilidad). Tests de tabla en Go.
2. `UnsupportedBankNotice` por caso:
   - oficial: "Revisa que tu banco te envíe las notificaciones a este correo" (como hoy, sin "no sabemos leerlo");
   - con remitentes: "En dos días no llegó ningún correo de <remitentes>. Copia la dirección exacta del campo *De* de
     una notificación de tu banco" + botón para editar el banco + buzón de ejemplos;
   - sin remitentes: "Agrega el correo desde el que te escribe tu banco".
   - "Hoy leemos: …" pasa a "Bancos ya probados: …".
3. Plantilla `bank_unsupported`: el mismo cambio de texto (sin "tu banco no está entre los que sabemos leer").
4. `EditCreateBankForm`: una línea de ayuda bajo "Correo del remitente" ("Ábrelo en una notificación de tu banco:
   es la dirección del campo *De*").
5. Landing: "Bancos que Topi lee hoy" → **"Funciona con tu banco"**: cualquier banco que te avise por correo;
   lista de "ya probados" y cómo agregar el tuyo con su remitente.

**Promesa honesta para la landing:** "Para cualquier banco que te avise por correo, en español". No "cualquier moneda":
se nombran las 7.

**Limitaciones reales que quedan (van en la FAQ, "Lo que todavía no hace"):**
- **Solo en español** (la app, el prompt y los correos de Topi). Correos de bancos en inglés: sin evaluar.
- **Tu banco tiene que avisarte por correo.** Bancos que solo avisan por push o SMS no se pueden leer.
- **Solo Gmail y Outlook/Hotmail/Live** (no Yahoo, iCloud ni correo propio).
- **7 monedas**; tasas del BCE (y TRM para COP), así que monedas sin tasa del BCE no se pueden mezclar.
- **Probado sobre todo con bancos de Colombia**: fuera de Colombia, la red de seguridad es el aviso de 48 h.
- Zona horaria fija `America/Bogota` en el worker (inicio de la primera lectura) y en las métricas del panel: por
  revisar si cambia el día de un movimiento para alguien en Europa.
- Mercado Pago solo en Colombia (irrelevante para la landing: Apoyar está apagado).
- El lanzamiento abierto (I.3) sigue bloqueado por la verificación de Google; Outlook no gasta cupos.

"Hecho en Colombia" en el pie se queda: es el origen, no el mercado.

## 5. Estructura nueva de la página

1. **Hero**: antetítulo "Para cualquier banco que te avise por correo"; h1 "Cada compra que te avisa tu banco,
   anotada sola"; subtítulo "Conecta tu Gmail u Outlook. Topi lee las notificaciones de tu banco, anota cada
   movimiento en su categoría y te dice cuánto te queda del mes. Tú solo revisas."; CTA "Conectar mi correo" →
   `/create_account/` y secundario "Qué lee y qué no"; microtexto "Solo lectura · Sin claves del banco · Sin tarjeta
   · Desconecta en un clic". Animación a la derecha en PC y debajo en móvil.
2. **Prueba**: una línea con la cifra de movimientos leídos (si JuanMa la confirma), "Gmail y Outlook", "7 monedas".
3. **El problema** (3 líneas): anotar gastos a mano dura dos semanas; las apps que leen tu banco piden su clave;
   el Excel nunca está al día.
4. **Cómo funciona** (3 pasos, cada uno con su tiempo y su esfuerzo).
5. **Lo que te llevas** (la oferta de §1, 6 resultados).
6. **Qué lee y qué no** (se conserva: requisito de Google).
7. **Sin riesgo** (reversión de riesgo de §1; reemplaza "Seguridad" sin prometer cifrado).
8. **Funciona con tu banco** (§4).
9. **Así se ve Topi** (capturas reales, perezosas).
10. **Quién hace Topi** (historia del fundador).
11. **Testimonios** (oculto hasta tener ≥ 3 reales).
12. **Preguntas** (nuevas: ¿funciona en mi país?, ¿en qué monedas?, ¿y si mi banco solo me avisa por la app?,
    ¿está en inglés?; se conserva la de "app no verificada").
13. **CTA final**: "Deja de anotar tus gastos".

Título y descripción (`Landing.jsx`, `index.html`, Open Graph) sin "Colombia" y sin "digitar" (regionalismo):
"Topi · Tus gastos anotados solos, desde los correos de tu banco".

## 6. Decisiones de JuanMa (16-nov-2026)

- **D1 OK**, con cambios:
  - La historia no es "del fundador" sino **de dónde salió el problema y cómo lo resolvimos** (texto de D5).
  - **Sin testimonios.** La prueba social son cifras reales: movimientos leídos en automático y similares
    (`GET /public/stats`, agregados redondeados hacia abajo, sin datos de nadie).
  - **No se listan limitaciones fáciles de resolver pronto** (monedas, zona horaria, idioma). Se queda solo lo
    estructural: el banco tiene que avisar por correo, y Gmail u Outlook (dicho como lo que hace, no como limitación).
    Tampoco se promete lo que no hay: "varias monedas", no "cualquier moneda".
- **D2**: en vez de "sin tarjeta"/"gratis", **"Beta · cupos limitados"**. JuanMa propuso además "aprovecha antes de
  que empecemos a cobrar": no se usa porque contradice el principio 3 del plan 22 ("nada gratis se vuelve pago") y es
  hablar de precio en la landing. Si se quiere, es un cambio de una línea en `site.js`.
- **D3 (fuera de la landing)**: aviso en el panel y por correo al equipo **cada 10 cuentas de Google usadas**; desde
  **30**, además un **correo semanal** con los cupos usados y las cuentas activas (ahí JuanMa empieza a tramitar CASA).
  Si antes de la verificación se llega a **86**, la app deja de ofrecer conexiones de Gmail nuevas con el aviso
  "Estamos trabajando para aumentar los límites; por ahora no hay espacio para más conexiones de Gmail" (reconectar
  la misma cuenta sigue funcionando: no gasta cupo). Nada de esto va en la landing. Ver §7.
- **D4 OK**: aviso, correo y ayuda del formulario para bancos propios.
- **D5**: texto base de la historia: los fundadores llevaban gastos y presupuestos en Excel, gastando horas los fines
  de semana o a fin de mes leyendo correos y cruzando a mano con los bancos. Ahora es casi al instante, y además se ve
  cuánto falta del mes y cuánto se puede ahorrar. A futuro: una IA con todo el contexto para análisis más profundos y
  búsqueda de productos financieros a la medida (se dice como plan, no como función).
- **D6**: no se menciona a los fundadores en la landing. **Plus de por vida solo para los primeros 30** (anotado en el
  plan 22).

## 7. Cupos de Google (D3)

Google cuenta **cada cuenta que dio permiso alguna vez**, también las borradas (18 de 100 el 14-nov-2026). La base
solo ve las conexiones que existen hoy, así que:
- Tabla `gmail_oauth_grants (email_hash PK, first_granted_at)`: un hash SHA-256 de la dirección en minúsculas, nunca
  la dirección. Se llena con un trigger al insertar una conexión de Gmail y se rellena con las existentes. No se borra
  al quitar una conexión (igual que el contador de Google).
- **Usados = `GMAIL_OAUTH_BASELINE` (lo que decía Google en `GMAIL_OAUTH_BASELINE_AT`) + cuentas nuevas desde esa
  fecha**, y nunca menos que el total de la tabla. Con `GMAIL_VERIFIED=true` no hay tope.
- Aviso cada 10 (`gmail_quota` con dedupe por umbral); semanal desde 30 (`gmail_quota_weekly`, dedupe por semana ISO,
  con cupos usados, UAS y usuarios activos en 7 días). Los dos van al buzón del equipo (`MAIL_REPLY_TO`).
- Tope en `GMAIL_BLOCK_AT` (86): `GET /email/gmail-capacity` le dice al front si se puede conectar una cuenta nueva y
  `RegisterEmail` rechaza una dirección de Gmail nueva (defensa en el servidor).

## Fuera de alcance (propuestas aparte)

- **Más monedas** (ARS, CLP, PEN, UYU, DOP, GTQ, CRC…): migración con `minor_units` + una fuente de tasas para las que
  el BCE no publica (rompe "solo TRM y BCE": decisión propia) o tasa manual.
- **Moneda base en la bienvenida** según el país del navegador (hoy todo nace en COP).
- **Zona horaria por usuario.**
- **Evaluación del prompt** con notificaciones de otros países (llegan por el buzón de ejemplos) antes de promover
  la app fuera de Colombia en I.2.
- **"Borrar mi cuenta"** en la app (habeas data; requiere OK explícito).

## 8. Segunda versión: dirección B "Un mes" (24-nov-2026)

La primera versión (hero con la notificación que se convierte en movimiento) no le gustó visualmente a JuanMa. Pidió
"algo con animaciones" con la referencia de krea.ai/bots-beta: titulares enormes, personajes 3D con tarjetas de chat
que flotan y secciones que se animan al bajar. Se le propusieron tres direcciones con prototipo
(`topiv2/capturas-landing/prototipos/`): A · el equipo (personajes), **B · un mes** (línea de tiempo) y C · tipografía.
**Eligió B.**

- Rama nueva `feat/landing-mes` desde `main` (756ab14), con lo de `feat/landing-valor` encima. El aviso de bancos
  propios de §4 no se trajo: el plan 30 ya lo resolvió con el estado por banco (`no_emails`, `unreadable`). La
  migración de cupos pasó a ser la **000056**.
- Hero oscuro: "Un mes de tus finanzas. Horas de Excel: cero." y debajo un mes de ejemplo (marcado como ejemplo)
  que se arma solo al cargar: 142 movimientos anotados solos · 3 preguntas · 0 min digitando, y una línea de tiempo
  con día 3 (compra anotada), día 9 (nómina), día 17 ("¿Esto es Salud o Mercado?") y día 30 (ahorro del mes). Vertical
  en móvil, horizontal en PC.
- Al bajar, estilo krea y sin JS: títulos y tarjetas que suben al entrar en pantalla, la historia ("De dónde salió
  Topi") en letra grande que se va llenando, y una cinta de bancos que se mueve. Solo en navegadores con
  `animation-timeline: view()`; en los demás todo se ve quieto y completo.
- Para no perder rendimiento con las animaciones, Inter se carga sin bloquear la primera pintura (antes bloqueaba
  ~1,7 s en móvil) y el respaldo de la fuente pasó de `serif` a la del sistema.

## 9. Ajustes de JuanMa a la dirección B (24-nov-2026)

Le gustó la estructura del hero. Cambios pedidos:
- **El mes de ejemplo se reemplaza por una vitrina de preguntas** que Topi responde, con protagonismo: ¿Cuánto te falta
  por gastar? · ¿Cómo va tu flujo del mes? · ¿Estás cumpliendo tus presupuestos? (de gastos y de ingresos) · ¿Dónde está
  toda tu plata? (todas las cuentas en un lugar) · ¿En qué se te fue la plata? (historial para buscar) · ¿Cómo crecen
  tus balances y tu patrimonio? Una cada 4,5 s (ciclo de 27 s), cada una con su animación: barra de lo que queda,
  barras de entró/salió, barras por categoría con una pasada, tarjetas de cuentas, búsqueda con lista que corre y la
  línea del patrimonio que se dibuja. En PC la lista de preguntas a la izquierda resalta la activa con su barra de
  progreso; en móvil la pregunta va encima de cada escena. Montos marcados como "Ejemplo". Todo existe en la app
  (presupuestos de ingresos: `income_budget`).
- **"De dónde salió Topi" pasa a "Para qué sirve Topi"**: tres frases grandes que se llenan al bajar ("Para saber, sin
  anotar nada, a dónde se va tu plata." · "Para decidir con los números de hoy…" · "Para que ahorrar deje de ser un
  propósito…"), una línea sobre crecer y cuatro valores: Claridad, Control, Crecimiento y Tiempo.
- El resto de la página sigue igual; JuanMa lo revisa después.

## 10. Vitrina "Topi te dice" con componentes reales (24-nov-2026)

Pedido de JuanMa: cada pregunta muestra el componente REAL de la app que la responde, se puede elegir una pregunta (y
eso reinicia el tiempo) y el título es "Topi te dice". Quedó así:
- Cinco preguntas (se quitó "¿Dónde está toda tu plata?": con solo íconos no se entendía): ¿Cuánto te falta por
  gastar? (Ritmo del mes, `HomePaceCard`) · ¿Cómo va tu flujo del mes? (`HomeFlowCard`) · ¿Estás cumpliendo tus
  presupuestos? (`BudgetOverview` + `BudDashCategorieList`, que pasan solos de Gastos a Ingresos) · ¿En qué se te fue
  la plata? (filas reales de Movimientos, `TransactionRow`, exportada para esto) · ¿Cómo crecen tus balances y tu
  patrimonio? (`HomeNetWorthCard` + `NetWorthChart`).
- `components/landing/demo/DemoScenes.jsx` es un trozo aparte (`React.lazy`) que solo se descarga cuando la vitrina
  entra en pantalla: trae Redux de la app, recharts y moment sin tocar el bundle principal ni el HTML prerenderizado
  (ahí va un esqueleto del mismo tamaño). Store propio con datos de ejemplo relativos a hoy (`demoState.js`); los thunks
  no corren y, mientras está montada, axios rechaza todo pedido que no sea `/public/`. Todo inerte (no se navega).
- Cambia sola cada 6 s, se pausa con el puntero o el foco, y con `prefers-reduced-motion` no avanza sola. Cada escena se
  centra y, si no cabe (alto o ancho), se escala lo justo; la escala no cambia dentro de una escena.

## 11. Revisión de la oferta con Hormozi (propuesta, 24-nov-2026; falta el OK de JuanMa)

**Diagnóstico de la página de hoy** con la ecuación de valor (resultado soñado × probabilidad / tiempo × esfuerzo):

| Palanca | Hoy | Qué falta |
|---|---|---|
| Resultado soñado | "Horas de Excel: cero" vende quitar un dolor, no el sueño | El sueño es *llegar a fin de mes sabiendo exactamente cuánto puedes gastar y viendo crecer lo que ahorras* |
| Probabilidad | Cifras (7.400+, 85 %) y la vitrina real | Garantía concreta, comparación contra lo que la persona usa hoy, y que vea si funciona con *su* banco antes de registrarse |
| Tiempo | "en minutos" suelto | Prometer un plazo concreto: "en 3 minutos ves lo que va del mes" |
| Esfuerzo y sacrificio | "sin anotar nada" + qué lee y qué no | El sacrificio real es el miedo a dar el correo: va al frente, no en la mitad de la página |

**Propuesta de oferta: "Tu mes en automático"** (nombre MAGIC: resultado + plazo). Sin precios: el valor se ancla en
**tiempo devuelto y control**, no en plata.

1. *Hero*: "Sabe cada día cuánto puedes gastar. Sin anotar nada." Subtítulo: "Conecta tu correo en un minuto y en tres
   ves todo lo que va del mes: lo que gastaste, lo que te queda y cómo vas a cerrar."
2. *La pila de valor* (cada ítem con el tiempo o el problema que quita, todo existe hoy): lectura automática de cada
   movimiento · "Hoy puedes gastar" cada día · Por revisar (no inventa) · presupuestos de gastos e ingresos con su
   historia · proyección del mes · tarjetas por corte y cuotas · patrimonio mes a mes · resumen del mes por correo.
3. *Calculadora "¿Cuánto tiempo te devuelve Topi?"*: la persona dice cuántos movimientos tiene al mes y ve las horas que
   hoy le tomaría anotarlos y cruzarlos (supuesto visible, p. ej. 1 minuto por movimiento + 1 hora de cierre de mes).
   Es el ancla de valor sin hablar de precio.
4. *Comparación honesta* — Topi vs. Excel vs. apps que piden la clave del banco: tiempo al mes, qué acceso piden, si
   puedes desconectar, si te dicen cuánto puedes gastar hoy.
5. *"¿Topi lee mi banco?"*: un buscador en la landing con el catálogo (`/public/banks`): "Sí, ya lo leemos" o "Agrégalo
   con su remitente". Sube la probabilidad percibida justo antes del registro.
6. *Garantía Topi* (reversión de riesgo sin precio): solo lectura · desconectas en un clic · **si en 48 h no vemos
   movimientos de tu banco, te escribimos y lo resolvemos contigo** · **borras tu cuenta y tus datos desde la app, en un
   clic**.
7. *Escasez y urgencia reales*: "Beta · cupos limitados" (ya está).
8. *Objeciones como FAQ, en el orden en que aparecen*: "¿Es seguro darle acceso a mi correo?" primero.

**Decisiones que necesito de JuanMa antes de escribirlo:**
- **D7** ¿Prometemos acompañamiento humano en la beta ("si tu banco no aparece en 48 h, te escribimos y lo
  resolvemos contigo")? Es la garantía más fuerte, pero compromete tiempo del equipo.
- **D8** "Borrar mi cuenta" en la app: hoy es por correo. Para prometerlo en la garantía hay que construirlo primero
  (habeas data; OK explícito).
- **D9** Fundadores: Hormozi usaría "los primeros 30 son fundadores, para siempre" como urgencia. Choca con D6 y con
  "no se ofrece lo que no existe" (Plus). ¿Seguimos sin mencionarlo?
- **D10** El supuesto de la calculadora (minutos por movimiento) y si mostramos "horas que te devuelve" como cifra.

**Decisiones de JuanMa (24-nov-2026):** D7 no (no se promete ayuda de una persona del equipo); D8 no (no se construye
"Borrar mi cuenta": la garantía dice "pide borrar tu cuenta"); **D9 sí**: se menciona a los fundadores (revierte D6
solo en eso, sin hablar de Plus ni de precios); D10: la calculadora cuenta el tiempo de dejar registrados X movimientos a
mano (supuesto visible: un minuto por movimiento) contra Topi, que los refleja al instante en flujos, balances y
presupuestos.

## 12. Oferta implementada (24-nov-2026)

- Hero: "Sabe cada día cuánto puedes gastar. Sin anotar nada." + "Conecta tu Gmail u Outlook en un minuto y ve todo lo
  que va del mes…". Debajo, la nota de fundadores: "Los primeros 30 que conecten su correo serán fundadores de Topi:
  todo lo que lancemos, de por vida. Para quienes sigan usando Topi."
- "Tu mes en automático" (`Offer.jsx`, reemplaza "Lo que te llevas"): ocho resultados con lo que quitan ("Adiós a
  digitar", "Adiós al ¿me alcanza?"…) y la calculadora "¿Cuánto tiempo te devuelve Topi?" (20–300 movimientos al mes).
- "Topi frente a lo de siempre": anotar a mano / apps que piden la clave del banco / Topi, sin nombrar a nadie.
- "¿Topi lee mi banco?": buscador sobre el catálogo (`/public/banks`), sin tildes ni mayúsculas; si no está, cómo
  agregarlo con su remitente.
- Preguntas frecuentes: primero "¿Es seguro darle acceso a mi correo?" y nueva "¿Qué es ser fundador?". Cierre:
  "Quiero mi mes en automático".

## 13. Título dinámico y ajustes (24-nov-2026)

- Título: "Saber" fijo, lo que cambia cada 3 s (cuánto puedes gastar · si cumples tus presupuestos · cómo crece tu
  dinero) y "Sin anotar nada." fijo. Las tres frases comparten celda de grilla (el título no cambia de alto) y nunca se
  ven dos a la vez; lectores de pantalla y buscadores leen la frase completa. "si estás cumpliendo…" se acortó a "si
  cumples…" para que las tres quepan en una línea en PC.
- Subtítulo: "Con Topi es posible. Conecta el correo donde te llegan las notificaciones de tus movimientos y en un
  minuto ve todo lo que va del mes…". Sin el botón "Qué lee y qué no"; sin "Bancos" en el menú.
- La vitrina descarga los componentes reales solo cuando está en pantalla y la persona ya interactuó (puntero, toque,
  scroll o teclado): la primera carga no paga recharts ni moment (Lighthouse bajaba a 72–80 sin esto).

## 14. Ajustes (24-nov-2026)

- "Cómo funciona" va antes de "Para qué sirve Topi" y es compacto (una fila de tres pasos, ~290 px de alto en PC). El
  paso 2 ya no menciona los dígitos de la cuenta ("Tu banco y tus cuentas, para que cada movimiento caiga en su lugar").
- Se quitó la calculadora "¿Cuánto tiempo te devuelve Topi?" (revierte D10): anotar movimientos es una parte pequeña del
  tiempo que una persona gasta cuadrando cuentas y presupuestos, y el valor de Topi no está ahí. En la comparación, la
  fila pasa a "Tiempo cuadrando cuentas y presupuestos: horas cada mes / poco / cero".

## 15. Una sola sección de valor (24-nov-2026)

- Menú: solo Cómo funciona, Qué lee y Preguntas.
- "Para qué sirve Topi" y "Tu mes en automático" se fusionaron: las tres frases que se llenan al bajar, la línea sobre
  crecer y seis resultados con el valor que aportan (Claridad: cada movimiento anotado solo · Control: cuánto puedes
  gastar hoy y presupuestos de gastos e ingresos · Confianza: lo dudoso te lo pregunta · Tranquilidad: tarjetas por corte
  · Crecimiento: tu dinero mes a mes). Se quitaron los cuatro valores sueltos y los resultados repetidos.

## 16. Menos secciones y acceso con el mismo estilo (24-nov-2026)

- Se quitó "Topi frente a lo de siempre" (la comparación) y los enlaces del menú: arriba solo quedan Iniciar sesión y
  Crear cuenta.
- Iniciar sesión y Crear cuenta usan `components/auth/AuthLayout.jsx`: fondo oscuro del hero, logo y botón a la otra
  página arriba, formulario en una tarjeta con los campos y botones de la landing, y en PC lo que Topi promete (beta,
  "Saber cuánto puedes gastar. Sin anotar nada.", tres resultados —cada compra anotada sola, cuánto puedes gastar hoy,
  tu dinero creciendo mes a mes— y fundadores). Las garantías de seguridad no van ahí: en el momento de entrar sonaban a
  riesgo; siguen en la landing. La lógica de los formularios no
  cambió (ahora envían con Enter, `onSubmit` del formulario).

## Criterios de aceptación

Verificados el 16-nov-2026 en `feat/landing-valor` (sin commit ni merge). Evidencia local: Postgres 16 propio en :54452
(`topi_test` con `schema_v17.sql` para integración, `topi_e2e` con el usuario ficticio `landing.prueba@topi.test`), API
de la rama con `MAIL_PROVIDER=log`, build estático servido como nginx. Capturas y Lighthouse en `topiv2/capturas-landing/`.

- [x] Hero con la vitrina de preguntas en CSS puro (`QuestionsDemo.jsx`, clases `qd-*`; revelados `lp-*`),
      `prefers-reduced-motion` estático (queda la primera escena). (24-nov, §8 y §9.)
- [x] Sin "Colombia" como mercado (solo "Hecho en Colombia" en el pie); "varias monedas" sin prometer cualquiera;
      solo la limitación estructural (el banco tiene que avisar por correo). Título, descripción y Open Graph sin
      "Colombia" ni "digitar".
- [x] Cero precios, Plus, Apoyar, "gratis", cobros, fundadores ni cifrado (tests de jest); sin testimonios: cifras de
      `GET /public/stats` (redondeadas hacia abajo, caché 1 h; el prerender usa 7.400+ / 85 % del dump del 17-oct).
- [x] Bancos propios: lo resolvió el plan 30 en `main` (estado por banco con su remitente); aquí solo queda la ayuda
      del campo «De» en el formulario de banco.
- [x] Cupos de Google (D3): migración 000056 (`down`→`up` probado), avisos cada 10 y semanal desde 30 (en local con 86
      usadas: "Ya van 80", "ya no ofrece Gmail nuevas" y el semanal, una vez cada uno), `GET /email/gmail-capacity`,
      `auth-url` 409 para Gmail nuevo y 200 con `reconnect` propio o con Outlook; aviso en Conectar correo, reconectar
      sin bloqueo, 86/100 en Panel → Lanzamiento. Política: el hash que se conserva.
- [x] `LandingPage` pura; prerender ok (1.303 palabras); `main.js` sin `redux/actions`, `helpers.js` ni moment.
- [x] Lighthouse móvil 12.2.1 (24-nov, con la vitrina de componentes reales, la oferta y el título dinámico):
      rendimiento 98–99, accesibilidad 100, buenas prácticas 100, SEO 100; FCP 0,9 s, LCP 2,0–2,3 s, TBT 20 ms,
      CLS ≤ 0,034. Capturas móvil y PC, claro y oscuro, en
      `topiv2/capturas-landing/mes/`.
- [x] `go test ./...` verde; integración de repositorios verde; jest 197/197 (`App.test.js` falla igual que en `main`); integración con las migraciones de `main` + 000056;
      `npm run build` verde.
- [ ] Cifra de movimientos de producción confirmada por JuanMa (el prerender dice 7.400+; la API pone la real).
- [ ] En Coolify: `GMAIL_OAUTH_BASELINE` y `GMAIL_OAUTH_BASELINE_AT` con lo que diga Google el día del deploy.

Pendiente fuera de esta rama: la sección "Así se ve Topi" con capturas reales (necesita datos de demo), más monedas,
moneda base en la bienvenida, zona horaria por usuario y evaluar el prompt con bancos de otros países.
