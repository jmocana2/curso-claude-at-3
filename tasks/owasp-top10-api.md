# Auditoría OWASP Top 10 (2021) — `packages/api`

Alcance: `packages/api/src` (Express 5 + TypeScript + SQLite), excluyendo `*.test.ts` y mocks. Todos los hallazgos se han verificado leyendo el código. No se ha leído ningún fichero `.env` (bloqueado por hook del proyecto); `.gitignore` excluye `.env*` y `*.db`, y ningún `.env` ni `.db` está versionado.

## Resumen ejecutivo

| Severidad | Nº | IDs |
|---|---|---|
| Crítica | 3 | API-01, API-02, API-03 |
| Alta | 4 | API-04, API-05, API-06, API-07 |
| Media | 5 | API-08, API-09, API-10, API-11, API-12 |
| Baja | 3 | API-13, API-14, API-15 |
| **Total** | **15** | |

| ID | Categoría | Severidad | Título |
|---|---|---|---|
| API-01 | A07 / A02 | Crítica | Secreto JWT con valor por defecto público |
| API-02 | A01 | Crítica | Autorización de pedidos ausente (IDOR, sin roles ni tenant) |
| API-03 | A01 | Crítica | Gestión de platos/ingredientes sin comprobar pertenencia al restaurante |
| API-04 | A07 | Alta | Registro de clientes sin política de contraseña |
| API-05 | A07 | Alta | Sin rate limiting ni bloqueo en login/registro |
| API-06 | A01 | Alta | Restaurantes: empleados no admin pueden leer cualquier restaurante por ID |
| API-07 | A04 | Alta | Pedidos: precio/plato/restaurante no validados; cantidad sin límite (DoS) |
| API-08 | A05 | Media | CORS abierto a cualquier origen |
| API-09 | A05 | Media | Sin cabeceras de seguridad (helmet) ni límite de body explícito |
| API-10 | A07 | Media | Tokens JWT sin revocación, algoritmo no fijado, 8 h de vida |
| API-11 | A09 | Media | Sin logging de seguridad ni de errores |
| API-12 | A03 / A04 | Media | Validación de entrada insuficiente (tipos, `price`, `quantity`, `limit`) |
| API-13 | A07 | Baja | Enumeración de usuarios por registro (`DuplicatedEmailError`) |
| API-14 | A05 | Baja | Manejo de errores inconsistente en `order.controller` |
| API-15 | A06 | Baja | Dependencias sin verificación automatizada |

---

## Hallazgos

### API-01 — Secreto JWT con valor por defecto público
- **Categoría:** A07 Identification and Authentication Failures (también A02 Cryptographic Failures)
- **Severidad:** Crítica
- **Ficheros:** `src/contexts/shared/infrastructure/http/middlewares.ts:4`, `src/contexts/employee/infrastructure/BcryptAuthService.ts:5`
- **Descripción:** si `JWT_SECRET` no está definido, se usa un literal presente en el repositorio. La aplicación arranca igualmente sin avisar. El secreto está duplicado en dos ficheros.
- **Evidencia:**
  ```ts
  const JWT_SECRET: string = process.env.JWT_SECRET || 'super-secret-resttek-key'
  ```
- **Impacto:** cualquiera que conozca el repositorio puede forjar un JWT con `role: 'admin'` y obtener control total de la API.
- **Recomendación:** eliminar el fallback y abortar el arranque si falta `JWT_SECRET` (o es débil, < 32 bytes). Centralizar la lectura del secreto en un único módulo de configuración. Documentar la variable en `.env.example`.

### API-02 — Autorización de pedidos ausente (IDOR, sin roles ni tenant)
- **Categoría:** A01 Broken Access Control
- **Severidad:** Crítica
- **Ficheros:** `src/routes/order.routes.ts:14-18`, `src/controllers/order.controller.ts:28-41, 57-68, 70-85`
- **Descripción:** todas las rutas de pedidos solo usan `authenticate`; ninguna usa `authorize`. Por tanto cualquier usuario autenticado, incluido un `cliente` recién registrado:
  - `GET /orders/:id` lee cualquier pedido (sin comprobar `clientId` ni restaurante).
  - `GET /orders/active?restaurantId=X` lista los pedidos activos de cualquier restaurante.
  - `PATCH /orders/:orderId/items/:itemId/status` cambia el estado de cualquier ítem (operación reservada a cocina/camareros).
