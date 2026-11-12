# #5 — Gestión de mesas

- **Tipo**: feature
- **Issue**: #5
- **Fecha**: 2026-11-12

## Objetivo

Incorporar las mesas al dominio de Resttek. El administrador gestiona las mesas de cada restaurante (CRUD), los empleados ven y cambian su estado junto con los pedidos de las mesas ocupadas, y el cliente, antes de ver la carta, indica cuántas personas son, elige una mesa libre con capacidad suficiente y esta queda ocupada y asociada a su pedido.

## Alcance

**Incluye**

- API (estilo por capas, como `ingredient`): tabla `tables`, modelo con tipo unión `TableStatusType` (`libre`, `ocupada`, `reservada`) + `normalizeTableStatus()`, repositorio SQLite + mock, servicio, controlador y rutas en `/api/v1/restaurants/:restaurantId/tables`.
- CRUD de mesas solo para `admin`; listado y cambio de estado para `admin`, `manager` y `camarero`; consulta de mesas disponibles y ocupación de una mesa para `cliente`.
- Ocupación atómica de la mesa (si otro cliente la ocupa antes, `409`) y número de mesa único por restaurante.
- Comprobación de que el empleado pertenece al restaurante de la ruta en los endpoints de mesas (`admin` sin restricción).
- Validación en `POST /api/v1/orders` de que `tableId`, si se envía, pertenece al restaurante del pedido.
- Seed con mesas de prueba para `rest-1` y `rest-2`.
- `web-admin`: listado, alta, edición y borrado de mesas por restaurante, con enlaces en el menú lateral y en el dashboard del restaurante.
- `web-empleados`: página "Mesas" con el estado de cada mesa, cambio de estado y los pedidos activos de cada mesa ocupada.
- `web-clientes`: página de selección de mesa (número de personas → mesas disponibles → "Continuar"), que ocupa la mesa y lleva a la carta; el pedido se envía con el `tableId`.
- Actualización de `docs/dominio/modelo-datos.md`, `docs/dominio/glosario.md` y `docs/arquitectura/arquitectura-api.md`.

**No incluye**

- Reservas con fecha y hora: `reservada` es solo un estado que cambia un empleado o el admin.
- Liberación automática de la mesa al entregar o pagar el pedido: la libera un empleado cambiando su estado.
- Unir mesas, plano visual del salón o actualización en tiempo real por WebSockets (los empleados reutilizan el polling existente).
- Corregir el control de acceso del resto de rutas detectado en `tasks/owasp-top10-api.md` (API-02, API-03), salvo en las rutas nuevas de mesas.
- Tests de frontend (no hay ninguno configurado).

## Archivos afectados

