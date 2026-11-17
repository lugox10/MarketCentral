/**
 * Jest para el frontend en CJS (el paquete no es ESM): evita la fricción de
 * `--experimental-vm-modules` con jsdom y React Testing Library.
 *
 * Transformador: ts-jest con un tsconfig inline para tests (JSX automático y
 * módulo CommonJS). No se usa @swc/jest: su binding nativo exige una caché con
 * una DACL concreta y falla cuando el usuario no puede crearla.
 */
export default {
  rootDir: '.',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/test/**/*.spec.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'ES2022',
          lib: ['DOM', 'DOM.Iterable', 'ES2023'],
          module: 'commonjs',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          esModuleInterop: true,
          allowJs: false,
          strict: true,
          skipLibCheck: true,
          verbatimModuleSyntax: false,
          isolatedModules: true,
        },
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@marketcentral/ui$': '<rootDir>/../../packages/ui/src/index.ts',
    '^@marketcentral/api-client$': '<rootDir>/../../packages/api-client/src/index.ts',
    '\\.(css|scss|sass)$': '<rootDir>/test/style-mock.ts',
  },
  clearMocks: true,
};
