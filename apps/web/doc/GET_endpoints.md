# Documentación de Endpoints: GET

Este archivo contiene la documentación de todos los endpoints de tipo **GET** encontrados en la aplicación, junto con ejemplos de las respuestas o estructuras de datos basadas en los estados en Redux.

## **Usuarios y Autenticación (`auth.js`)**

### `GET /users/`
*   **Descripción:** Consulta la información básica del usuario autenticado.
*   **Headers:** `Authorization: Bearer <token>`
*   **Respuesta (Ejemplo basado en Redux):**
    ```json
    {
      "name": "Juanma",
      "last_name": "Patino",
      "email": "user@example.com",
      "verified": true
    }
    ```

### `GET /user-extra`
*   **Descripción:** Obtiene los datos adicionales del usuario, como configuración general y progreso de onboarding.
*   **Headers:** `Authorization: Bearer <token>`
*   **Respuesta (Ejemplo basado en Redux):**
    ```json
    {
      "user_id": "f4e8e4a8-50e1-704a-ba18-c1901076ab51",
      "email": "user@example.com",
      "name": "Juanma",
      "last_name": "Patino",
      "utc_offset": 0,
      "whatsapp": "3114917158",
      "whatsapp_state": "pending",
      "onboarding_completed": true,
      "read_email": false,
      "config": {
        "dark_mode": true
      }
    }
    ```

### `GET /users/social-auth-url`
*   **Descripción:** Obtiene la URL de redirección para inicio de sesión social (ej. Google).
*   **Headers:** `Authorization: Bearer <token>`
*   **Respuesta:**
    ```json
    {
      "data": {
        "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
      }
    }
    ```

---

## **Flujo de Caja (`cashflow.js`)**

### `GET /categories/list?skip={skip}&limit={limit}`
*   **Descripción:** Obtiene la lista paginada de todas las categorías disponibles e ítems del usuario.
*   **Respuesta (Ejemplo basado en Redux):**
    ```json
    {
      "data": {
        "categories": {
          "items": [
            {
              "id": 12,
              "name": "Comida",
              "budget": 500000,
              "editable": true,
              "emoji": "1f354",
              "income": false,
              "isDefault": false
            }
          ],
          "default": [
            {
              "id": -1,
              "name": "Comida",
              "emoji": "1f354",
              "userCat": true,
              "isDefault": true,
              "editable": true,
              "income": false
            }
          ],
          "total": 25,
          "skip": 0,
          "limit": 50
        }
      }
    }
    ```

### `GET /account-types/list?skip={skip}&limit={limit}`
*   **Descripción:** Lista todos los tipos de cuentas admitidos.
*   **Respuesta:**
    ```json
    {
      "items": [
        { "id": 1, "name": "Cuenta Ahorros" },
        { "id": 4, "name": "Tarjeta de Crédito" }
      ],
      "total": 4,
      "skip": 0,
      "limit": 20
    }
    ```

### `GET /accounts/list?skip={skip}&limit={limit}`
*   **Descripción:** Obtiene la lista de cuentas creadas por el usuario.
*   **Respuesta (Ejemplo):**
    ```json
    {
      "items": [
        {
          "id": 19,
          "name": "Bbva Nomina Ahorros",
          "last_four_digits": "7194",
          "initial_balance": 42300000,
          "bank": { "id": 20, "name": "BBVA" },
          "type": { "id": 1, "name": "Cuenta Ahorros" },
          "email": { "id": null, "email": "", "provider": "", "active": false, "error": null },
          "automation": { "configured": false }
        }
      ],
      "total": 8,
      "skip": 0,
      "limit": 20
    }
    ```

