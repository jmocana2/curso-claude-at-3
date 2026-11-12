# Auditoría OWASP Top 10 (2021) de `packages/api`

Alcance: `packages/api/src` (Express 5 + TypeScript + SQLite), `package.json` y `npm audit`. Solo lectura; no se ha modificado código. Las rutas de fichero son relativas a `packages/api/`. Los hallazgos marcados "a confirmar" no se han podido verificar al 100 % solo leyendo el código.

## 1. Resumen ejecutivo

La API usa consultas SQL parametrizadas en todos los repositorios y bcrypt para las contraseñas, lo cual elimina las inyecciones SQL clásicas. Los problemas graves están en el control de acceso y la gestión del secreto JWT:

- El secreto JWT tiene un valor por defecto público en el código: cualquiera puede forjar un token de `admin` si no se define `JWT_SECRET`.
- Los endpoints de pedidos solo exigen estar autenticado: cualquier usuario (incluido un `cliente`) puede cambiar el estado de cualquier item de cualquier pedido, y leer pedidos de cualquier restaurante. Esto confirma la issue conocida sobre roles por item.
- No hay aislamiento entre restaurantes (tenant) en platos e ingredientes: un manager de un restaurante puede modificar los de otro.
- Faltan rate limiting, helmet, CORS restringido, logging y política de contraseñas.
- `npm audit` reporta 22 vulnerabilidades (4 críticas, 13 altas, 2 moderadas, 3 bajas), la mayoría transitivas.

Recuento: Crítica 1, Alta 4, Media 8, Baja 5 (total 18).

### Tabla de hallazgos

| ID | OWASP | Severidad | Fichero:línea | Título |
|----|-------|-----------|---------------|--------|
| H-01 | A02 / A07 | Crítica | `src/contexts/shared/infrastructure/http/middlewares.ts:4`, `src/contexts/employee/infrastructure/BcryptAuthService.ts:5` | Secreto JWT hardcodeado como fallback |
| H-02 | A01 | Alta | `src/routes/order.routes.ts:18`, `src/services/order.service.ts:69` | Cualquier usuario autenticado cambia el estado de cualquier item de pedido (issue de roles confirmada) |
| H-03 | A01 | Alta | `src/routes/order.routes.ts:15-17`, `src/controllers/order.controller.ts:28,57` | IDOR en lectura de pedidos (`/active`, `/:id`) |
| H-04 | A01 | Alta | `src/routes/dish.routes.ts:14-18`, `src/routes/ingredient.routes.ts:14-18` | Sin aislamiento por restaurante en platos e ingredientes |
| H-05 | A06 | Alta | `package.json` | Dependencias con vulnerabilidades conocidas (`npm audit`) |
| H-06 | A04 / A03 | Media | `src/services/order.service.ts:21-51` | Creación de pedidos sin validación (DoS por `quantity`, platos de otro restaurante) |
| H-07 | A07 | Media | `src/contexts/employee/infrastructure/http/auth.routes.ts:6-7` | Sin rate limiting ni bloqueo en login/registro |
| H-08 | A05 | Media | `src/app.ts:16-17` | CORS abierto a cualquier origen y sin helmet |
| H-09 | A05 | Media | `src/controllers/order.controller.ts:19-25,78-84` | Fuga de `error.message` y manejo de errores inconsistente |
| H-10 | A09 | Media | `src/contexts/shared/infrastructure/http/errorHandler.ts:32` | Sin logging de errores ni eventos de seguridad |
| H-11 | A07 | Media | `src/contexts/employee/domain/Employee.ts:14-34`, `src/contexts/employee/application/RegisterClientUseCase.ts:38` | Sin política de contraseñas ni validación de entrada |
| H-12 | A03 / A04 | Media | `src/services/dish.service.ts:103`, `src/models/dish.model.ts:37` | Validación de tipos insuficiente en precios y cantidades (a confirmar) |
| H-13 | A04 | Media | `src/services/order.service.ts:80-83` | Transiciones de estado de pedido sin restricción |
| H-14 | A07 | Baja | `src/contexts/shared/infrastructure/http/middlewares.ts:25-26` | JWT sin revocación, sin verificación de usuario y sin algoritmo fijado |
| H-15 | A07 | Baja | `src/contexts/shared/domain/value-objects/Email.ts:14`, `src/contexts/employee/application/LoginUseCase.ts:29` | Email sin normalizar, enumeración de usuarios y diferencia de tiempos |
| H-16 | A04 | Baja | `src/contexts/employee/infrastructure/http/EmployeeController.ts:38` | `limit` sin tope en listado de empleados |
| H-17 | A03 / A10 | Baja | `src/services/restaurant.service.ts:49` | `logoUrl` sin validar (a confirmar) |
| H-18 | A07 | Baja | `src/scripts/seed.ts` / `CLAUDE.md` | Contraseñas de seed iguales al email |