| Archivo | Cambio | Motivo |
| ------- | ------ | ------ |
| `packages/api/src/config/database.ts` | modificar | Crear la tabla `tables` con `UNIQUE(restaurant_id, number)` |
| `packages/api/src/models/table.model.ts` | crear | Interfaz `Table`, `TableStatusType` y `normalizeTableStatus()` |
| `packages/api/src/models/table.model.test.ts` | crear | Tests de `normalizeTableStatus()` |
| `packages/api/src/errors/DomainErrors.ts` | modificar | `TableNotFoundError`, `InvalidTableStatusError`, `InvalidTableNumberError`, `InvalidTableCapacityError`, `DuplicatedTableNumberError`, `TableNotAvailableError`, `InvalidPeopleCountError` |
| `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts` | modificar | `TableNotFoundError` → 404; `DuplicatedTableNumberError` y `TableNotAvailableError` → 409 |
| `packages/api/src/repositories/table.repository.ts` | crear | Interfaz `TableRepository` + `SqliteTableRepository` |
| `packages/api/src/repositories/table.repository.test.ts` | crear | Tests del repositorio con SQLite en memoria |
| `packages/api/src/repositories/mocks/MockTableRepository.ts` | crear | Mock para los tests del servicio |
| `packages/api/src/services/table.service.ts` | crear | Validaciones, CRUD, cambio de estado, disponibles y ocupación |
| `packages/api/src/services/table.service.test.ts` | crear | Tests del servicio |
| `packages/api/src/controllers/table.controller.ts` | crear | Handlers HTTP y `toJSON` |
| `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts` | modificar | Middleware `authorizeRestaurant` (el empleado solo accede a su restaurante) |
| `packages/api/src/routes/table.routes.ts` | crear | Composición de dependencias y rutas con roles |
| `packages/api/src/routes/table.routes.test.ts` | crear | Tests HTTP de permisos y códigos de estado (supertest) |
| `packages/api/src/app.ts` | modificar | Montar `/api/v1/restaurants/:restaurantId/tables` |
| `packages/api/src/services/order.service.ts` | modificar | Validar que la mesa del pedido es del restaurante |
| `packages/api/src/services/order.service.test.ts` | modificar | Tests de la validación de `tableId` |
| `packages/api/src/routes/order.routes.ts` | modificar | Inyectar `TableRepository` en `OrderService` |
| `packages/api/src/scripts/seed.ts` | modificar | Mesas de prueba |
| `packages/web-admin/src/app/features/tables/**` | crear | Modelo, servicio, store, listado, formulario y rutas (mismo patrón que `ingredients`) |
| `packages/web-admin/src/app/app.routes.ts` | modificar | Ruta `restaurants/:restaurantId/tables` |
| `packages/web-admin/src/app/core/layout/shell.component.html` | modificar | Enlace "Mesas" en el submenú del restaurante |
| `packages/web-admin/src/app/features/restaurants/pages/restaurant-dashboard/restaurant-dashboard.component.html` | modificar | Tarjeta "Mesas" |
| `packages/web-empleados/src/app/features/tables/**` | crear | Modelo, servicio, store y página `mesas` |
| `packages/web-empleados/src/app/app.routes.ts` | modificar | Ruta `mesas` |
| `packages/web-empleados/src/app/core/layout/shell.component.html` / `.ts` | modificar | Enlace "Mesas" visible para manager y camarero |
| `packages/web-clientes/src/app/core/models/table.model.ts` | crear | Modelo `Table` |
| `packages/web-clientes/src/app/core/services/table.service.ts` | crear | `getAvailable()` y `occupy()` |
| `packages/web-clientes/src/app/features/tables/table-selection.component.ts` | crear | Selección de número de personas y mesa |
| `packages/web-clientes/src/app/app.routes.ts` | modificar | Ruta `restaurants/:id/mesa` y redirección desde la carta si no hay mesa |
| `packages/web-clientes/src/app/features/restaurants/restaurant-list.component.ts` | modificar | La tarjeta lleva a la selección de mesa |
| `packages/web-clientes/src/app/core/store/cart.store.ts` | modificar | Guardar la mesa elegida |
| `packages/web-clientes/src/app/core/services/order.service.ts` | modificar | Enviar `tableId` |
| `packages/web-clientes/src/app/features/cart/cart.component.ts` | modificar | Pasar la mesa al crear el pedido |
| `docs/dominio/modelo-datos.md`, `docs/dominio/glosario.md`, `docs/arquitectura/arquitectura-api.md` | modificar | Documentar la entidad, sus estados y los endpoints |

## Tareas

> Cada tarea debe poder completarse en 5-10 minutos.

**API — modelo y persistencia**

- [ ] 1. `models/table.model.ts`: interfaz `Table` (`id`, `number`, `description`, `capacity`, `status`, `restaurantId`, `createdAt`, `updatedAt`), `TableStatusType` y `normalizeTableStatus()` con su test (`table.model.test.ts`), más `InvalidTableStatusError` en `DomainErrors.ts`.
- [ ] 2. Resto de errores de dominio de mesas en `DomainErrors.ts` y su mapeo a 404 / 409 en `errorHandler.ts` (añadir lista `CONFLICT_ERRORS`).
- [ ] 3. Crear la tabla `tables` en `runInitialMigrations()` (`number INTEGER NOT NULL`, `description TEXT`, `capacity INTEGER NOT NULL`, `status TEXT NOT NULL DEFAULT 'libre'`, FK a `restaurants`, `UNIQUE(restaurant_id, number)`).
- [ ] 4. `TableRepository` + `SqliteTableRepository`: `findById`, `findByRestaurantId` (ordenado por `number`) y `save` (insert/update), con tests en `table.repository.test.ts`.
- [ ] 5. Repositorio: `delete`, `findAvailable(restaurantId, minCapacity)` (`status = 'libre' AND capacity >= ?`, orden por capacidad y número) con tests.
- [ ] 6. Repositorio: `occupyIfFree(id)` con `UPDATE ... SET status = 'ocupada' WHERE id = ? AND status = 'libre'` que devuelve si cambió una fila; test de doble ocupación.
- [ ] 7. `MockTableRepository` en `repositories/mocks/`.

**API — servicio**

