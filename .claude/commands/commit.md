---
description: Crea un commit siguiendo la especificación Conventional Commits
argument-hint: [descripción o pista opcional del cambio]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Crea un commit siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

Pista opcional del usuario: $ARGUMENTS

## Contexto

- Estado actual: !`git status --short`
- Cambios preparados (staged): !`git diff --cached --stat`
- Cambios sin preparar: !`git diff --stat`
- Últimos commits (para seguir el estilo): !`git log --oneline -10`

## Pasos

1. Revisa los cambios con `git diff --cached` (y `git diff` si no hay nada preparado).
2. Si no hay nada en staging, propón qué ficheros añadir y añádelos por nombre con `git add <fichero>`. No uses `git add -A` ni `git add .`, y nunca añadas secretos (`.env`), bases de datos (`*.db`) ni ficheros ignorados.
3. Si los cambios mezclan propósitos distintos (por ejemplo, un `feat` y un `fix` no relacionados), propón dividirlos en varios commits en lugar de hacer uno solo.
4. Redacta el mensaje con el formato de abajo y crea el commit con un heredoc para respetar los saltos de línea.
5. Muestra el resultado con `git log --oneline -1`.

No hagas `push`, `amend` ni uses `--no-verify` salvo que el usuario lo pida explícitamente.

## Formato del mensaje

```
<tipo>(<ámbito opcional>)!: <descripción>

[cuerpo opcional]

[footer(s) opcionales]
```

### Tipos permitidos

| Tipo       | Cuándo usarlo                                                  |
| ---------- | -------------------------------------------------------------- |
| `feat`     | Nueva funcionalidad (MINOR en SemVer)                          |
| `fix`      | Corrección de un bug (PATCH en SemVer)                         |
| `docs`     | Solo documentación                                             |
| `style`    | Formato, espacios, `;`… sin cambiar la lógica                  |
| `refactor` | Cambio de código que no corrige un bug ni añade funcionalidad  |
| `perf`     | Mejora de rendimiento                                          |
| `test`     | Añadir o corregir tests                                        |
| `build`    | Sistema de build o dependencias (`package.json`, lockfiles)    |
| `ci`       | Configuración de integración continua                          |
| `chore`    | Tareas de mantenimiento que no tocan `src` ni tests            |
| `revert`   | Revierte un commit anterior                                    |

### Reglas

- **Ámbito** (opcional): la capa o módulo afectado, en minúsculas. En este proyecto: `controllers`, `services`, `repositories`, `models`, `utils`, `db`, `api`, `docs`, `scripts`.
- **Descripción**: en español, en imperativo y minúscula inicial ("añade paginación", no "Añadida paginación"), sin punto final, máximo ~72 caracteres en la primera línea.
- **Cuerpo** (opcional): separado por una línea en blanco; explica el *qué* y el *por qué*, no el *cómo*.
- **Breaking changes**: añade `!` tras el tipo/ámbito **y** un footer `BREAKING CHANGE: <descripción>`.
- **Footers**: formato `Token: valor` (por ejemplo `Refs: #123`, `Closes: #45`).

### Ejemplos

```
feat(api): añade paginación a GET /vendehumos
```

```
fix(services): valida que la categoría pertenezca a CATEGORIAS
```

```
refactor!: organiza el código en controllers, services y repositories

BREAKING CHANGE: index.js ya no exporta las rutas directamente
```