## 2. Detalle de hallazgos

### H-01 (Crítica, A02/A07) Secreto JWT hardcodeado como fallback

Descripción: si `JWT_SECRET` no está definida, el secreto es la cadena literal `'super-secret-resttek-key'`, visible en el repositorio. El valor está duplicado en dos ficheros y la aplicación arranca sin avisar.

Evidencia:
- `src/contexts/shared/infrastructure/http/middlewares.ts:4`: `const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-resttek-key'`
- `src/contexts/employee/infrastructure/BcryptAuthService.ts:5`: `const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-resttek-key'`

Escenario: un atacante que lea el repositorio firma `jwt.sign({id:'x', role:'admin', restaurantId:null}, 'super-secret-resttek-key')` y obtiene acceso total (crear empleados admin, listar usuarios, modificar restaurantes). Aunque se defina la variable en producción, un despliegue que la omita queda expuesto sin ningún error.

Recomendación: eliminar el fallback y hacer que la app falle al arrancar si `JWT_SECRET` falta o tiene menos de 32 caracteres (salvo `NODE_ENV=test`). Centralizar el secreto en un único módulo de `src/config` (hoy está duplicado). Rotar el secreto en cualquier entorno que haya usado el valor por defecto.

### H-02 (Alta, A01) Cambio de estado de items sin control por rol ni restaurante

Descripción: `PATCH /orders/:orderId/items/:itemId/status` solo usa `authenticate`. No hay `authorize`, no se comprueba el rol (cocinero/camarero), la categoría del plato, ni que el pedido pertenezca al restaurante del usuario. Confirma la issue conocida de que cada rol solo debería modificar el estado de sus items.

Evidencia:
- `src/routes/order.routes.ts:18`: `router.patch('/:orderId/items/:itemId/status', authenticate, orderController.updateItemStatus.bind(orderController))`
- `src/controllers/order.controller.ts:70-76`: el controlador no lee `req.user`.
- `src/services/order.service.ts:69-84`: `updateItemStatus(orderId, itemId, status)` no recibe el usuario.

Escenario: un cliente registrado vía `POST /auth/register` (público) obtiene un token con rol `cliente`, lista `/orders/active?restaurantId=X` y marca como `entregado` los items de otros clientes (o un cocinero de un restaurante altera pedidos de otro). Un camarero puede marcar `listo` items de cocina.

Recomendación: pasar `req.user` al servicio; permitir solo `cocinero` (pendiente a preparando a listo) sobre items de cocina, `camarero` (listo a entregado), `admin`/`manager` según política; verificar `order.restaurantId === user.restaurantId`; añadir `authorize` en la ruta y tests por rol.

### H-03 (Alta, A01) IDOR en lectura de pedidos

Descripción: `GET /orders/active?restaurantId=` y `GET /orders/:id` devuelven pedidos a cualquier usuario autenticado sin comprobar rol ni propiedad. `getById` devuelve datos de otro cliente (`clientId`, mesa, notas).

Evidencia:
- `src/routes/order.routes.ts:15,17`: solo `authenticate`.
- `src/controllers/order.controller.ts:30-36`: usa el `restaurantId` del query sin compararlo con el del token.
- `src/controllers/order.controller.ts:59`: `this.orderService.getById(req.params.id as string)` sin comprobar `order.clientId === user.id`.

Escenario: un `cliente` itera UUIDs conocidos o llama a `/orders/active?restaurantId=<id público>` (los ids de restaurante son públicos en `/public/restaurants`) y ve todos los pedidos activos, con notas que pueden contener datos personales (alergias).

