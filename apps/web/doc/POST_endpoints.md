# Documentación de Endpoints: POST

Este archivo contiene la documentación de todos los endpoints de tipo **POST** (Creación, Envíos y Mutaciones no Idempotentes) en la aplicación, junto con un resumen de su funcionamiento y respuestas esperadas.

## **Usuarios y Autenticación (`auth.js`)**

### `POST /users/signup`
*   **Descripción:** Registra un nuevo usuario en la base de datos.
*   **Cuerpo (Request):** `name`, `last_name`, `email`, `password`, `confirm_password`
*   **Respuesta:** Devuelve `201 Created` en éxito o lista de errores.

### `POST /users/login`
*   **Descripción:** Inicio de sesión para usuario existente por contraseña o por un códido de confirmación único proveniente de un social login oauth.
*   **Cuerpo (Request):** `email`, `password` (o `code` para inicio de sesión de terceros).
*   **Respuesta:**
    ```json
    {
      "token": "eyJ...",
      "user": {
        "name": "Juanma",
        "last_name": "Patino",
        "email": "user@example.com",
        "verified": true
      },
      "user_extra_data": {
        "user_id": "...", 
        "onboarding_completed": true
      }
    }
    ```

### `POST /users/confirm`
*   **Descripción:** Confirma o activa una cuenta verificando un código.
*   **Cuerpo (Request):** `code`, `email`
*   **Respuesta:** `204 No Content` o `200 OK` en caso de activar correctamente.

### `POST /users/resend-confirmation`
*   **Descripción:** Re-envía el correo electrónico de confirmación de cuenta.
*   **Cuerpo (Request):** `email`

### `POST /users/forgot-password`
*   **Descripción:** Solicita un reseteo de la contraseña de un usuario mediante envío de un correo con un token o código.
*   **Cuerpo (Request):** `email`

### `POST /user-extra/create`
*   **Descripción:** Punto final inicial para crear la data relacional extra del usuario tras la confirmación de la cuenta, que incluye la zona horaria y whatsapp.
*   **Cuerpo (Request):** `utc_offset`, `whatsapp`.

### `POST /init/resources`
*   **Descripción:** Crea e inserta los recursos (categorías, cuentas, bancos defaults) de inicio automáticos (Primeros pasos / onboarding) para una cuenta nueva.
*   **Cuerpo (Request):** `{}`

---

## **Flujo de Caja (`cashflow.js`)**

### `POST /categories/create`
*   **Descripción:** Crea una nueva categoría con su presupuesto propio mensual y su configuración de ingresos / egresos.
*   **Cuerpo (Request):** `name`, `budget`, `emoji`, `income` (booleano)
*   **Respuesta:**
    ```json
    {
      "data": { "id": 124 }
    }
    ```

### `POST /accounts/create`
*   **Descripción:** Registra una nueva cuenta financiera asignada a un banco.
*   **Cuerpo (Request):** `name`, `last_four_digits`, `type_id`, `bank_id`, `initial_balance`, `"email_id"` (opcional para automatización).

### `POST /transactions/create`
*   **Descripción:** Registra una nueva transacción monetaria en el sistema (ingreso o gasto).
*   **Cuerpo (Request):** `category_id`, `account_id`, `description`, `expense` (booleano), `amount`, `date`

### `POST /banks/create`
*   **Descripción:** Registra un banco personalizado para el usuario que no pertenece a la lista global.
*   **Cuerpo (Request):** `name`, `email`
*   **Respuesta:**
    ```json
    {
      "data": { "id": 56 }
    }
    ```

---

## **Reportes y Análisis (`reports.js`)**

### `POST /analysis/balance-history`
*   **Descripción:** Recupera la información calculada del desempeño e histórico de balances pasados y futuros a nivel general con filtros.
*   **Cuerpo (Request):** `filter`

### `POST /analysis/categories-report`
*   **Descripción:** Análisis de consolidado del reporte de gastos o los ingresos generales vs. lo agendado en los presupuestos.
*   **Cuerpo (Request):** `date_filter`, `sort_by`
*   **Respuesta (Ejemplo de Expenses Report):**
    ```json
    [
      {
        "category_id": 44,
        "name": "Inversiones Variable",
        "emoji": "1f409",
        "value": -30002336,
        "budget": -2500000,
        "usage": 1200.09,
        "left": -27502336
      }
    ]
    ```

### `POST /analysis/accounts-report`
*   **Descripción:** Genera un análisis general sobre los reportes de ingresos, balance, retiros, y estado a nivel de una o un grupo de cuentas por un periodo de fechas seleccionadas.
*   **Cuerpo (Request):** `start`, `end`, `accounts_type`, `accounts`
*   **Respuesta (Poblado en `account_activated_stats`):**
    ```json
    {
      "balance": { "value": -3122955.52 },
      "income": { "value": 0 },
      "expenses": { "value": 0 },
      "savings": { "value": 0 }
    }
    ```

---

## **Conexiones (`conexions.js`)**

### `POST /email/register?code={code}`
*   **Descripción:** Registra un flujo o correo por código token oauth o consent URL usando un proveedor como Gmail o Outlook.
*   **Cuerpo (Request):** `email`, `provider`

### `POST /email/read`
*   **Descripción:** Ejecuta una carga manual u orquestada (trigger) para intentar leer directamente al correo inbox relacionado con las cuentas dadas buscando nuevas transacciones de bancos.
*   **Cuerpo (Request):** `{"account_ids": [id]}`

### `POST /email/reset`
*   **Descripción:** Resetea el tracker flag the lectura de email desde el onboarding (`read_email`).
*   **Cuerpo (Request):** `{"user_id": "f4e8e4a8..."}`
