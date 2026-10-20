# Documentación de Endpoints: PUT

Este archivo documenta todas las llamadas de tipo **PUT** (usadas habitualmente para modificaciones y actualizaciones de los entes de registros).

## **Usuarios y Autenticación (`auth.js`)**

### `PUT /user-extra`
*   **Descripción:** Edita o actualiza la configuración base y data adicional del usuario (tales como onboading, moneda, zona horaria, tema oscuro, idioma).
*   **Headers:** `Authorization: Bearer <token>`
*   **Cuerpo (Request):**
    `utc_offset`, `whatsapp`, `onboarding_completed`, `birthday`, `local_currency`, `language`, `config: {}`

### `PUT /users/forgot-password/confirm`
*   **Descripción:** Endpoint decisivo para confirmar y cambiar la cuenta y contraseña vieja mediante el respectivo código del correo de restablecimiento de contraseña.
*   **Cuerpo (Request):** `email`, `password`, `confirm_password`, `code`

---

## **Flujo de Caja (`cashflow.js`)**

### `PUT /categories/{cat_id}`
*   **Descripción:** Modifica el presupuesto, nombre, ingreso configurado, y el emoji de una categoría guardada usando el ID del item a modificar en la URL.
*   **Cuerpo (Request):**  `name`, `budget`, `emoji`, `income`

### `PUT /accounts/{tran_id}` (Actualización de Cuentas)
*   **Descripción:** Endpoint de backend para aplicar modificaciones a datos y montos de una cuenta, o añadirle/quitarle notificaciones por la automatización de un banco asociado.
*   **Cuerpo (Request):** `name`, `last_four_digits`, `type_id`, `bank_id`, `initial_balance`, `email_id`

### `PUT /transactions/{tran_id}`
*   **Descripción:** Actualiza todos los valores y estados (incluyendo categorización o monto) de una transacción individual (Gastos o ingresos loggeados por bancos o manualmente).
*   **Cuerpo (Request):** `category_id`, `account_id`, `description`, `expense`, `amount`, `date`, `checked`, `should_verify`

### `PUT /banks/{id}`
*   **Descripción:** Actualiza los datos generales de un Banco Personalizado (Generalmente su nombre de asociación y un email del remitente de mensajería).
*   **Cuerpo (Request):** `name`, `email`