Recomendación: `/active` solo para roles de personal y forzar `restaurantId = user.restaurantId` (admin puede elegir); `/:id` permitido al cliente propietario o al personal del mismo restaurante.

### H-04 (Alta, A01) Sin aislamiento por restaurante en platos e ingredientes

Descripción: las rutas `/restaurants/:restaurantId/dishes|ingredients` autorizan por rol, pero nunca comparan `:restaurantId` ni el `id` del recurso con `req.user.restaurantId`. Además `update`/`delete` operan por `id` sin verificar que el recurso pertenezca al `restaurantId` de la URL.

Evidencia:
- `src/routes/dish.routes.ts:14-18` y `src/routes/ingredient.routes.ts:14-18`: solo `authenticate, authorize([...])`.
- `src/repositories/dish.repository.ts:34,61,80`: lectura, UPDATE y DELETE por `id` únicamente.
- `src/services/dish.service.ts:48-78`: `update`/`delete` no reciben `restaurantId`.

Escenario: un `manager` del restaurante A hace `DELETE /restaurants/A/dishes/<id de plato de B>` (o `PUT`) y borra o cambia precios del restaurante B; también puede leer ingredientes/platos de B con `GET /restaurants/B/dishes` (roles manager/cocinero/camarero).

Recomendación: middleware `authorizeRestaurant` que exija `user.role === 'admin' || user.restaurantId === req.params.restaurantId`, y consultas con `WHERE id = ? AND restaurant_id = ?`. En `src/routes/restaurant.routes.ts:16` (`GET /restaurants/:id`) aplicar la misma regla (los datos públicos ya están en `/public`).

### H-05 (Alta, A06) Dependencias vulnerables

Descripción: `npm audit -w @resttek/api --json` se ejecutó correctamente y reporta 22 vulnerabilidades: 4 críticas, 13 altas, 2 moderadas, 3 bajas. Directas: `sqlite3` (alta, vía cadena de build `tar`/`node-gyp`/`make-fetch-happen`/`cacache`; el fix propuesto es sqlite3 6.x, cambio mayor) y `vitest` (crítica, solo dev). Transitivas relevantes en runtime: `body-parser` 2.0.0-2.3.0 (alta, DoS por límite inválido), `qs` (moderada), `proxy-addr` (crítica según audit; a confirmar la explotabilidad real), `form-data`, `nanoid`, `ip-address`. Las críticas `tar` y `tinypool` son de instalación/dev. Muchas afectan solo a build o tests.

Evidencia: `package.json` (`"sqlite3": "^5.1.7"`, `"vitest": "^3.1.1"`, `"express": "^5.2.1"`) y salida de `npm audit`.

Escenario: DoS contra la API vía `body-parser` si el servidor usa una versión afectada; compromiso de la máquina de build vía `tar` al instalar paquetes manipulados.

Recomendación: ejecutar `npm audit fix` y actualizar `express`/`body-parser`, `vitest` a 4.1.11 o superior y evaluar `sqlite3` 6.x; añadir `npm audit --omit=dev` al CI; mantener el lockfile.

### H-06 (Media, A04/A03) Creación de pedidos sin validación

Descripción: `OrderService.create` no valida el cuerpo. Itera `quantity` veces sin tope, no comprueba que `restaurantId` exista, que los `dishId` existan ni que pertenezcan a ese restaurante, ni que estén disponibles.

Evidencia: `src/services/order.service.ts:27-28`: `for (const item of request.items) { for (let i = 0; i < item.quantity; i++) {`. El `restaurantId`, `tableId` y `notes` se insertan tal cual (`src/repositories/order.repository.ts:44-55`).

Escenario: `POST /orders` con `quantity: 1e9` agota memoria/CPU (DoS autenticado, accesible a cualquier cliente registrado). Con `items` ausente se lanza `TypeError`. Se pueden crear pedidos con platos de otro restaurante o no disponibles; `notes` sin longitud máxima permite inflar la base de datos.

Recomendación: validar con un esquema (zod/valibot): `quantity` entero 1..50, `items` array acotado, `notes` de 500 caracteres como máximo; verificar existencia, disponibilidad y pertenencia de los platos al restaurante.

