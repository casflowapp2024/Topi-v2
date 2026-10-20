# Evaluación futura: Jev (TypeSafe) en lugar de Gemini Flash-Lite

## Qué es Jev
Modelo "System One" de TypeSafe: recibe un `state` (texto u objeto) y preguntas tipadas, y responde **solo** con
`noul` (sí/no con probabilidad), `choice` (una opción entre ≤255, con probabilidades) o `score` (nivel ordinal).
**No genera texto ni extrae valores** (montos, fechas, descripciones). Contexto de 32k tokens, latencia de 70 a 500 ms,
$0.042 por millón de tokens de entrada y salida gratis. Disponible en Cloudflare Workers AI (`typesafe/jev`, sin retención de datos)
y en acceso anticipado vía TypeSafe. Soporte de español: no documentado.

## Qué podría hacer en Topi
| Tarea | Jev | Alternativa |
|---|---|---|
| ¿Es una transacción confirmada? (excluye "en proceso", puntos, cancelaciones) | ✅ `noul` | — |
| ¿Entrada o salida? | ✅ `choice` | — |
| ¿A qué cuenta pertenece? | ⚠️ `choice` entre las cuentas del usuario | Lo confiable son los últimos 4 dígitos (regex) |
| Monto | ❌ | Regex por banco + `parse_amount` (ya existe) |
| Fecha | ❌ | Header `Date` del correo |
| Descripción / comercio | ❌ | Regex por banco |
| Baja confianza → `should_verify` | ✅ probabilidades calibradas | — |

→ Jev + parsers regex para los 9 bancos (varias plantillas por banco, que cambian sin aviso).

## Costo (volumen actual: ~430 transacciones automáticas/mes, ~1.000 correos/mes)
- Gemini Flash-Lite: ~3k tokens/correo → 3M entrada × $0.10 + ~0.15M salida × $0.40 ≈ **US$0.36/mes**.
- Jev: ~3M × $0.042 ≈ **US$0.13/mes**.
- Ahorro ≈ **US$0.25/mes (~US$3/año)**. El costo de construir y mantener los parsers regex es mucho mayor.

## Cuándo sí valdría la pena
- Si el volumen crece 1.000× (ahí el ahorro serían cientos de dólares al mes).
- Si se quiere confianza calibrada para decidir `should_verify` mejor que hoy.
- Si Gemini presenta errores de clasificación medibles que Jev resuelva.

## Cómo evaluarlo sin riesgo (cuando toque)
1. Implementar `JevRegexExtractor` detrás de la interfaz `TransactionExtractor` (Fase 3).
2. Modo sombra: en cada correo correr ambos, usar el resultado de Gemini y registrar las diferencias (sin guardar el cuerpo).
3. Medir con los fixtures anonimizados y con 1 mes de sombra: precisión de "es transacción", tipo, cuenta y monto.
4. Cambiar `WORKER_EXTRACTOR` solo si iguala o supera a Gemini.
