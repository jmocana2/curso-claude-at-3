# #1 — Accesibilizar el formulario de platos

- **Tipo**: feature
- **Issue**: #1
- **Fecha**: 2026-11-05

## Objetivo

Hacer que el formulario de creación/edición de platos de `web-admin` (`/restaurants/:restaurantId/dishes/new` y `/:id/edit`) cumpla WCAG 2.2 nivel AA, de forma que se pueda completar y enviar **solo con el teclado**, con un orden de tabulación lógico y un foco siempre visible. Hoy no es posible: los botones "Añadir ingrediente", "Quitar ingrediente", "Cancelar" y "Guardar" son `<div>` con `(click)`, no reciben foco ni responden a Enter/Espacio, los campos no tienen `<label>` asociado y no hay validación ni mensajes de error accesibles.

Además, se entrega un vídeo grabado con Playwright que demuestra el recorrido completo solo con teclado.

## Alcance

**Incluye**

- Semántica del formulario: `<form (ngSubmit)>`, `<label for>` en todos los campos, `<h1>` para el título de página y `<fieldset>/<legend>` (o `<h2>`) para la sección de ingredientes.
- Sustituir los `<div (click)>` por elementos nativos: `<button type="button">` (añadir/quitar ingrediente), `<button type="submit">` (Guardar) y `<a routerLink>` (Cancelar).
- Nombres accesibles para controles con solo icono (`aria-label` en volver, añadir y quitar ingrediente; iconos con `aria-hidden="true"`).
- Validación en cliente (nombre obligatorio, precio > 0, cantidad de ingrediente > 0) con mensajes asociados por `aria-describedby`, `aria-invalid="true"`, resumen de errores con `role="alert"` y foco al primer campo inválido al enviar.
- Gestión del foco al añadir/quitar ingredientes y anuncio del cambio en una región `aria-live="polite"`.
- Foco visible (`:focus-visible`) en botones, enlaces y controles del formulario; tamaño mínimo de objetivo 24×24 px (WCAG 2.5.8) en el botón de quitar ingrediente.
- Mensaje de error de API (`alert-error`) anunciado con `role="alert"`.
- Configuración de Playwright y un test e2e que recorre el formulario solo con teclado y graba vídeo.

**No incluye**

- Accesibilizar el resto de pantallas de `web-admin` (lista de platos, ingredientes, empleados, restaurantes, shell/menú lateral), salvo el foco visible global que se beneficia de forma colateral.
- Cambios en la API ni en sus validaciones.
- Revisión completa de contraste de la paleta de colores de toda la aplicación (solo se corrige lo que afecte al formulario de platos).
- Integrar Playwright en un pipeline de CI.

## Archivos afectados

| Archivo | Cambio | Motivo |
| ------- | ------ | ------ |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.html` | modificar | Semántica (`form`, `label`, `h1`, `fieldset`), botones nativos, ARIA, mensajes de error, región `aria-live` |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.ts` | modificar | Validación en cliente, estado de errores, gestión de foco (`viewChild`), mensaje para `aria-live` |
| `packages/web-admin/src/app/features/dishes/pages/dish-form/dish-form.component.css` | modificar | Eliminar clases `fake-*`, estilos de error, `:focus-visible`, tamaño mínimo del botón de quitar |
| `packages/web-admin/src/styles.css` | modificar | Regla global `:focus-visible` (hoy `button { outline: none }` elimina el foco visible) y clase `.visually-hidden` |
| `packages/web-admin/package.json` | modificar | Dependencia de desarrollo `@playwright/test` y script `e2e` |
| `packages/web-admin/playwright.config.ts` | crear | `baseURL` http://localhost:4200, `video: 'on'`, `slowMo`, `webServer` para API y admin |
| `packages/web-admin/e2e/dish-form-teclado.spec.ts` | crear | Recorrido solo con teclado que genera el vídeo |
| `packages/web-admin/.gitignore` (o raíz) | modificar | Ignorar `test-results/` y `playwright-report/` |
| `docs/videos/dish-form-teclado.webm` | crear | Vídeo entregable como criterio de aceptación |

## Tareas

> Cada tarea debe poder completarse en 5-10 minutos.

