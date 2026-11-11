---
name: implement-plan
description: Implementa un plan de plans/ tarea a tarea con TDD estricto (rojo → verde → refactor), en una rama propia creada desde development, marcando cada tarea como hecha en el plan y haciendo un commit por tarea con /commit. Úsala cuando pidan implementar, ejecutar o llevar a cabo un plan.
argument-hint: <ruta del plan, p. ej. plans/1-login-registro-usuarios.md>
---

# implement-plan

Implementa el plan indicado por el usuario siguiendo **TDD estricto** y con **un commit por tarea**.

Plan solicitado: $ARGUMENTS

## 1. Localiza y lee el plan

- Si `$ARGUMENTS` es una ruta, úsala. Si es un número de issue o un nombre parcial, búscalo en `plans/` con Glob. Si no hay argumento o hay varias coincidencias, pregunta cuál implementar (no lo adivines).
- Lee el plan completo, `CLAUDE.md` y la documentación de `docs/` que mencione.
- Si la sección **Dudas abiertas** contiene preguntas sin resolver, muéstralas y pide respuesta antes de empezar.
- Identifica las tareas pendientes (`- [ ]`) de la sección **Tareas**. Las ya marcadas (`- [x]`) se saltan: así la skill puede reanudar un plan a medias.

## 2. Prepara la rama

Sigue las reglas de la skill `git` antes de cualquier comando git que no sea de solo lectura.

1. Comprueba que el árbol de trabajo está limpio (`git status --short`), sin contar el propio fichero del plan. Si hay otros cambios, detente y pregunta qué hacer con ellos; no los descartes ni los guardes en stash por tu cuenta.
2. Asegúrate de que existe la rama `development`:
   - Si existe en local, úsala.
   - Si solo existe en remoto (`origin/development`), créala en local siguiéndola.
   - Si no existe, créala a partir de `main`: `git branch development main`.
3. El nombre de la rama es el nombre del fichero del plan sin carpeta ni extensión. Ejemplo: `plans/1-login-registro-usuarios.md` → rama `1-login-registro-usuarios`.
4. Crea la rama desde `development` y cámbiate a ella: `git switch -c <nombre-del-plan> development`.
   - Si la rama ya existe (plan a medias), cámbiate a ella con `git switch <nombre-del-plan>` y continúa por la primera tarea pendiente.
   - Si el plan no está versionado, quedará como fichero sin seguimiento y viajará contigo a la nueva rama; se incluirá en el primer commit.

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
4. **Marca la tarea en el plan**: solo cuando los tests pasen, cambia su `- [ ]` por `- [x]` en el fichero del plan. No toques el texto de la tarea.
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

## 4. Cierre

Cuando no queden tareas pendientes:

1. Ejecuta la suite completa y, si están configurados, `npm run lint` y prettier.
2. Repasa los **Criterios de aceptación** del plan. Marca con `- [x]` los que estén verificados por tests o comprobaciones y haz un último commit con `/commit` si has cambiado el plan.
3. Muestra un resumen: rama creada, tareas completadas, commits realizados (`git log --oneline development..HEAD`), criterios de aceptación pendientes y cualquier decisión tomada durante la implementación.

No hagas `push`, `merge` ni abras pull requests salvo que el usuario lo pida explícitamente.
