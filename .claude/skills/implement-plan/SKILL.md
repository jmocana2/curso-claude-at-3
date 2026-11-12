---
name: implement-plan
description: Implementa el plan publicado como comentario en una issue de GitHub (por número o URL), obtenido con gh. Trabaja en uno o varios git worktree dentro de .claude/worktrees con la rama <num_issue>-<breve-descripcion> creada desde development, sigue TDD estricto (rojo → verde → refactor) con un commit por tarea y termina abriendo una pull request para revisión, sin mergearla. Úsala cuando pidan implementar, ejecutar o llevar a cabo un plan o una issue.
argument-hint: <num_issue | url_issue>
---

# implement-plan

Implementa el plan de una issue de GitHub siguiendo **TDD estricto**, con **un commit por tarea**, en un **git worktree** aislado, y deja una **pull request** abierta para revisión.

Issue solicitada: $ARGUMENTS

## 1. Obtén el plan de la issue con `gh`

- Extrae de `$ARGUMENTS` el número de issue (`42`, `#42`) o su URL (`https://github.com/<owner>/<repo>/issues/42`). Si no hay ninguno, pregúntalo (no lo adivines).
- Descarga la issue y sus comentarios: `gh issue view <num_o_url> --json number,title,state,url,comments`.
  - Si `gh` falla (no autenticado, issue inexistente, sin acceso), muestra el error, sugiere `gh auth login` si aplica y detente.
  - Si la issue está cerrada, avisa y pregunta si continuar.
- Localiza el plan entre los comentarios: es el que sigue la plantilla de la skill `plan-feature` (empieza por `# #<num_issue> — <título>` y contiene las secciones `## Objetivo`, `## Tareas` y `## Criterios de aceptación`). Si hay varios, usa el **más reciente**. Si no hay ninguno, detente e indica que primero hay que planificarla con `/plan-feature <num_issue>`.
- Lee el plan completo, `CLAUDE.md` y la documentación de `docs/` que mencione.
- Si la sección **Dudas y decisiones** contiene preguntas sin resolver, muéstralas y pide respuesta antes de empezar.

## 2. Prepara la rama y el worktree

Sigue las reglas de la skill `git` antes de cualquier comando git que no sea de solo lectura. **No toques el árbol de trabajo principal**: todo el trabajo se hace dentro de `.claude/worktrees/`.

1. **Nombre de la rama**: `<num_issue>-<breve-descripcion>`, con `<breve-descripcion>` en kebab-case, minúsculas, sin tildes ni ñ, 2-5 palabras, sacada del título de la issue. Ejemplo: issue #42 "Paginar listado de pedidos" → `42-paginar-listado-pedidos`.
   - Antes, busca si ya existe una rama para esa issue (`git branch --list '<num_issue>-*'` y `git branch -r --list 'origin/<num_issue>-*'`). Si existe, reutilízala en lugar de inventar otro nombre (plan a medias).
2. Comprueba que `.claude/worktrees/` está en `.gitignore`. Si no lo está, avisa al usuario antes de seguir.
3. Asegúrate de que existe la rama `development`:
   - Si existe en local, úsala (actualízala con `git fetch origin development` si hay remoto).
   - Si solo existe en remoto (`origin/development`), créala en local siguiéndola.
   - Si no existe, créala a partir de `main`: `git branch development main`.
4. **Crea el worktree principal** de la issue:
   - Rama nueva: `git worktree add .claude/worktrees/<rama> -b <rama> development`.
   - Rama ya existente: si `git worktree list` muestra que ya tiene worktree, reutilízalo; si no, `git worktree add .claude/worktrees/<rama> <rama>`.
   - A partir de aquí, **todos** los comandos (tests, npm, git, edición de ficheros) se ejecutan dentro de ese worktree.
5. **Prepara el worktree**: ejecuta `npm install` dentro de él (los `node_modules` no se comparten entre worktrees). Si existe `.env` en el árbol principal y la tarea lo necesita, cópialo al worktree (está ignorado por git, nunca lo commitees).
6. **Guarda el plan en el worktree**: si no existe ya, escribe el contenido del comentario en `plans/<rama>.md` dentro del worktree. Ese fichero es donde se marcan las tareas y viaja en los commits. Si ya existe (plan a medias), úsalo: las tareas marcadas (`- [x]`) se saltan y se continúa por la primera pendiente (`- [ ]`).

### Varios agentes en paralelo

Usa varios agentes solo si el plan tiene **grupos de tareas independientes** (no tocan los mismos ficheros ni dependen unos de otros, por ejemplo API y frontend). Si hay dudas, trabaja con un único worktree.

