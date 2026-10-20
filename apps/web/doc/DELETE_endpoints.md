# Documentación de Endpoints: DELETE

Este archivo agrupa los diferentes endpoints de mutación destructiva (**DELETE**) en los que se purgan registros o se desvinculan elementos de cuenta a cuenta.

## **Flujo de Caja (`cashflow.js`)**

### `DELETE /categories/{id}`
*   **Descripción:** Remueve la categoría y cualquier rastro de la misma que tenga ID `id`.

### `DELETE /accounts/{id}`
*   **Descripción:** Realiza un borrado en una cuenta financiera seleccionada por medio del parámetro de la llave de ID, purgando así su registro del estado.

### `DELETE /transactions/{id}`
*   **Descripción:** Elimina del historial de ingresos/egresos la transacción con el ID dado y corrige y re-balancea el balance monetario por ende de la cuenta afectada.

### `DELETE /banks/{id}`
*   **Descripción:** Elimina definitivamente algún Banco Personalizado listado bajo el control del usuario.

---

## **Conexiones (`conexions.js`)**

### `DELETE /email/{email}`
*   **Descripción:** Desvincula un correo electrónico de OAuth y detiene el flujo de lecturas de mensajería para automatización.
*   **Nota:** Se pasa en URL no solo ID, se usa la cuenta de correo identificadora en string para la desconexión.
