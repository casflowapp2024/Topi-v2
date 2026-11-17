# 31. Onboarding: progreso de lectura, presupuesto y revisión sin salir del Inicio

Rama `feat/lanzamiento`, después del plan 30. Sale de la segunda prueba de JuanMa en local (17-nov), desde cero.
Cada bloque va en un commit con sus tests, sin push, y se verifica en el entorno `ob-*`.

Hallazgos que resuelve:
1. Mientras lee, no se sabe si sigue leyendo o si ya terminó.
2. Crear el presupuesto obliga a ir a Presupuestos y volver; en el onboarding se pierde el hilo.
3. Para alguien que no conoce Topi, la tarjeta Por revisar no explica qué hay que hacer: categorías y cuotas.
   Es más fácil entender las categorías si primero se crea un presupuesto.

## Bloque A. Progreso de lectura y fin claro

- **El worker publica el avance del job** en una columna nueva `email_jobs.progress` (jsonb, migración 000052 con
  `down`):
  - `{"listed": N}` apenas lista los correos;
  - `{"listed": N, "processed": M, "created": K}` en cada tanda (`_flush`, cada 3) y al final.

  Solo conteos: nada del contenido.
- **`GET /email/status` agrega por conexión `job`**, del último job prioritario de las últimas 24 h:
  `{state: queued | running | done | failed, listed, processed, created, finished_at}`.
- **App, en el checklist y en el Inicio:**
  - `queued`: "Preparando la lectura…".
  - `running`: "Leyendo 12 de 22 correos · 5 movimientos", con barra de progreso. Consulta cada 3 s.
  - `done`, en los 10 min siguientes:
    - "Listo: encontramos 21 movimientos de noviembre", con el botón del siguiente paso;
    - si no hubo movimientos, el aviso del banco del plan 30.
  - `failed`: "No pudimos terminar de leer; lo reintentamos solos en unos minutos". El worker ya reintenta.
- Tests:
  - worker: el progreso se escribe en cada tanda;
  - repositorio: el estado del job;
  - front: los tres textos y la barra.

## Bloque B. Orden del checklist: presupuesto antes de revisar

- **Nuevo orden:**
  1. Conecta tu correo;
  2. Recibe tu primer movimiento leído;
  3. **Pon tu primer presupuesto**;
  4. **Revisa tus movimientos**.

  Los pasos son una lista cerrada (`domain.OnboardingSteps`): cambia el orden, no los ids. Así los eventos
  `onboarding_step_completed` que ya existen siguen valiendo.
- Textos nuevos:
  - Paso 3: "Elige una categoría, como Comida o Transporte, y cuánto quieres gastar al mes."
  - Paso 4: "Topi pone una categoría a cada movimiento. Confirma las que no supo y dinos si alguna compra fue a
    cuotas."
- Revisar sigue marcándose con la primera revisión (D1 del plan 30).

## Bloque C. Crear el presupuesto sin salir del Inicio

- **Modal `BudgetQuickCreate`**:
  - elige una categoría que ya existe (las que tienen gasto este mes van primero, con lo gastado al lado) o crea una
    nueva, con nombre, emoji y monto;
  - guarda con `PUT /categories/:id/budgets` o `POST /categories/create`;
  - reutiliza `EditCreateCategoryForm` y el selector de emojis.
- **Se abre desde:**
  - el paso 3 del checklist;
  - la tarjeta Presupuestos vacía;
  - "Crear presupuesto" en la tarjeta de gasto.

  Las tres usan `?crear-presupuesto=1`, como `?crear-cuenta=1`.
- Al guardar: la señal `budget`, que actualiza checklist, Presupuestos y "Hoy puedes gastar", y "Presupuesto
  creado".
- Tests: abrir desde el checklist, elegir una categoría existente, crear una nueva y el paso que se tacha.

## Bloque D. Modal "Revisar movimientos" (Inicio y onboarding)

- **Un movimiento a la vez**, con contador ("3 de 21") y barra.
- **Por qué está ahí, en una línea:**
  - "Topi no estaba seguro de la categoría";
  - "¿Esta compra fue a cuotas?";
  - "¿De qué cuenta salió este pago?";
  - "Banco nuevo: confirma que el monto esté bien".
- **Categorías como botones grandes:**
  - la sugerida primero;
  - las que tienen presupuesto, marcadas;
  - "+ Nueva categoría" en el mismo modal (sin el problema del clic de afuera).
- **"Aplicar a todos los de <comercio>"** cuando hay más movimientos pendientes con la misma descripción
  normalizada. Usa los endpoints de siempre, uno por movimiento.
- **Cuotas:** los mismos botones de hoy (1, 3, 6, 12, Otra) con una frase de ayuda.
- **Saltar** deja el movimiento para después. **Terminar** cierra y muestra "Revisaste N; quedan M".
- **Se abre desde:**
  - el paso 4 del checklist;
  - un botón "Revisar todo" en la tarjeta Por revisar (que sigue igual para revisar uno a uno).

  Ambos usan `?revisar=1`.
- La cola sale de la misma lógica de `ReviewInbox`: verificar, cuotas, pagos sin contraparte y transferencias.
  Se extrae a un hook (`useReviewQueue`) para no duplicarla.
- Tests: recorrido de 3 movimientos, aplicar a todos los del mismo comercio, crear una categoría desde el modal y
  saltar.

## Fuera de este plan

- Notificaciones push o por correo de "terminamos de leer".
- Reglas automáticas por comercio. "Aplicar a todos" solo afecta a los pendientes de hoy.

## Verificación

- `go test ./...` (con integración), `npm test` y pytest del worker.
- En `ob-*`, desde una base en cero, el recorrido completo:
  - registro;
  - conectar el correo;
  - crear la cuenta;
  - ver el progreso hasta "Listo";
  - crear el presupuesto en el Inicio;
  - revisar en el modal;
  - "¡Listo!".