### `GET /transactions/list?skip={skip}&limit={limit}&{filters}`
*   **Descripción:** Obtiene la lista de transacciones del usuario, con posibilidad de filtros como categoría, fecha o si están automatizadas.
*   **Respuesta (Ejemplo):**
    ```json
    {
      "items": [
        {
          "id": 4444,
          "description": "Dlo*didi",
          "expense": true,
          "amount": 14100,
          "date": "2026-02-22 09:47:42 -0500",
          "automated": true,
          "should_verify": false,
          "checked": false,
          "category": { "id": 13, "name": "Transporte", "emoji": "1f697", "income": false },
          "account": {
            "id": 20,
            "name": "TC Bbva Platinum",
            "last_four_digits": "0556",
            "bank": { "id": 20, "name": "BBVA" },
            "type": { "id": 4, "name": "Tarjeta de Crédito" },
            "email_id": null
          }
        }
      ],
      "total": 423,
      "skip": 0,
      "limit": 10,
      "news": 86,
      "read_email_onboarding": false
    }
    ```

### `GET /banks/list?skip={skip}&limit={limit}`
*   **Descripción:** Lista los bancos del usuario y default banks.
*   **Respuesta:**
    ```json
    {
      "data": {
        "banks": {
          "items": [
             { "id": 17, "name": "Lulo Bank", "email": "notificaciones@lulobank.com", "is_automated": true, "isDefault": false }
          ],
          "default": [
             { "id": -1, "name": "BBVA", "userBank": false, "isDefault": true, "is_automated": true }
          ],
          "total": 10,
          "skip": 0,
          "limit": 20
        }
      }
    }
    ```

### `GET /banks/official`
*   **Descripción:** Obtiene una lista de bancos oficialmente soportados.
*   **Respuesta:**
    ```json
    {
      "data": {
        "banks": ["BBVA", "Lulo Bank", "Bancolombia"]
      }
    }
    ```

---

## **Reportes y Análisis (`reports.js`)**

### `GET /analysis/financial-report?date={YYYY-MM-DD}`
*   **Descripción:** Genera el balance y reporte financiero básico de un mes y año dados.
*   **Respuesta:**
    ```json
    {
      "savings_balance": { "value": 138538627.93, "vs_past_month": 0 },
      "income": { "value": 0, "vs_past_month": null },
      "expenses": { "value": -31753546, "vs_past_month": 230.47 },
      "credits_balance": { "value": -48563965.26, "vs_past_month": 188.89 }
    }
    ```

### `GET /analysis/accounts-balance`
*   **Descripción:** Reporte general de los balances de cada cuenta.
*   **Respuesta:** Listado poblado en `balance_by_account` en Redux.
    ```json
    [
      {
        "account_id": 65,
        "name": "Hapi Trade",
        "bank": "hapi",
        "last_four_digits": "0000",
        "balance": 52000000
      }
    ]
    ```

### `GET /analysis/financial-analysis?date={YYYY-MM-DD}`
*   **Descripción:** Historial de tablero o dashboard (Data acumulada por días o mes para el gráfico).
*   **Respuesta:** Poblado en `history_dash` en Redux.

### `GET /analysis/category-analysis?category_id={id}&date={YYYY-MM-DD}`
*   **Descripción:** Evolución mensual de una categoría de gasto en específico y su presupuesto de la historia.
*   **Respuesta:** Poblado en `history_category` en Redux.

### `GET /analysis/account-analysis?account_id={id}&date={YYYY-MM-DD}`
*   **Descripción:** Historial financiero individual para una cuenta por mes en específico.
*   **Respuesta:** Poblado en `history_accounts_by_month`.

---

## **Conexiones (`conexions.js`)**

### `GET /email/auth-url?provider={provider}`
*   **Descripción:** Obtiene la URL a la que se debe conectar al usuario para permitir la automatización por correo (Ej: `gmail`, `outlook`).
*   **Respuesta:**
    ```json
    {
      "data": { "url": "https://url-consentimiento..." }
    }
    ```

### `GET /email/list?skip={skip}&limit={limit}`
*   **Descripción:** Lista de correos conectados a la plataforma del usuario.
*   **Respuesta:**
    ```json
    {
      "emails": [
        {
          "id": 62,
          "email": "user@example.com",
          "active": true,
          "provider": "gmail",
          "error": null
        }
      ],
      "total": 8,
      "skip": 0,
      "limit": 20
    }
    ```
