---
name: plan-feature
description: Planifica una issue de GitHub (por número o URL) antes de tocar código. Obtiene la issue con gh, sigue la plantilla común del equipo, guarda el plan en plans/<num_issue>-<breve-descripcion>.md y lo publica como comentario de la issue. Úsala cuando pidan planificar, diseñar o preparar una feature, un bug fix o una issue.
argument-hint: <num_issue | url_issue>
allowed-tools: Read, Glob, Grep, Write, Bash(git log:*), Bash(git status:*), Bash(gh issue view:*), Bash(gh issue comment:*), Bash(gh auth status:*)
---

# plan-feature

Genera un plan de implementación con el formato común del equipo a partir de una issue de GitHub. **No implementes nada**: el resultado de esta skill es el archivo del plan y su publicación como comentario en la issue.

Petición del usuario: $ARGUMENTS

## Pasos

1. **Obtén la issue con `gh`**
   - Extrae de la petición el número de issue (`42`, `#42`) o su URL (`https://github.com/<owner>/<repo>/issues/42`).
   - Si no hay número ni URL, pregúntalo antes de continuar (no lo inventes ni lo deduzcas de la descripción).
   - Descarga la issue: `gh issue view <num_o_url> --json number,title,body,labels,state,url,comments`. `gh` acepta tanto el número (usa el repo actual) como la URL completa.
   - Si `gh` falla (no autenticado, issue inexistente, sin acceso), muestra el error, sugiere `gh auth login` si aplica y detente.
   - Si la issue está cerrada (`state: CLOSED`), avisa y pregunta si continuar.
   - Usa el título, el cuerpo, las etiquetas y los comentarios como fuente de la petición. Clasifícala como `feature` o `bug` (las etiquetas `bug` / `enhancement` ayudan).

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

5. **Publica el plan en la issue**
   - Comenta la issue con el contenido del archivo: `gh issue comment <num_o_url> --body-file plans/<num_issue>-<breve-descripcion>.md`. Usa `--body-file` (no `--body`) para no romper el markdown con el escapado de la shell.
   - Si ya publicaste un plan en esa issue antes (un comentario previo del mismo autor que empieza por el título del plan), pregunta si añadir uno nuevo o editar el último con `gh issue comment <num_o_url> --edit-last --body-file ...`.
   - Si el comentario falla, informa del error; el archivo local del plan sigue siendo válido.

6. **Resumen final**: muestra la ruta del archivo creado, la URL del comentario publicado, el número de tareas y las dudas abiertas que necesiten respuesta del usuario.