- Crea un worktree y una sub-rama por agente a partir de la rama de la issue: `git worktree add .claude/worktrees/<rama>--<area> -b <rama>--<area> <rama>` (por ejemplo `42-paginar-listado-pedidos--api`). Usa `--` como separador: git no permite tener a la vez una rama `x` y otra `x/y`.
- Lanza un subagente por worktree con la ruta absoluta del worktree, las tareas que le tocan (con su número del plan) y las reglas de la sección 3. Cada agente hace `npm install` en su worktree, trabaja solo ahí y hace sus propios commits; **no** marca tareas en el plan.
- Cuando terminen, en el worktree principal: mergea cada sub-rama (`git merge --no-ff <rama>--<area>`), resuelve conflictos si los hay, ejecuta la suite completa, marca en el plan las tareas completadas y haz un commit con `/commit`.
- Elimina los worktrees y sub-ramas auxiliares: `git worktree remove .claude/worktrees/<rama>--<area>` y `git branch -d <rama>--<area>`.

## 3. Implementa cada tarea con TDD estricto

Procesa las tareas **una a una y en orden**. No empieces la siguiente hasta haber cerrado la anterior (test en verde, plan marcado y commit hecho).

Para cada tarea:

1. **Rojo — escribe primero el test**
   - Escribe con vitest el test (o los tests) que describen el comportamiento de la tarea, en `tests/`. Basa los casos en la tarea y en los **Criterios de aceptación** del plan.
   - Ejecuta solo ese test (`npx vitest run <fichero>`) y **comprueba que falla por el motivo esperado** (la funcionalidad no existe o no se comporta como debe), no por un error de sintaxis o de configuración. Si pasa sin haber escrito código, el test no sirve: corrígelo.
   - No escribas código de producción en este paso.
2. **Verde — implementa lo mínimo**
   - Escribe el código mínimo para que el test pase, respetando la arquitectura por capas (`controllers/`, `services/`, `repositories/`, `models/`, `utils/`) y las convenciones de `CLAUDE.md`: funciones en `snake_case`, código y mensajes en español, sin `;` innecesarios y con comillas simples.
   - Ejecuta el test de la tarea hasta que pase y después **toda la suite** (`npx vitest run`) para verificar que no has roto nada.
3. **Refactor**
   - Limpia el código y los tests sin cambiar el comportamiento. Pasa prettier y eslint sobre los ficheros tocados si ya están configurados.
   - Vuelve a ejecutar la suite completa: debe seguir en verde.
4. **Marca la tarea en el plan**: solo cuando los tests pasen, cambia su `- [ ]` por `- [x]` en `plans/<rama>.md`. No toques el texto de la tarea.
5. **Commit**: invoca el slash command `/commit` (Skill `commit`) para crear el commit de la tarea. Debe incluir el test, el código y el plan actualizado. Pásale como pista el número y la descripción de la tarea, por ejemplo: `/commit tarea 6: utils/password.js con hashear_password y comprobar_password`.

### Tareas sin comportamiento testeable

Algunas tareas no admiten un test previo (instalar dependencias, crear ficheros de configuración, actualizar documentación, pasar el linter). En ese caso:

- No inventes un test artificial. Indica explícitamente que la tarea no es testeable y por qué.
- Verifícala de otra forma (por ejemplo, `npx vitest run` arranca, `npm run lint` termina sin errores, la app arranca con `npm start`).
- Si la suite existente se ve afectada, debe seguir en verde.
- Después marca la tarea y haz el commit igual que en el resto.

### Si algo falla

- Si un test no se puede poner en verde, la tarea es ambigua o el plan resulta incorrecto o incompleto, **detente** y explica el problema al usuario en lugar de improvisar. No marques la tarea ni hagas commit de código en rojo.
- Si descubres que hace falta una tarea nueva, propónla al usuario antes de añadirla al plan.
- Nunca desactives, borres ni marques como `skip` un test para que la suite pase.

## 4. Cierre y pull request

Cuando no queden tareas pendientes:

1. Ejecuta la suite completa y, si están configurados, `npm run lint` y prettier.
2. Repasa los **Criterios de aceptación** del plan. Marca con `- [x]` los que estén verificados por tests o comprobaciones y haz un último commit con `/commit` si has cambiado el plan.
3. **Sube la rama**: `git push -u origin <rama>`.
4. **Crea la pull request** contra `development`, lista para revisión (no en borrador):
   `gh pr create --base development --head <rama> --title "<tipo>: <título de la issue> (#<num_issue>)" --body-file <fichero temporal>`
   - Escribe el cuerpo en un fichero temporal fuera del repo y pásalo con `--body-file`. Debe incluir: `Closes #<num_issue>`, un resumen de los cambios, la lista de tareas completadas, los criterios de aceptación y su estado, cómo probarlo y las decisiones tomadas durante la implementación.
   - Si ya existe una PR abierta para esa rama (`gh pr view <rama>`), no crees otra: el push la actualiza; informa de su URL.
5. **No mergees la PR** ni la apruebes: debe revisarla una persona antes de integrarla.
6. Deja el worktree principal en su sitio por si la revisión pide cambios. Indica al usuario que, una vez mergeada, puede limpiarlo con `git worktree remove .claude/worktrees/<rama>`.
7. Muestra un resumen: rama y ruta del worktree, tareas completadas, commits realizados (`git log --oneline development..<rama>`), URL de la PR, criterios de aceptación pendientes y cualquier decisión tomada durante la implementación.