- [x] 1. Instalar Playwright en `web-admin` (`npm i -D @playwright/test -w @resttek/web-admin` y `npx playwright install chromium`), añadir script `"e2e": "playwright test"` e ignorar `test-results/` y `playwright-report/`.
- [x] 2. Crear `playwright.config.ts` con `baseURL: 'http://localhost:4200'`, `use: { video: 'on', viewport: 1280×800, launchOptions: { slowMo: 250 } }`, un solo proyecto Chromium y `webServer` que arranque `dev:api` (:3000/health) y `dev:admin` (:4200), reutilizando servidores existentes.
- [x] 3. Escribir el test e2e en **rojo**: login con teclado (`admin@resttek.com`), ir a `/restaurants/rest-1/dishes/new`, y comprobar con `page.keyboard.press('Tab')` que el foco llega a "Nombre del plato" y que tiene nombre accesible (`getByLabel('Nombre del plato')` enfocado). Debe fallar porque no hay `<label>`.
- [x] 4. Estructura semántica: `fake-title` → `<h1>`, `<form (ngSubmit)="onSubmit()" novalidate>`, cada `fake-label` → `<label for="dish-…">` con `id` en su control; añadir `<label class="visually-hidden">` para el select de nuevo ingrediente y la cantidad. Añadir `.visually-hidden` en `styles.css`.
- [x] 5. Enlace "volver": `aria-label="Volver a la lista de platos"` e icono `aria-hidden="true"`.
- [x] 6. Sección de ingredientes: envolver en `<fieldset>` con `<legend>Ingredientes del plato</legend>` y la lista de chips como `<ul>/<li>`.
- [x] 7. Botón añadir ingrediente: `<div>` → `<button type="button" aria-label="Añadir ingrediente">`; icono `aria-hidden`.
- [x] 8. Botón quitar ingrediente: `<div>` → `<button type="button" [attr.aria-label]="'Quitar ' + nombre">`; tamaño mínimo 24×24 px.
- [x] 9. Botones de acción: "Cancelar" → `<a [routerLink]="listUrl" class="btn btn-secondary">`, "Guardar" → `<button type="submit" class="btn btn-primary" [disabled]="loading()">`. Comprobar que Enter en un campo de texto envía el formulario.
- [x] 10. Foco visible: regla global `:focus-visible { outline: 2px solid var(--border-focus); outline-offset: 2px; }` para `a`, `button`, `.btn` y `.form-control` (quitar el efecto de `button { outline: none }`); verificar contraste ≥ 3:1 del indicador sobre `--bg-card`.
- [ ] 11. Gestión del foco en ingredientes: tras añadir, devolver el foco al select de ingrediente; tras quitar, mover el foco al siguiente botón "Quitar" (o al select si no quedan). Usar `viewChild`/`viewChildren` + `afterNextRender`.
- [ ] 12. Región `aria-live="polite"` (visualmente oculta) que anuncie "Ingrediente X añadido" / "Ingrediente X quitado"; y feedback si se intenta añadir sin seleccionar o con cantidad ≤ 0 (mensaje asociado por `aria-describedby`).
- [ ] 13. Validación en cliente en el `.ts`: método `validar()` que rellene un signal `errores` (`name` obligatorio, `price` > 0) y devuelva si es válido; `onSubmit()` no llama a la API si no lo es.
- [ ] 14. Mostrar errores en la plantilla: texto bajo cada campo con `id="dish-name-error"`, `aria-invalid` y `aria-describedby` en el control; resumen de errores con `role="alert"` al inicio del formulario; foco al primer campo inválido tras enviar.
- [ ] 15. Error de API: añadir `role="alert"` al `alert-error` y mover el foco a él al recibir el error.
- [ ] 16. Limpiar CSS: eliminar clases `fake-*`, estilos para `.field-error` (color con contraste ≥ 4.5:1) y `legend`; comprobar que el diseño visual no cambia.
- [ ] 17. Completar el test e2e, parte 1 (rellenar y modificar datos solo con `Tab`/`Shift+Tab`/teclas): escribir nombre, borrarlo y reescribirlo, cambiar precio, cambiar categoría y disponibilidad con flechas, escribir descripción.
- [ ] 18. Test e2e, parte 2 (ingredientes): seleccionar dos ingredientes con flechas, fijar cantidad, añadirlos con `Enter`/`Espacio`, y quitar uno de ellos con el teclado; comprobar que el chip desaparece y el foco queda en un elemento lógico.
- [ ] 19. Test e2e, parte 3 (errores): vaciar el nombre y poner precio 0, enviar con `Enter` y comprobar que se muestran los mensajes, `aria-invalid="true"` y que el foco está en el primer campo inválido.
- [ ] 20. Test e2e, parte 4 (éxito): corregir los campos, enviar con `Enter`, comprobar la navegación a `/restaurants/rest-1/dishes` y que el nuevo plato aparece en la tabla. Añadir pausas breves (`waitForTimeout`) para que el vídeo sea legible.
- [ ] 21. Ejecutar `npm run seed` + `npm run e2e -w @resttek/web-admin`, verificar que pasa en verde y copiar el vídeo generado a `docs/videos/dish-form-teclado.webm`.
- [ ] 22. Probar también el modo edición (`/:id/edit`) manualmente solo con teclado y revisar el formulario con axe DevTools / Lighthouse (sin incidencias críticas ni serias).
- [ ] 23. `npm run build -w @resttek/web-admin` sin errores y `npm test` (API) en verde.

