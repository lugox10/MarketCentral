'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDumpFileName,
  isBackupFile,
  parseKeepDays,
  readDatabaseUrl,
  redactUrl,
  selectExpiredFiles,
} = require('./lib/backup-utils');

test('el nombre del respaldo es ordenable y estable', () => {
  const name = buildDumpFileName(new Date(2026, 10, 24, 3, 15, 0));
  assert.equal(name, 'marketcentral-20261124-031500.dump');
  assert.ok(isBackupFile(name));
  assert.ok(!isBackupFile('marketcentral-20261124-031500.dump.sha256'));
});

test('la URL se registra sin contraseña', () => {
  const safe = redactUrl('postgresql://marketcentral:s3cr3t@db.example.com:5432/marketcentral');
  assert.ok(!safe.includes('s3cr3t'));
  assert.ok(safe.includes('marketcentral:***@db.example.com'));
  assert.equal(redactUrl(null), '(sin URL)');
  assert.equal(redactUrl('no-es-una-url'), '(URL inválida)');
});

test('la retención cae al valor por defecto ante entradas inválidas', () => {
  assert.equal(parseKeepDays('30'), 30);
  assert.equal(parseKeepDays('0'), 14);
  assert.equal(parseKeepDays('-5'), 14);
  assert.equal(parseKeepDays('abc'), 14);
  assert.equal(parseKeepDays(undefined), 14);
});

test('solo se borran respaldos vencidos y su sha256', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date(2026, 10, 24).getTime();
  const entries = [
    { name: 'marketcentral-20261101-000000.dump', mtimeMs: now - 30 * day, isFile: true },
    { name: 'marketcentral-20261101-000000.dump.sha256', mtimeMs: now - 30 * day, isFile: true },
    { name: 'marketcentral-20261120-000000.dump', mtimeMs: now - 4 * day, isFile: true },
    { name: 'notas.txt', mtimeMs: now - 90 * day, isFile: true },
  ];

  const expired = selectExpiredFiles(entries, 14, now);
  assert.deepEqual(expired.sort(), [
    'marketcentral-20261101-000000.dump',
    'marketcentral-20261101-000000.dump.sha256',
  ]);
});

test('lee DATABASE_URL del .env sin ejecutar el archivo', () => {
  const text = 'API_PORT=3001\nDATABASE_URL="postgresql://u:p@localhost:5432/db"\n# otro\n';
  assert.equal(readDatabaseUrl(text), 'postgresql://u:p@localhost:5432/db');
  assert.equal(readDatabaseUrl('API_PORT=3001'), null);
});
