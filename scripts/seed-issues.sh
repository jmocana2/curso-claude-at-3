#!/usr/bin/env bash
#
# Crea issues en GitHub a partir de un archivo JSON.
#
# Uso:
#   ./scripts/seed-issues.sh [-f archivo.json] [-R owner/repo] [-n]
#
# Opciones:
#   -f, --file    Ruta al JSON de issues (por defecto: scripts/issues.json)
#   -R, --repo    Repositorio de GitHub owner/repo (por defecto, el del directorio actual)
#   -n, --dry-run Muestra lo que se crearía sin llamar a la API de GitHub
#   -h, --help    Muestra esta ayuda
#
# Formato esperado del JSON (array de objetos):
#   [
#     {
#       "title": "Título de la issue",
#       "type": "bug" | "feature",
#       "projects": ["web-admin", "api"],
#       "body": "Descripción de la issue"
#     },
#     ...
#   ]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_FILE="${SCRIPT_DIR}/issues.json"
REPO=""
DRY_RUN=false

usage() {
  sed -n '2,23p' "$0" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)
      JSON_FILE="$2"
      shift 2
      ;;
    -R|--repo)
      REPO="$2"
      shift 2
      ;;
    -n|--dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Opción desconocida: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: se requiere 'jq'. Instálalo antes de continuar." >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]] && ! command -v gh >/dev/null 2>&1; then
  echo "Error: se requiere GitHub CLI ('gh'). Instálalo antes de continuar." >&2
  exit 1
fi

if [[ ! -f "$JSON_FILE" ]]; then
  echo "Error: no se encuentra el archivo JSON '$JSON_FILE'." >&2
  exit 1
fi

if ! jq empty "$JSON_FILE" >/dev/null 2>&1; then
  echo "Error: '$JSON_FILE' no es un JSON válido." >&2
  exit 1
fi

GH_REPO_ARGS=()
if [[ -n "$REPO" ]]; then
  GH_REPO_ARGS=(--repo "$REPO")
fi

if [[ "$DRY_RUN" == false ]]; then
  if ! gh auth status >/dev/null 2>&1; then
    echo "Error: no has iniciado sesión en gh. Ejecuta 'gh auth login'." >&2
    exit 1
  fi

  if ! TARGET_REPO=$(gh repo view ${REPO:+"$REPO"} --json nameWithOwner -q .nameWithOwner 2>/dev/null); then
    echo "Error: no se puede acceder al repositorio '${REPO:-del directorio actual}'. Usa -R owner/repo." >&2
    exit 1
  fi

  # Crear etiquetas y asignarlas a issues requiere al menos permiso de triage;
  # sin él, GitHub responde con un 404 poco descriptivo.
  GH_USER=$(gh api user -q .login)
  if [[ "$(gh api "repos/${TARGET_REPO}" -q '.permissions.triage or .permissions.push')" != "true" ]]; then
    echo "Error: la cuenta '${GH_USER}' no tiene permisos de escritura (triage o superior) en '${TARGET_REPO}'." >&2
    echo "Pide acceso al propietario, cambia de cuenta con 'gh auth switch' o usa -R con un repo tuyo (p. ej. un fork)." >&2
    exit 1
  fi

  # Los forks tienen las issues desactivadas por defecto.
  if [[ "$(gh api "repos/${TARGET_REPO}" -q '.has_issues')" != "true" ]]; then
    echo "Error: '${TARGET_REPO}' tiene las issues desactivadas. Actívalas en Settings > General > Features > Issues." >&2
    exit 1
  fi

  # Se fija el repo resuelto para que etiquetas e issues vayan siempre al mismo.
  GH_REPO_ARGS=(--repo "$TARGET_REPO")
  echo "Repositorio: ${TARGET_REPO} (cuenta: ${GH_USER})"
fi

label_color() {
  case "$1" in
    bug) echo "d73a4a" ;;
    feature) echo "84b6eb" ;;
    proyecto:web-admin) echo "5319e7" ;;
    proyecto:web-empleados) echo "fbca04" ;;
    proyecto:web-clientes) echo "0e8a16" ;;
    proyecto:api) echo "1d76db" ;;
    *) echo "ededed" ;;
  esac
}

ENSURED_LABELS=" "

# Se intenta crear la etiqueta directamente y se ignora el error si ya existe.
# Así no depende de 'gh label list --search', que hace coincidencias aproximadas
# y no encuentra nombres con ':' (p. ej. "proyecto:api").
ensure_label() {
  local label="$1"

  case "$ENSURED_LABELS" in
    *" ${label} "*) return ;;
  esac
  ENSURED_LABELS="${ENSURED_LABELS}${label} "

  if [[ "$DRY_RUN" == true ]]; then
    return
  fi

  local output
  if output=$(gh label create "$label" --color "$(label_color "$label")" \
      ${GH_REPO_ARGS[@]+"${GH_REPO_ARGS[@]}"} 2>&1); then
    echo "Etiqueta '$label' creada."
  elif ! grep -Eqi "already.exists" <<<"$output"; then
    echo "Error al crear la etiqueta '$label': $output" >&2
    exit 1
  fi
}

total=$(jq 'length' "$JSON_FILE")
echo "Se van a procesar $total issues desde '$JSON_FILE'."

count=0
while IFS= read -r issue; do
  count=$((count + 1))

  title=$(jq -r '.title' <<<"$issue")
  body=$(jq -r '.body' <<<"$issue")
  type=$(jq -r '.type' <<<"$issue")

  labels=("$type")
  while IFS= read -r project; do
    labels+=("proyecto:${project}")
  done < <(jq -r '.projects[]' <<<"$issue")

  for label in "${labels[@]}"; do
    ensure_label "$label"
  done

  label_args=()
  for label in "${labels[@]}"; do
    label_args+=(--label "$label")
  done

  echo "[$count/$total] $title (${labels[*]})"

  if [[ "$DRY_RUN" == true ]]; then
    continue
  fi

  gh issue create \
    --title "$title" \
    --body "$body" \
    "${label_args[@]}" \
    ${GH_REPO_ARGS[@]+"${GH_REPO_ARGS[@]}"} >/dev/null
done < <(jq -c '.[]' "$JSON_FILE")

echo "Listo."