### H-07 (Media, A07) Sin rate limiting en autenticación

Descripción: `POST /auth/login` y `/auth/register` no tienen límite de intentos ni bloqueo de cuenta. No hay dependencia como `express-rate-limit`.

Evidencia: `src/contexts/employee/infrastructure/http/auth.routes.ts:6-7`; `package.json` no incluye librería de rate limiting.

Escenario: fuerza bruta o credential stuffing contra `admin@resttek.com`; además bcrypt (coste 10) permite saturar CPU con muchas peticiones. Registro masivo de cuentas.

Recomendación: `express-rate-limit` en `/auth/*` (p. ej. 5-10 intentos cada 15 min por IP y email) y un límite global más laxo; considerar bloqueo temporal progresivo.

### H-08 (Media, A05) CORS abierto y sin cabeceras de seguridad

Descripción: `cors()` sin opciones permite cualquier origen. No se usa `helmet`; Express anuncia `X-Powered-By`. No hay `trust proxy` configurado (relevante para el rate limiting por IP).

Evidencia: `src/app.ts:16`: `app.use(cors())`; `src/app.ts:17`: `app.use(express.json())` (límite por defecto de 100 kb, aceptable).

Escenario: cualquier web de terceros puede invocar la API desde el navegador de un usuario si dispone del token (por ejemplo, si el frontend lo guarda en un almacén accesible por scripts). Faltan cabeceras como `X-Content-Type-Options` y HSTS.

Recomendación: `cors({ origin: [orígenes de los tres frontends] })`, añadir `helmet()` y `app.disable('x-powered-by')`.

### H-09 (Media, A05) Fuga de mensajes de error y manejo inconsistente

Descripción: los controladores de pedidos usan su propio `try/catch` en lugar del `errorHandler` central. `createOrder` devuelve `error.message` de cualquier `Error`, lo que incluye errores de SQLite (por ejemplo `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`) y `TypeError` internos. El `errorHandler` central sí oculta los detalles en 500 (correcto, no hay fuga de stack). `OrderNotFoundError` no está en `NOT_FOUND_ERRORS`, y en `updateItemStatus` un pedido inexistente devuelve 400 en vez de 404.

Evidencia: `src/controllers/order.controller.ts:19-21`: `if (error instanceof Error) { res.status(400).json({ error: error.message })`.

Escenario: un atacante envía un `dishId` inexistente y obtiene mensajes internos de la base de datos, útiles para el reconocimiento.

Recomendación: delegar con `next(error)` en el `errorHandler` central y devolver mensajes genéricos para errores no controlados.

### H-10 (Media, A09) Sin logging ni monitorización

Descripción: no hay logger. El `errorHandler` responde 500 sin registrar el error; los controladores de pedidos tragan la excepción (`catch (error)` sin log). No se registran logins fallidos, cambios de rol, creación de empleados ni accesos denegados (401/403).

Evidencia: `src/contexts/shared/infrastructure/http/errorHandler.ts:32` (respuesta 500 sin `console.error` ni logger); `src/controllers/order.controller.ts:38-40,52-54`.

Escenario: un ataque de fuerza bruta o una escalada de privilegios no deja rastro; los errores 500 de producción no son diagnosticables.

Recomendación: logger estructurado (pino) con request id; registrar eventos de seguridad (login fallido/exitoso, 401/403, creación de empleados) y errores 500 con stack solo en logs.

### H-11 (Media, A07) Sin política de contraseñas ni validación de entrada

Descripción: ni `Employee.create` ni los casos de uso validan la contraseña (longitud, complejidad, tipo). Si falta `password`, `bcrypt.hash(undefined)` lanza un error que acaba en 500. Una contraseña de 1 carácter es válida. bcrypt trunca a 72 bytes y no hay límite máximo previo. El coste bcrypt es 10, mínimo aceptable.

Evidencia: `src/contexts/employee/application/RegisterClientUseCase.ts:38` y `CreateEmployeeUseCase.ts:28` hashean la contraseña directamente; `Employee.ts:14-34` solo valida el hash. `BcryptAuthService.ts:6`: `SALT_ROUNDS = 10`.

Escenario: cuentas con contraseñas triviales ("1") expuestas a fuerza bruta (junto a H-07).

