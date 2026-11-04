# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Resttek: plataforma de gestión de restaurantes. Monorepo con npm workspaces (`packages/*`, scope `@resttek/*`): `api` (Express 5 + TypeScript + SQLite), tres frontends Angular 21 (`web-admin`, `web-empleados`, `web-clientes`) y `web-shared` (código compartido por los frontends). Requiere Node 22+. Documentación detallada en `docs/arquitectura` y `docs/dominio` (en español).

## Comandos (desde la raíz)

- `npm install` — instala todos los workspaces.
- `npm run seed` — puebla SQLite (`INSERT OR IGNORE`, idempotente). La contraseña de cada usuario de prueba es su propio email (p. ej. `admin@resttek.com`).
- `npm run dev:api` — API en :3000 (`/health`); las tablas se crean al arrancar.
- `npm run dev:admin` (:4200), `dev:empleados` (:4201), `dev:clientes` (:4202) — hacen proxy de `/api` a :3000.
- `npm test` — tests de la API (Vitest). En `packages/api`: `npm run test:watch`; un solo fichero: `npx vitest run src/services/order.service.test.ts`; por nombre: `-t "texto"`.
- Los frontends tienen `npm run build -w @resttek/web-admin` (no hay lint ni tests de frontend configurados).
- Los cambios en `web-shared` no se recargan solos: reinicia el dev server del frontend.

## Arquitectura de la API

Conviven **dos estilos**; identifica cuál aplica antes de tocar código:

1. **Hexagonal + DDD solo en `src/contexts/employee`** (domain / application / infrastructure). `Employee` es la única entidad con comportamiento: constructor privado + `create()` con validaciones, getters sin setters. Casos de uso con un único `execute()` y dependencias por constructor; interfaces con prefijo `I` (`IEmployeeRepository`). `contexts/shared` contiene el VO `Email`, middlewares y `errorHandler`.
2. **Por capas para `restaurant`, `dish`, `ingredient`, `order`**: `models/` (interfaces planas + `normalizeX()`), `repositories/` (interfaz sin prefijo `I` + implementación SQLite en el mismo fichero), `services/` (lógica y validación), `controllers/`, `routes/` (también componen dependencias). Los "value objects" aquí son tipos unión + `normalizeX()` (trim + lowercase, lanzan error de dominio), no clases.

Los tests viven junto al código (`*.test.ts`) y usan mocks de repositorio (`repositories/mocks/`, `employee/application/mocks/`). Errores en `src/errors` (`AppError`, `DomainErrors`).

## Dominio

Roles: admin, manager, camarero, cocinero, cliente. Estados de pedido: pendiente → preparando → listo → entregado. Categorías de plato: entrante, principal, postre, bebida. Unidades: kg, g, l, ml, unidad.

## Otros

`scripts/seed-issues.sh` crea issues de GitHub desde `scripts/issues.json` (requiere `gh` y `jq`). `ONBOARDING.md` es la guía de onboarding de equipo.
