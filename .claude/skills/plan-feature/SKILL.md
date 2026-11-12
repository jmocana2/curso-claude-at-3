---
name: plan-feature
description: Planifica una nueva funcionalidad o el arreglo de un error antes de tocar código, siguiendo la plantilla común del equipo, y guarda el plan en plans/<num_issue>-<breve-descripcion>.md. Úsala cuando pidan planificar, diseñar o preparar una feature, un bug fix o una issue.
argument-hint: <num_issue> <descripción de la funcionalidad o del error>
allowed-tools: Read, Glob, Grep, Write, Bash(git log:*), Bash(git status:*)
---

# plan-feature

Genera un plan de implementación con el formato común del equipo. **No implementes nada**: el resultado de esta skill es solo el archivo del plan.

Petición del usuario: $ARGUMENTS

## Pasos

1. **Datos de entrada**
   - Extrae de la petición el número de issue y la descripción de lo que se pide.
   - Si falta el número de issue, pregúntalo antes de continuar (no lo inventes).
   - Clasifica la petición como `feature` o `bug`.

2. **Analiza el código**
   - Lee `CLAUDE.md` y la documentación de `docs/` relacionada con la petición (por ejemplo, `docs/api/api-pagination.md` si afecta a endpoints GET paginados).
   - Localiza los archivos implicados respetando la arquitectura por capas: `controllers/`, `services/`, `repositories/`, `models/`, `utils/`, y `db.js` / `index.js`.
   - Si es un bug, identifica la causa probable y dónde se reproduce.

3. **Redacta el plan** rellenando **todas** las secciones de [plantilla.md](plantilla.md), sin cambiar su orden ni sus títulos:
   - **Objetivo**: qué se quiere conseguir y por qué, en 1-3 frases.
   - **Alcance**: qué entra y, explícitamente, qué queda fuera.
   - **Archivos afectados**: ruta, tipo de cambio (crear / modificar / eliminar) y motivo.
   - **Tareas**: lista de checkboxes ordenada; cada tarea debe poder hacerse en **5-10 minutos**. Si una tarea es más grande, divídela. Incluye tareas de tests (vitest), lint (eslint) y formato (prettier) cuando apliquen.
   - **Criterios de aceptación**: comprobables y verificables (código HTTP esperado, respuesta, comportamiento), que deben cumplirse para dar la tarea por terminada.
   - **Dudas y decisiones**: al final, toda duda abierta y toda decisión que hayas tomado por tu cuenta, con su justificación. Si no hay, escribe "Ninguna".
   - Respeta las convenciones del proyecto: funciones en `snake_case`, código y mensajes en español.

4. **Guarda el plan**
   - Ruta: `plans/<num_issue>-<breve-descripcion>.md` (crea la carpeta `plans/` si no existe).
   - `<breve-descripcion>`: kebab-case, minúsculas, sin tildes ni ñ, 2-5 palabras. Ejemplo: `plans/42-paginar-vendehumos.md`.
   - Si el archivo ya existe, pregunta antes de sobrescribirlo.

5. **Resumen final**: muestra la ruta del archivo creado, el número de tareas y las dudas abiertas que necesiten respuesta del usuario.
