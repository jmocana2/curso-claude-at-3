#!/usr/bin/env node

/**
 * Sufijos de plantilla permitidos (p. ej. `.env.example`), ya que no contienen secretos.
 * @type {string[]}
 */
const ALLOWED_SUFFIXES = ['example', 'sample', 'template', 'dist'];

/**
 * Detecta referencias a ficheros `.env` o `.env.<algo>` dentro de un texto.
 * @type {RegExp}
 */
const ENV_FILE_PATTERN = /(?:^|[\\/\s"'`=:(*])\.env(?:\.([\w.-]+))?(?=$|[\s"'`;|&)<>,*])/gi;

/**
 * Indica si un texto referencia algún fichero `.env` no permitido.
 * @param {string | undefined} text Ruta, patrón o comando a inspeccionar.
 * @returns {boolean}
 */
function referencesEnvFile(text) {
  if (!text) return false;
  for (const match of String(text).matchAll(ENV_FILE_PATTERN)) {
    const suffix = match[1]?.toLowerCase();
    if (!suffix || !ALLOWED_SUFFIXES.includes(suffix)) return true;
  }
  return false;
}

/**
 * Extrae del input de la herramienta los valores que pueden apuntar a un fichero.
 * @param {string} toolName Nombre de la herramienta invocada.
 * @param {Record<string, unknown>} input Parámetros de la herramienta.
 * @returns {string[]}
 */
function candidatesFor(toolName, input) {
  switch (toolName) {
    case 'Read':
      return [input.file_path];
    case 'Grep':
      return [input.path, input.glob];
    case 'Glob':
      return [input.pattern, input.path];
    case 'Bash':
    case 'PowerShell':
      return [input.command];
    default:
      return [input.file_path, input.path, input.command];
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const toolName = payload.tool_name ?? '';
  const input = payload.tool_input ?? {};

  if (candidatesFor(toolName, input).some(referencesEnvFile)) {
    process.stderr.write(
      `Bloqueado por hook: no está permitido leer ficheros .env (herramienta ${toolName}). ` +
        'Usa .env.example si necesitas conocer las variables.\n',
    );
    process.exit(2);
  }

  process.exit(0);
});