Recomendación: validar longitud mínima (8-12) y máxima (72) y tipo `string`; subir el coste a 12.

### H-12 (Media, A03/A04) Validación de tipos insuficiente (a confirmar)

Descripción: las comprobaciones numéricas asumen `number`. `props.price <= 0` con un string no numérico (`"abc"`) es `NaN <= 0`, es decir `false`, y pasa la validación; SQLite (tipado dinámico) puede almacenar texto en la columna `REAL`. Lo mismo ocurre con `quantity` de ingredientes (`src/models/dish.model.ts:37`) y `currentStock` (`src/services/ingredient.service.ts:87`). Un `name` numérico provoca error en `.trim()` (500 en vez de 400). No hay límites de longitud en `name`/`description`.

Evidencia: `src/services/dish.service.ts:103` (aprox.): `if (props.price <= 0)`.

Escenario: un manager crea un plato con `price: "gratis"` o `Infinity` (pasa), corrompiendo el catálogo y los cálculos de precio en frontend.

Recomendación: esquema de validación (zod) con `z.number().positive().finite()`, longitudes máximas y tipos estrictos en todos los controladores.

### H-13 (Media, A04) Transiciones de estado sin restricción

Descripción: el dominio define pendiente, preparando, listo, entregado, pero `updateItemStatus` acepta cualquier estado válido desde cualquier estado (incluso retroceder o saltar de `pendiente` a `entregado`).

Evidencia: `src/services/order.service.ts:80-83`.

Escenario: un item se marca `entregado` sin pasar por cocina, o se reabre un item ya entregado alterando el estado de sala y cocina.

Recomendación: validar la transición permitida en el modelo (`canTransition(from, to)`) y vincularla al rol (ver H-02).

### H-14 (Baja, A07) JWT sin revocación, sin verificación de usuario ni algoritmo fijado

Descripción: el token dura 8 h (aceptable) y no hay refresh ni revocación. `authenticate` no consulta la BD: un empleado borrado o degradado conserva su rol hasta que caduca. `jwt.verify(token, JWT_SECRET)` no fija `algorithms`; con un secreto de tipo cadena `jsonwebtoken` 9 solo acepta HS*, por lo que no es explotable hoy, pero conviene fijarlo. `req.user` se tipa como `any` y no se valida la forma del payload.

Evidencia: `src/contexts/shared/infrastructure/http/middlewares.ts:25-26`: `const decoded = jwt.verify(token, JWT_SECRET)` / `req.user = decoded`; `BcryptAuthService.ts:18`: `jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })`.

Recomendación: `jwt.verify(token, secret, { algorithms: ['HS256'] })`, reducir la expiración o añadir refresh tokens y lista de revocación, y tipar el payload.

### H-15 (Baja, A07) Email sin normalizar, enumeración y temporización

Descripción: el VO `Email` no pasa a minúsculas ni hace `trim`, y la búsqueda es sensible a mayúsculas: `A@x.com` y `a@x.com` son cuentas distintas. `POST /auth/register` revela si un email existe (`DuplicatedEmailError`). En login, si el usuario no existe se responde sin ejecutar bcrypt, lo que permite distinguir usuarios por tiempo de respuesta (el mensaje es uniforme, correcto).

Evidencia: `src/contexts/shared/domain/value-objects/Email.ts:14` (regex sin normalización); `src/contexts/employee/application/LoginUseCase.ts:29-31`.

Recomendación: normalizar a minúsculas con `trim` antes de validar y guardar; ejecutar una comparación bcrypt ficticia cuando el usuario no existe.

### H-16 (Baja, A04) `limit` sin tope

Descripción: `GET /employees?limit=` (solo admin) acepta cualquier entero, incluidos valores enormes o negativos (SQLite trata `LIMIT -1` como sin límite).

Evidencia: `src/contexts/employee/infrastructure/http/EmployeeController.ts:38`: `const limit = parseInt(req.query.limit as string) || 10`.

Recomendación: acotar a 1..100.

### H-17 (Baja, A03/A10) `logoUrl` sin validar (a confirmar)

