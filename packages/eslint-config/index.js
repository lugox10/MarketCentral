import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Reglas comunes a todo el monorepo. No incluye reglas de React: las apps web
 * las añaden con `reactConfig`.
 */
const shared = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/.tools/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2023 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  // Debe ir al final: desactiva las reglas de formato que gestiona Prettier.
  prettierConfig,
);

/** Config para paquetes Node/TypeScript (API, packages). */
export const baseConfig = shared;

/** Config para apps React/Next (añade hooks y globals de navegador). */
export const reactConfig = tseslint.config(...shared, {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    globals: { ...globals.browser },
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { 'react-hooks': reactHooks },
  rules: { ...reactHooks.configs.recommended.rules },
});

export default shared;