- **Evidencia:**
  ```ts
  router.get('/:id', authenticate, orderController.getById.bind(orderController))
  router.patch('/:orderId/items/:itemId/status', authenticate, orderController.updateItemStatus.bind(orderController))
  ```
- **Impacto:** fuga de datos de otros clientes/restaurantes (IDs de cliente, notas) y manipulación del flujo de cocina por cualquier cliente.
- **Recomendación:** `authorize(['admin','manager','camarero','cocinero'])` en `active` y `PATCH`; en `GET /:id` permitir solo al propietario (`order.clientId === user.id`) o personal del mismo `restaurantId`; en `active` y `PATCH` comparar `user.restaurantId` con el restaurante del pedido (admin exento). Responder 404 en vez de 403 para no revelar existencia.

### API-03 — Platos e ingredientes sin comprobar pertenencia al restaurante
- **Categoría:** A01 Broken Access Control
- **Severidad:** Crítica
- **Ficheros:** `src/routes/dish.routes.ts:14-18`, `src/routes/ingredient.routes.ts:14-18`, `src/services/dish.service.ts:44-69, 71-77`, `src/services/ingredient.service.ts:39-65`, `src/repositories/dish.repository.ts:32-40`, `src/repositories/ingredient.repository.ts:~28-33, 63-65`
- **Descripción:** las rutas se montan bajo `/restaurants/:restaurantId/...`, pero `authorize` solo comprueba el rol, nunca que `user.restaurantId === req.params.restaurantId`. Además `findById/update/delete` usan solo `id`, ignorando `restaurantId` de la URL. Un `manager` del restaurante A puede crear platos en B, y leer, modificar o borrar platos/ingredientes de B.
- **Evidencia:**
  ```ts
  router.delete('/:id', authenticate, authorize(['admin', 'manager']), dishController.delete)
  // service: const dish = await this.dishRepository.findById(id)  // sin restaurantId
  ```
  También `GET /restaurants/:restaurantId/employees` (`restaurant-employee.routes.ts:7`) y `GET .../dishes` / `ingredients` listan por cualquier `restaurantId` de la URL.
- **Impacto:** acceso horizontal entre restaurantes (multi-tenant roto): alteración o borrado de cartas e inventario de terceros.
- **Recomendación:** middleware `authorizeRestaurant` que exija `user.role === 'admin' || user.restaurantId === req.params.restaurantId`; en repositorios consultar siempre por `id AND restaurant_id`.

### API-04 — Registro de clientes sin política de contraseña
- **Categoría:** A07 Identification and Authentication Failures
- **Severidad:** Alta
- **Ficheros:** `src/contexts/employee/application/RegisterClientUseCase.ts:38`, `src/contexts/employee/application/CreateEmployeeUseCase.ts:28`, `src/contexts/employee/domain/Employee.ts:50`
- **Descripción:** `password` se pasa directamente a `bcrypt.hash`. No se valida existencia, tipo, longitud ni complejidad (`undefined` o `''` provocan error 500 o contraseñas triviales aceptadas, p. ej. `"1"`). El hash resultante solo se comprueba como no vacío.
- **Evidencia:**
  ```ts
  const passwordHash = await this.authService.hashPassword(dto.password)
  ```
- **Impacto:** cuentas con contraseñas débiles; un `password` no string (p. ej. objeto/array) puede causar errores 500 o comportamiento inesperado de bcrypt. Además, el seed crea usuarios cuya contraseña es su propio email (`scripts/seed.ts:22, 51`); si se ejecuta en un entorno real, quedan credenciales predecibles incluido el admin.
- **Recomendación:** objeto de valor `Password` (string, mínimo 8-12 caracteres, máximo 72 bytes para bcrypt, lista de contraseñas comunes). Que el seed lea contraseñas de variables de entorno o genere aleatorias y se bloquee con `NODE_ENV=production`.

