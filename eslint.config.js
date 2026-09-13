// ESLint flat config.
//
// Tuned for correctness, not style. This codebase has never been linted, so a
// kitchen-sink preset would bury the handful of real findings under thousands
// of formatting opinions nobody asked for. Formatting is left alone; what is
// switched on are the rules that catch bugs a reviewer would also flag:
//
//   • rules-of-hooks       — a conditional hook call breaks React at runtime
//   • no-undef             — a typo'd global is a crash waiting for a code path
//   • no-unused-vars       — usually a leftover import or a dropped refactor
//   • no-dupe-keys / -case — silently dead code (we shipped one of each)
//   • no-constant-condition, no-self-assign, no-unsafe-negation, ...
//
// `exhaustive-deps` is a warning rather than an error: this app deliberately
// omits deps in a few `useMemo`/`useFrame` hooks where the dependency is a
// three.js object mutated in place, and those sites carry an eslint-disable
// comment explaining why.

import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default [
  {
    // Build output, dependencies, static assets, and any dot-directory of
    // local editor or tooling state.
    ignores: ['dist/**', 'node_modules/**', 'public/**', '**/.*/**']
  },

  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021
      },
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    settings: {
      react: { version: 'detect' }
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    rules: {
      // ---- the rules that find bugs ----
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // JSX uses the automatic runtime, so React need not be in scope and
      // components are not "unused" just because they only appear in JSX.
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-vars': 'error',
      // A raw `>` or `}` in JSX text is usually a typo rather than intent.
      'react/jsx-no-undef': 'error',
      'react/no-children-prop': 'warn',

      // Unused code: an underscore prefix is the opt-out for a deliberately
      // ignored binding (catch params, destructured rest, placeholder args).
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true
      }],

      // Left as errors: each one is dead or wrong code, never a style call.
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-self-assign': 'error',
      'no-unsafe-negation': 'error',
      'no-constant-binary-expression': 'error',

      // Deliberate in a few places (empty catch blocks around storage access
      // that is allowed to fail), so allow the empty-catch form specifically.
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  {
    // Config files and the export probes run in Node.
    files: ['*.config.js', 'vite.config.js', 'postcss.config.js', 'tailwind.config.js'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  {
    files: ['**/*.test.js', '**/*.test.jsx'],
    languageOptions: {
      globals: { ...globals.node }
    }
  }
]