Descripción: `logoUrl` de restaurante se guarda sin validar esquema ni longitud. No hay SSRF en la API (nunca se hace una petición saliente con ese valor). El riesgo está en los frontends: una URL `javascript:` o `data:` renderizada en `href`/`src` sería un vector XSS; a confirmar en `web-*`.

Evidencia: `src/services/restaurant.service.ts:49,72` (se asigna `dto.logoUrl` directamente); `src/routes/restaurant.public.routes.ts` lo expone sin autenticación.

Recomendación: aceptar solo `https://` con `new URL()` y longitud máxima.

### H-18 (Baja, A07) Contraseñas de seed predecibles

Descripción: según `CLAUDE.md`, la contraseña de cada usuario de prueba es su email (p. ej. `admin@resttek.com`). Correcto en desarrollo, peligroso si el seed se ejecuta contra un entorno desplegado. No se verificó el script línea a línea.

Recomendación: impedir `npm run seed` con `NODE_ENV=production` o generar contraseñas aleatorias.

## 3. Categorías revisadas sin hallazgos (o con riesgo mínimo)

- **A03 Injection (SQL)**: sin hallazgos de inyección SQL. Se revisaron los repositorios (`employee`, `restaurant`, `dish`, `ingredient`, `order`) y `src/config/database.ts`: todas las consultas usan `?` con parámetros; no hay concatenación ni plantillas con datos de usuario (las únicas plantillas son SELECT multilínea sin interpolación). El filtro `role` y `limit/offset` también se parametrizan. Las migraciones usan SQL estático. (Ver H-12/H-17 solo para validación de tipos.)
- **A02 Cryptographic Failures (contraseñas)**: contraseñas con bcrypt (coste 10) y comparación con `bcrypt.compare`; el hash nunca se devuelve en las respuestas (los controladores mapean campos explícitos). `resttek.db` y los ficheros de entorno están en `.gitignore` y no están versionados (`git ls-files` no los lista). El único fallo es el secreto JWT (H-01). No se revisó TLS (fuera del alcance de la app).
- **A04 Insecure Design (mass assignment/escalada de rol)**: `POST /auth/register` fuerza `role: 'cliente'` y `restaurantId: null` (`src/contexts/employee/application/RegisterClientUseCase.ts:46-48`), ignorando campos extra del body; la creación de empleados con rol arbitrario es solo `admin`.
- **A01 (cobertura de middlewares)**: todas las rutas de gestión (`employees`, `restaurants`, `ingredients`, `dishes`) aplican `authenticate` y `authorize`. Las únicas rutas sin autenticación son las intencionalmente públicas: `/api/v1/public/restaurants`, `/public/restaurants/:id/dishes` (solo platos disponibles), `/auth/login`, `/auth/register` y `/health`. Los fallos de A01 son de granularidad (H-02, H-03, H-04), no de ausencia de middleware. `GET /orders/mine` filtra correctamente por `user.id`.
- **A08 Software and Data Integrity Failures**: sin deserialización insegura ni `eval`; no hay actualizaciones automáticas ni pipelines en el alcance. Pendiente solo la integridad de transiciones (H-13) y revisar CI/CD, fuera del alcance.
- **A10 SSRF**: la API no realiza peticiones HTTP salientes ni usa URLs de usuario en el servidor (no hay `fetch`, `axios`, `http.request`). Solo `logoUrl` se almacena (H-17, riesgo en cliente).
- **A05 (errores)**: el `errorHandler` central devuelve `InternalServerError / Something went wrong` en errores desconocidos, sin stack trace ni detalles. La única fuga es H-09 en el controlador de pedidos.

## 4. Notas de método

- Lectura de rutas, controladores de pedidos, restaurante y platos, servicios, repositorios, modelos, middlewares, `config/database.ts`, `server.ts` y `app.ts`. Los controladores e ingredientes y restaurante se revisaron de forma parcial (patrón idéntico a platos).
- `npm audit -w @resttek/api --json` se ejecutó desde la raíz sin errores de red; parte de las vulnerabilidades corresponde a dependencias de desarrollo y a la cadena de build de sqlite3.
- No se ejecutaron tests ni se probó la API en vivo; los escenarios de explotación se derivan del código.
- Los números de línea son aproximados en `dish.service.ts` (cerca de la 103) y en los rangos indicados.