### API-05 — Sin rate limiting ni bloqueo de cuentas
- **Categoría:** A07 Identification and Authentication Failures
- **Severidad:** Alta
- **Ficheros:** `src/app.ts:16-27`, `src/contexts/employee/infrastructure/http/auth.routes.ts:6-7`
- **Descripción:** no existe ninguna dependencia ni middleware de limitación de peticiones. `/auth/login` y `/auth/register` son públicos; el coste de bcrypt (10 rondas) además los hace un vector de DoS.
- **Evidencia:** `app.use(cors()); app.use(express.json())` sin ningún limitador; `package.json` no incluye `express-rate-limit`.
- **Impacto:** fuerza bruta/credential stuffing sobre login (con el seed, contraseñas predecibles) y creación masiva de cuentas.
- **Recomendación:** `express-rate-limit` (global y más estricto en `/auth/*`), retardo/bloqueo progresivo por email+IP, y comparación de hash dummy cuando el usuario no existe para igualar tiempos.

### API-06 — Lectura de restaurantes por ID sin restricción
- **Categoría:** A01 Broken Access Control
- **Severidad:** Alta
- **Ficheros:** `src/routes/restaurant.routes.ts:16`, `src/controllers/restaurant.controller.ts:25-32`
- **Descripción:** `GET /restaurants/:id` solo exige autenticación; devuelve cualquier restaurante (incluye email, teléfono, nombre y apellidos del propietario) a cualquier usuario, incluidos clientes. Es incoherente con `getAll`, que limita al restaurante del usuario. Los mismos datos ya se exponen sin autenticación en `GET /public/restaurants` y `/public/restaurants/:id` (`restaurant.public.routes.ts:13-14`) mediante el mismo `toJSON`.
- **Evidencia:**
  ```ts
  router.get('/:id', authenticate, restaurantController.getById)
  // toJSON incluye email, phone, ownerFirstName, ownerLastName
  ```
- **Impacto:** exposición de datos personales del propietario (PII) a anónimos a través de los endpoints públicos.
- **Recomendación:** usar un DTO público reducido (id, nombre, dirección, logo) para las rutas `/public`; dejar los campos del propietario solo para admin o personal del propio restaurante.

### API-07 — Pedidos: datos del cliente sin validar
- **Categoría:** A04 Insecure Design
- **Severidad:** Alta
- **Ficheros:** `src/services/order.service.ts:21-51`, `src/controllers/order.controller.ts:9-18`
- **Descripción:** `OrderService.create` solo comprueba que `restaurantId` no esté vacío. No verifica: que el restaurante exista, que `dishId` exista, pertenezca a ese restaurante y esté `available`; que `items` sea un array; ni límites de `quantity`. Por cada unidad se crea una fila, de modo que `quantity` enorme genera millones de inserciones secuenciales. `quantity` negativa o no numérica produce pedidos vacíos; `items` ausente lanza TypeError (400 con mensaje interno).
- **Evidencia:**
  ```ts
  for (const item of request.items) {
      for (let i = 0; i < item.quantity; i++) { items.push({ ... }) }
  ```
- **Impacto:** DoS con una sola petición autenticada (cualquier cliente registrado), pedidos con platos de otros restaurantes o no disponibles, e integridad de datos comprometida.
- **Recomendación:** validar esquema (p. ej. zod): `items` array de 1..N, `quantity` entero 1..máx, `dishId` existente, disponible y del restaurante; transacción para insertar el pedido; `notes` con longitud máxima.

### API-08 — CORS abierto a cualquier origen
- **Categoría:** A05 Security Misconfiguration
- **Severidad:** Media
- **Fichero:** `src/app.ts:16`
- **Descripción:** `cors()` sin opciones permite cualquier origen. La autenticación es por cabecera `Authorization` (no cookies), lo que reduce el riesgo CSRF, pero amplía la superficie desde cualquier web.
- **Evidencia:** `app.use(cors())`
- **Impacto:** cualquier sitio puede invocar la API desde el navegador de un usuario con token robado/almacenado; facilita abuso desde terceros.
- **Recomendación:** `cors({ origin: [lista blanca de los 3 frontends vía env], methods, allowedHeaders })`.

### API-09 — Sin cabeceras de seguridad ni límite de body explícito
- **Categoría:** A05 Security Misconfiguration
- **Severidad:** Media
- **Fichero:** `src/app.ts:14-17`
- **Descripción:** no se usa `helmet`; Express envía `X-Powered-By: Express`. `express.json()` usa el límite por defecto (100 kb) sin configuración consciente. No hay `trust proxy` ni forzado de HTTPS/HSTS (`server.ts:11` escucha en HTTP plano).
- **Evidencia:** `const app = express(); app.use(cors()); app.use(express.json())`
- **Impacto:** fingerprinting, ausencia de HSTS/`nosniff`, etc.
- **Recomendación:** añadir `helmet()`, `app.disable('x-powered-by')`, `express.json({ limit: '10kb' })` y terminar TLS en el proxy inverso.

