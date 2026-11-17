/**
 * Jest en modo ESM nativo (NestJS 12 publica ESM). Se ejecuta con
 * `node --experimental-vm-modules` (ver script `test`).
 *
 * Transformador: ts-jest con el tsconfig del proyecto. Se evita @swc/jest a
 * propósito: su binding nativo exige un directorio de caché con una DACL
 * concreta y falla en entornos donde el usuario no puede crear esa caché
 * (`SWC native addon: ... Acceso denegado`). ts-jest usa el compilador de
 * TypeScript y emite los metadatos de decoradores que necesita Nest.
 */
export default {
  rootDir: '.',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // @nestjs/throttler 6.7.1 es CJS y rompe el grafo ESM de Jest (ver el mock).
    '^@nestjs/throttler$': '<rootDir>/test/mocks/nestjs-throttler.ts',
  },
  clearMocks: true,
};