- [ ] 8. `TableService.create`: validaciones (número y capacidad enteros > 0, `restaurantId` requerido, descripción opcional con trim, estado inicial `libre`) y número duplicado → `DuplicatedTableNumberError`. Tests.
- [ ] 9. `TableService.update` y `delete` (incluido `TableNotFoundError` y mesa de otro restaurante tratada como no encontrada). Tests.
- [ ] 10. `TableService.changeStatus` y `findByRestaurantId`. Tests.
- [ ] 11. `TableService.findAvailable(restaurantId, people)` (`people` entero > 0, si no `InvalidPeopleCountError`) y `occupy` (`TableNotAvailableError` si no está libre). Tests.

**API — HTTP**

- [ ] 12. Middleware `authorizeRestaurant` en `middlewares.ts`: `admin` pasa; `manager` / `camarero` solo si `user.restaurantId === req.params.restaurantId`, si no 403. Test unitario.
- [ ] 13. `TableController` (create, getAll, getById, update, delete, changeStatus, getAvailable, occupy) y `toJSON`.
- [ ] 14. `routes/table.routes.ts` con roles (CRUD `admin`; `GET /` y `PATCH /:id/status` `admin`/`manager`/`camarero` + `authorizeRestaurant`; `GET /available?people=N` y `POST /:id/occupy` `cliente`) y montaje en `app.ts`. Declarar `/available` antes de `/:id`.
- [ ] 15. Tests HTTP en `table.routes.test.ts`: 201/400/409 en alta, 403 por rol y por restaurante ajeno, 200 en disponibles y 409 al ocupar una mesa ocupada.
- [ ] 16. `OrderService.create`: si llega `tableId`, comprobar que existe y es del `restaurantId` (si no, `TableNotFoundError`); inyectar `TableRepository` en `order.routes.ts`. Tests en `order.service.test.ts`.
- [ ] 17. Seed: 6 mesas para `rest-1` y 4 para `rest-2` con capacidades 2, 4 y 6 (`INSERT OR IGNORE`, IDs fijos `table-1-1`...). Verificar con `npm run seed`.

**web-admin**

- [ ] 18. `features/tables`: `models/table.model.ts`, `services/table.service.ts` y `store/table.store.ts` siguiendo `ingredients`.
- [ ] 19. Página `table-list` (número, descripción, capacidad, estado, editar y borrar con confirmación).
- [ ] 20. Página `table-form` (alta/edición con validaciones de número y capacidad, accesible y manejable con teclado como el formulario de platos) y `tables.routes.ts`.
- [ ] 21. Ruta en `app.routes.ts`, enlace "Mesas" en el submenú del shell y tarjeta en el dashboard del restaurante. Verificar con `npm run build -w @resttek/web-admin`.

**web-empleados**

- [ ] 22. `features/tables`: modelo, servicio (`getAll`, `changeStatus`) y store con polling (mismo intervalo que pedidos).
- [ ] 23. Página `mesas`: tarjeta por mesa con estado y selector para cambiarlo.
- [ ] 24. En cada mesa ocupada, mostrar sus pedidos activos (filtrando `GET /orders/active` por `tableId`) con el estado de cada ítem.
- [ ] 25. Ruta `mesas` y enlace "Mesas" en el shell para `manager` y `camarero`. Verificar con `npm run build -w @resttek/web-empleados`.

**web-clientes**

- [ ] 26. `core/models/table.model.ts` y `core/services/table.service.ts` (`getAvailable(restaurantId, people)`, `occupy(restaurantId, tableId)`).
- [ ] 27. `cart.store.ts`: guardar `tableId` y `tableNumber` de la mesa elegida y limpiarlos con el carrito.
- [ ] 28. `table-selection.component.ts`: campo de número de personas, botón "Buscar mesas", listado de mesas disponibles (radio), botón "Continuar" que ocupa la mesa y navega a la carta; si responde 409, mensaje y recarga del listado.
- [ ] 29. Rutas: `restaurants/:id/mesa`; la tarjeta del listado de restaurantes lleva ahí y la carta redirige a la selección si no hay mesa elegida para ese restaurante.
- [ ] 30. Enviar `tableId` al crear el pedido (`order.service.ts` y `cart.component.ts`) y mostrar la mesa en el carrito. Verificar con `npm run build -w @resttek/web-clientes`.

**Documentación y cierre**

- [ ] 31. Documentar la tabla `tables`, su relación con `orders.table_id`, los estados de mesa y los endpoints en `docs/`.
- [ ] 32. Pasar `npm test` completo y prueba manual del flujo cliente → empleado → admin con los datos del seed.