## Criterios de aceptación

- [ ] Dado el formulario de nuevo/editar plato, cuando se navega con `Tab`, entonces el orden es: volver → nombre → precio → categoría → disponible → descripción → (quitar ingrediente…) → select ingrediente → cantidad → añadir → cancelar → guardar, sin trampas de foco.
- [ ] Todos los elementos interactivos son alcanzables por teclado y activables con `Enter`/`Espacio`; no queda ningún `<div (click)>` en el formulario.
- [ ] El elemento enfocado muestra siempre un indicador visible con contraste ≥ 3:1 (WCAG 2.4.7 y 2.4.13 orientativo) y no queda oculto por otros elementos (2.4.11).
- [ ] Cada campo tiene un nombre accesible (`<label>` o `aria-label`) y los botones de solo icono tienen texto alternativo (1.3.1, 4.1.2).
- [ ] Dado un nombre vacío o un precio ≤ 0, cuando se envía el formulario, entonces no se llama a la API, se muestran los mensajes de error junto a cada campo, se anuncian (`role="alert"`), los campos tienen `aria-invalid="true"` y el foco va al primer campo inválido (3.3.1, 3.3.3).
- [ ] Al añadir o quitar un ingrediente el cambio se anuncia por la región `aria-live` y el foco queda en un elemento lógico (no se pierde en `<body>`).
- [ ] El botón de quitar ingrediente mide al menos 24×24 px (2.5.8).
- [ ] Dado un formulario válido, cuando se envía con `Enter`, entonces se crea el plato y se navega a la lista, donde aparece el nuevo plato.
- [ ] Existe `docs/videos/dish-form-teclado.webm`, grabado con Playwright, en el que se ve: navegación solo con teclado, modificación de datos, añadir y quitar un ingrediente, envío incompleto con errores visibles y creación correcta del plato que aparece en la lista.
- [ ] `npm run e2e -w @resttek/web-admin` pasa en verde.
- [ ] `npm run build -w @resttek/web-admin` compila sin errores (no hay eslint ni prettier configurados en los frontends).
- [ ] Los tests de vitest de la API siguen pasando (`npm test`).

## Dudas y decisiones

**Dudas abiertas**

- Ninguna (resueltas por el usuario, ver decisiones).

**Respuestas del usuario**

- El vídeo se versiona en `docs/videos/dish-form-teclado.webm`.
- Solo se accesibiliza el formulario de platos; el resto de formularios irá en otra issue.
- El login también se hace con teclado dentro del vídeo.

**Decisiones tomadas**

- Playwright se instala solo en `packages/web-admin` (no en la raíz) — es el único frontend afectado y mantiene el workspace autocontenido.
- El test e2e actúa como test automatizado de la feature (rojo → verde) — no hay tests unitarios de frontend configurados en el proyecto.
- Se usa `slowMo` y pausas cortas en el test — sin ellas el vídeo es demasiado rápido para seguirlo.
- Se usa `rest-1` y el usuario `admin@resttek.com` del seed, ejecutando `npm run seed` antes del e2e — son los datos de prueba documentados en `CLAUDE.md`. Como el seed no borra datos previos (issue "Seed no borra datos previos"), el nombre del plato del test incluirá un sufijo único (timestamp) para que la comprobación en la lista sea fiable.
- Se mantiene la validación del lado de la API sin cambios y se añade validación en cliente equivalente (nombre obligatorio, precio > 0) — da mensajes por campo, que es lo que exige 3.3.1/3.3.3, sin tocar el backend.
- Se usa `novalidate` en el `<form>` y validación propia — los globos nativos del navegador no son consistentes ni se graban bien en el vídeo.
- Nombres de métodos nuevos en camelCase (p. ej. `validar()`) aunque la plantilla del equipo pide `snake_case` — el código Angular/TypeScript existente usa camelCase en todo el proyecto y mezclar estilos sería peor.
- No se añade eslint/prettier a `web-admin` — no están configurados y queda fuera del alcance de la issue.
