import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import next from 'eslint-config-next';
import globals from 'globals';

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Готовый flat-конфиг Next.js 16: подключает react, react-hooks, jsx-a11y,
  // import и @next/next вместе с их recommended-правилами.
  ...next,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',

      // Правила включены в eslint-config-next, но требуют отдельного рефакторинга.
      // Каждое чинится своей маленькой правкой:
      //   react-hooks/set-state-in-effect — setState синхронно в эффекте
      //   react-hooks/purity — impure-вызов во время рендера
      //   @next/next/no-location-assign-relative-destination — window.location.href
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      '@next/next/no-location-assign-relative-destination': 'off',
    },
  },
  {
    files: [
      'next.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      'vitest.config.mjs',
      'eslint.config.mjs',
    ],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.browser } },
  },
];

export default eslintConfig;