## Criterios de aceptación

- [ ] Dado un `admin`, cuando hace `POST /api/v1/restaurants/rest-1/tables` con `{ number: 7, capacity: 4, description: "Terraza" }`, entonces recibe `201` con la mesa en estado `libre`.
- [ ] Dado que ya existe la mesa número 7 en `rest-1`, cuando se crea otra con el mismo número, entonces recibe `409` con `error: "DuplicatedTableNumberError"`; en `rest-2` el mismo número sí se permite.
- [ ] Cuando se crea o edita una mesa con capacidad o número no enteros o ≤ 0, o con un estado distinto de `libre`, `ocupada` o `reservada`, entonces recibe `400`.
- [ ] `PUT` y `DELETE` de una mesa inexistente devuelven `404`; un `manager`, `camarero`, `cocinero` o `cliente` recibe `403` en `POST`, `PUT` y `DELETE`.
- [ ] Dado un `camarero` de `rest-1`, cuando hace `GET` o `PATCH /:id/status` sobre mesas de `rest-1` recibe `200`, y sobre `rest-2` recibe `403`.
- [ ] Dado un `cliente`, cuando hace `GET /api/v1/restaurants/rest-1/tables/available?people=3`, entonces solo recibe mesas `libre` con `capacity >= 3`; con `people` ausente, 0 o no numérico recibe `400`.
- [ ] Cuando un `cliente` hace `POST /:id/occupy` sobre una mesa libre recibe `200` y la mesa pasa a `ocupada`; si ya estaba ocupada o reservada recibe `409`.
- [ ] `POST /api/v1/orders` con un `tableId` de otro restaurante o inexistente devuelve un error y no crea el pedido; con un `tableId` válido, el pedido se guarda con esa mesa.
- [ ] En `web-admin` se pueden crear, editar y borrar mesas de un restaurante desde la sección "Mesas".
- [ ] En `web-empleados`, un camarero ve todas las mesas de su restaurante con su estado, puede cambiarlo y ve los pedidos activos de cada mesa ocupada.
- [ ] En `web-clientes`, al elegir un restaurante se pide el número de personas, se muestran solo las mesas disponibles con capacidad suficiente y, al pulsar "Continuar", la mesa queda ocupada y se muestra la carta; el pedido enviado lleva la mesa.
- [ ] La documentación de `docs/` refleja la tabla, los estados y los endpoints nuevos.
- [ ] El código pasa eslint y está formateado con prettier (no aplica: el proyecto no tiene eslint ni prettier configurados).
- [ ] Los tests de vitest relacionados pasan (`npm test`) y los tres frontends compilan con `npm run build`.

## Dudas y decisiones

**Dudas abiertas**

- Ninguna. Resueltas con el usuario el 2026-11-12:
  - Ven y cambian el estado de las mesas `manager` y `camarero` (no `cocinero`).
  - La mesa la libera un empleado a mano.
  - El CRUD es solo para `admin` y no se limita cuántas mesas ocupa un cliente.
- Contrato de la API: `packages/api/openapi.yml`, acordado por los cuatro agentes antes de implementar.

**Decisiones tomadas**

- Estilo por capas (`models/`, `repositories/`, `services/`, `controllers/`, `routes/`) como `ingredient` y `dish` — es el estilo de los dominios de restaurante; el hexagonal se reserva para `employee`.
- La tabla se llama `tables` y se reutiliza la columna existente `orders.table_id` — evita una migración de `orders`; al ser una tabla nueva, `CREATE TABLE IF NOT EXISTS` funciona sin borrar `resttek.db`.
- La ocupación se hace con un `UPDATE ... WHERE status = 'libre'` condicional — evita que dos clientes ocupen la misma mesa a la vez.
- Número de mesa único por restaurante (`UNIQUE(restaurant_id, number)`) — dos mesas con el mismo número en el mismo salón no tienen sentido.
- Se añade `authorizeRestaurant` solo a las rutas de mesas — cubre el hallazgo API-03 en lo nuevo sin ampliar el alcance al resto de rutas.
- Nombres de funciones en `camelCase` y mensajes de error en inglés, en contra de la convención genérica de la plantilla — es lo que usa todo el código existente de la API y de los frontends.
- Los empleados ven los pedidos de cada mesa filtrando `GET /orders/active` por `tableId` en el frontend — no hace falta un endpoint nuevo.
- La selección de mesa es una página nueva (`restaurants/:id/mesa`) previa a la carta — encaja con el flujo descrito en la issue y deja la carta sin cambios.