### API-10 — Gestión débil de sesiones JWT
- **Categoría:** A07 Identification and Authentication Failures
- **Severidad:** Media
- **Ficheros:** `src/contexts/shared/infrastructure/http/middlewares.ts:25-26`, `src/contexts/employee/infrastructure/BcryptAuthService.ts:17-19`
- **Descripción:** `jwt.verify(token, JWT_SECRET)` sin `algorithms` explícito; `jwt.sign` sin `algorithm`, `issuer` ni `audience`. El rol y `restaurantId` van en el token y no se revalidan contra la BD: un cambio de rol o la eliminación del usuario no surte efecto hasta 8 h después. No hay logout ni lista de revocación. `req.user` se tipa como `any`.
- **Evidencia:** `jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })`
- **Impacto:** permisos obsoletos tras cambios de rol; imposibilidad de invalidar tokens comprometidos.
- **Recomendación:** fijar `algorithms: ['HS256']`, añadir `iss/aud`, reducir la vida del token con refresh token rotatorio, y revalidar usuario/rol en BD para operaciones sensibles. Tipar `req.user`.

### API-11 — Sin logging ni monitorización de seguridad
- **Categoría:** A09 Security Logging and Monitoring Failures
- **Severidad:** Media
- **Ficheros:** `src/contexts/shared/infrastructure/http/errorHandler.ts:32`, `src/app.ts`
- **Descripción:** no hay logger de peticiones ni de eventos de seguridad (login fallido, 401/403, creación de empleados, cambios de estado). El `errorHandler` devuelve un 500 genérico y descarta el error sin registrarlo; los controladores de pedidos hacen lo mismo en sus `catch`. Los únicos `console.log` están en `server.ts` y el seed.
- **Evidencia:** `res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' })` (sin `console.error`/logger previo).
- **Impacto:** ataques (fuerza bruta, abuso de IDOR) indetectables y fallos de producción sin traza.
- **Recomendación:** logger estructurado (pino/winston) con request-id, registro de eventos de autenticación/autorización y de los 500 con stack (sin datos sensibles), y alertas.

### API-12 — Validación de entrada insuficiente
- **Categoría:** A03 Injection / A04 Insecure Design
- **Severidad:** Media
- **Ficheros:** `src/controllers/dish.controller.ts:11-19`, `src/services/dish.service.ts:103`, `src/contexts/employee/infrastructure/http/EmployeeController.ts:38-40`, `src/contexts/employee/infrastructure/SqliteEmployeeRepository.ts:26-40`, `src/contexts/shared/domain/value-objects/Email.ts:14`
- **Descripción:** el cuerpo se pasa a los servicios sin esquema de validación ni comprobación de tipos. Ejemplos: `price` como string/`NaN`/`Infinity` (solo se verifica `<= 0`); `name`/`description` no string (`.trim()` lanza 500); `limit` sin tope (`/employees?limit=1000000`) y `limit` negativo (en SQLite `LIMIT -1` significa sin límite); `logoUrl` aceptada sin validar esquema/URL; el email se valida con regex pero no se normaliza a minúsculas (se puede duplicar `A@x.com` / `a@x.com`) y la búsqueda es sensible a mayúsculas.
- **Evidencia:**
  ```ts
  const limit = parseInt(req.query.limit as string) || 10   // admite negativos y valores enormes
  if (props.price <= 0) { throw new InvalidPriceError() }
  ```
- **Impacto:** errores 500, volcado completo de tablas, cuentas duplicadas por mayúsculas y datos inconsistentes. **Nota de inyección SQL:** verificado que todas las consultas SQL de repositorios y `database.ts` usan parámetros `?`; no se ha encontrado inyección SQL (ver sección de categorías sin hallazgos).
- **Recomendación:** esquemas zod/valibot en la capa HTTP; acotar `limit` (1..100) y `offset >= 0`; normalizar email (trim + lowercase); validar `logoUrl` (https) y precios finitos.

