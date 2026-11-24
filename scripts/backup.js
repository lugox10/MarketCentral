'use strict';

/**
 * Respaldo lógico de PostgreSQL.
 *
 * Uso:
 *   node scripts/backup.js                 # respalda DATABASE_URL en ./backups
 *   node scripts/backup.js --dry-run       # valida entorno y muestra el comando
 *   node scripts/backup.js --out=D:\copias --keep=30
 *
 * Genera `marketcentral-<fecha>.dump` (formato custom de pg_dump, ya comprimido)
 * y su `.sha256`. No sube nada a la nube: el archivo se deja listo para copiarlo
 * a S3/R2 con cualquier cliente. Las credenciales se leen del entorno o del
 * `.env` de la raíz y nunca se imprimen.
 */

const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const { buildDumpFileName, parseKeepDays, readDatabaseUrl, redactUrl, selectExpiredFiles } = require('./lib/backup-utils');

const ROOT = resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    outDir: resolve(ROOT, process.env.BACKUP_DIR ?? '.var/backups'),
    keepDays: parseKeepDays(process.env.BACKUP_KEEP_DAYS, 14),
    dryRun: false,
    url: null,
  };
  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--out=')) options.outDir = resolve(arg.slice(6));
    else if (arg.startsWith('--keep=')) options.keepDays = parseKeepDays(arg.slice(7), 14);
    else if (arg.startsWith('--url=')) options.url = arg.slice(6);
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(
        'Uso: node scripts/backup.js [--out=DIR] [--keep=DIAS] [--dry-run] [--url=postgres://...]\n',
      );
      process.exit(0);
    } else {
      fail(`Argumento no reconocido: ${arg}`);
    }
  }
  return options;
}

function fail(message) {
  process.stderr.write(`${JSON.stringify({ event: 'backup_error', message })}\n`);
  process.exitCode = 2;
  throw new Error(message);
}

function log(payload) {
  process.stdout.write(`${JSON.stringify({ event: 'backup', ...payload })}\n`);
}

function resolveDatabaseUrl(explicit) {
  if (explicit) return explicit;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(ROOT, '.env');
  if (existsSync(envPath)) return readDatabaseUrl(readFileSync(envPath, 'utf8'));
  return null;
}

function hasPgDump() {
  const probe = spawnSync('pg_dump', ['--version'], { encoding: 'utf8', shell: false });
  return probe.status === 0;
}

function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', rejectHash);
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

function prune(outDir, keepDays) {
  const entries = readdirSync(outDir, { withFileTypes: true }).map((entry) => {
    const full = join(outDir, entry.name);
    return { name: entry.name, isFile: entry.isFile(), mtimeMs: entry.isFile() ? statSync(full).mtimeMs : 0 };
  });
  const expired = selectExpiredFiles(entries, keepDays);
  for (const name of expired) {
    const full = join(outDir, name);
    if (existsSync(full)) unlinkSync(full);
  }
  return expired;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const databaseUrl = resolveDatabaseUrl(options.url);

  if (!databaseUrl) {
    fail('Falta DATABASE_URL (entorno, .env de la raíz o --url=...).');
  }

  const safeUrl = redactUrl(databaseUrl);
  if (options.dryRun) {
    log({
      mode: 'dry-run',
      database: safeUrl,
      outDir: options.outDir,
      keepDays: options.keepDays,
      pgDump: hasPgDump() ? 'disponible' : 'no encontrado en PATH',
      command: `pg_dump --format=custom --no-owner --no-privileges --file=<archivo> ${safeUrl}`,
    });
    return;
  }

  if (!hasPgDump()) {
    fail(
      'No se encontró pg_dump en PATH. Instala el cliente de PostgreSQL (Windows: "PostgreSQL Client Tools") o usa pg_dump desde un contenedor: ' +
        'docker run --rm postgres:18 pg_dump ...',
    );
  }

  mkdirSync(options.outDir, { recursive: true });
  const finalName = buildDumpFileName(new Date());
  const finalPath = join(options.outDir, finalName);
  const tempPath = `${finalPath}.partial`;

  const dump = spawnSync(
    'pg_dump',
    [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      // Restaurar sin bloquear escrituras y verificar al copiar.
      '--compress=6',
      `--file=${tempPath}`,
      databaseUrl,
    ],
    { encoding: 'utf8', shell: false },
  );

  if (dump.status !== 0) {
    fail(`pg_dump falló (código ${dump.status}): ${(dump.stderr ?? '').trim().slice(0, 400)}`);
  }

  renameSync(tempPath, finalPath);
  const digest = await sha256(finalPath);
  writeFileSync(`${finalPath}.sha256`, `${digest}  ${finalName}\n`, 'utf8');

  const sizeBytes = statSync(finalPath).size;
  const removed = prune(options.outDir, options.keepDays);

  log({
    mode: 'done',
    database: safeUrl,
    file: finalPath,
    sizeBytes,
    sha256: digest,
    keepDays: options.keepDays,
    removed,
    uploadHint: 'Sube el .dump y su .sha256 a S3/R2 con el cliente que ya uses (aws s3 cp, rclone o la consola).',
  });
}

main().catch((error) => {
  // `fail` ya escribió el JSON y fijó el código; el resto son fallos inesperados.
  if (process.exitCode !== 2) {
    process.stderr.write(
      `${JSON.stringify({ event: 'backup_error', message: String(error && error.message ? error.message : error) })}\n`,
    );
    process.exitCode = 1;
  }
});
