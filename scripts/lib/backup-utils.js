'use strict';

/**
 * Utilidades puras del respaldo. Se mantienen sin dependencias y sin estado
 * para poder probarlas con `node --test scripts/backup.test.js` en cualquier
 * máquina, incluso sin PostgreSQL instalado.
 */

const BACKUP_PREFIX = 'marketcentral-';
const BACKUP_EXTENSION = '.dump';

function pad(value) {
  return String(value).padStart(2, '0');
}

/** `marketcentral-20261124-031500.dump` (hora local, ordenable). */
function buildDumpFileName(date = new Date()) {
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${BACKUP_PREFIX}${stamp}${BACKUP_EXTENSION}`;
}

/** Oculta la contraseña para que nunca aparezca en logs ni en el historial. */
function redactUrl(url) {
  if (!url) return '(sin URL)';
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '(URL inválida)';
  }
}

/** Días de retención: entero positivo o el valor por defecto (14). */
function parseKeepDays(value, fallback = 14) {
  const days = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(days) || days <= 0) return fallback;
  return days;
}

function isBackupFile(name) {
  return name.startsWith(BACKUP_PREFIX) && name.endsWith(BACKUP_EXTENSION);
}

/**
 * Nombres de respaldos que ya superaron la retención.
 * `entries` = [{ name, mtimeMs, isFile }]; los `.sha256` acompañantes se
 * eliminan junto al `.dump` que describen.
 */
function selectExpiredFiles(entries, keepDays, now = Date.now()) {
  const cutoff = now - keepDays * 24 * 60 * 60 * 1000;
  const expired = new Set();

  for (const entry of entries) {
    if (!entry.isFile || !isBackupFile(entry.name)) continue;
    if (entry.mtimeMs < cutoff) {
      expired.add(entry.name);
      expired.add(`${entry.name}.sha256`);
    }
  }

  return [...expired];
}

/** Extrae DATABASE_URL de un .env simple, sin ejecutar nada del archivo. */
function readDatabaseUrl(envText) {
  const match = /^\s*DATABASE_URL\s*=\s*(.+)\s*$/m.exec(envText ?? '');
  if (!match) return null;
  return match[1].trim().replace(/^['"]|['"]$/g, '');
}

module.exports = {
  BACKUP_EXTENSION,
  BACKUP_PREFIX,
  buildDumpFileName,
  isBackupFile,
  parseKeepDays,
  readDatabaseUrl,
  redactUrl,
  selectExpiredFiles,
};