### API-13 — Enumeración de usuarios en el registro
- **Categoría:** A07 Identification and Authentication Failures
- **Severidad:** Baja
- **Fichero:** `src/contexts/employee/application/RegisterClientUseCase.ts:33-36`
- **Descripción:** el registro responde con `DuplicatedEmailError` (400) si el email ya existe, permitiendo comprobar qué emails están registrados. El login sí responde con un error genérico (`InvalidCredentialsError`), pero la diferencia de tiempo entre email inexistente (sin bcrypt) y existente permite también enumeración.
- **Evidencia:** `if (existingEmployee) { throw new DuplicatedEmailError() }`
- **Impacto:** facilita ataques dirigidos de fuerza bruta/phishing.
- **Recomendación:** respuesta uniforme + confirmación por email; hash dummy en login cuando el usuario no existe.

### API-14 — Manejo de errores inconsistente en pedidos
- **Categoría:** A05 Security Misconfiguration
- **Severidad:** Baja
- **Ficheros:** `src/controllers/order.controller.ts:19-25`, `src/contexts/shared/infrastructure/http/errorHandler.ts:4-23`
- **Descripción:** `createOrder` devuelve `error.message` de cualquier excepción con 400 (puede filtrar mensajes internos, p. ej. errores de SQLite como constraint de FK o `Cannot read properties of undefined`). Los demás controladores delegan en `errorHandler`. Además, `errorHandler` no mapea `OrderNotFoundError` a 404 y no incluye `InvalidCredentialsError` en contexto de pedidos.
- **Evidencia:**
  ```ts
  if (error instanceof Error) { res.status(400).json({ error: error.message }) }
  ```
- **Impacto:** divulgación de detalles internos; comportamiento incoherente (la actualización de ítem devuelve 400 para pedido no encontrado).
- **Recomendación:** que `order.controller` use `next(error)` y el `errorHandler` único; devolver mensajes genéricos para errores no controlados.

### API-15 — Componentes: sin verificación automatizada de vulnerabilidades
- **Categoría:** A06 Vulnerable and Outdated Components
- **Severidad:** Baja
- **Fichero:** `packages/api/package.json`
- **Descripción:** las dependencias están en versiones recientes (express ^5.2.1, jsonwebtoken ^9.0.3, bcrypt ^6.0.0, sqlite3 ^5.1.7, cors ^2.8.6, dotenv ^17.3.1) y no se han identificado CVE conocidos a partir del `package.json` (no se ha ejecutado `npm audit`: no se solicitaron comandos de red). Sin embargo no hay evidencia de `npm audit`/Dependabot en el flujo, y los rangos `^` permiten cambios no controlados sin lockfile revisado.
- **Impacto:** vulnerabilidades futuras sin detectar.
- **Recomendación:** ejecutar `npm audit` en CI, activar Dependabot/Renovate y exigir `npm ci` con lockfile. Declarar `engines.node >= 22`.

---

## Categorías revisadas sin hallazgos adicionales

- **A02 Cryptographic Failures (hashing):** las contraseñas se almacenan con bcrypt (10 rondas, sal incluida) en `BcryptAuthService.ts:10`; el hash nunca se devuelve en las respuestas (los controladores mapean campos explícitos). El único problema criptográfico es el secreto JWT (API-01).
- **A03 Injection (SQL):** todas las consultas de `repositories/*.ts`, `SqliteEmployeeRepository.ts` y `config/database.ts` utilizan sentencias parametrizadas (`?`); no hay concatenación de entrada de usuario en SQL. No hay uso de `eval`, `child_process` ni plantillas de servidor; no se ha encontrado inyección de comandos ni NoSQL.
- **A08 Software and Data Integrity Failures:** no hay deserialización insegura, descarga/ejecución de código, ni pipeline de actualización en la API. La verificación de JWT es correcta salvo lo indicado en API-10.
- **A10 Server-Side Request Forgery:** la API no realiza peticiones HTTP salientes (no hay `fetch`, `axios`, `http.request`); `logoUrl` solo se almacena y se devuelve como texto, sin ser descargada por el servidor. Recomendación preventiva: si en el futuro se descarga o procesa, validar con lista blanca.
- **A04 (aspectos positivos):** `Employee` y el VO `Role` validan roles y la creación de empleados está restringida a `admin`; el registro público fuerza `role: 'cliente'` y no acepta `role` del cuerpo (no hay escalada de privilegios por mass assignment en `/auth/register`). `PRAGMA foreign_keys = ON` está activado.
- **Base de datos / secretos en repositorio:** `resttek.db` y `.env*` están en `.gitignore` y no están versionados.
