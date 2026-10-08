import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import nx from '@nx/eslint-plugin';
import boundaries, { readBaseline } from './tools/lint/boundaries.js';

/**
 * Which projects may depend on which, by Nx tag (each project has one scope: and
 * one platform: tag; `mise run check:targets` checks that). Only core and ui are
 * importable today (both platform:none); app projects cannot be imported by name
 * and Nx rejects paths into another project, so platform isolation inside core
 * and ui is `cept/restricted-imports`' job. Add platform:* rows when a
 * platform-specific library appears.
 */
const depConstraints = [
  { sourceTag: 'scope:shared', onlyDependOnLibsWithTags: ['scope:shared'] },
  { sourceTag: 'scope:client', onlyDependOnLibsWithTags: ['scope:shared', 'scope:client'] },
  { sourceTag: 'scope:app', onlyDependOnLibsWithTags: ['scope:shared', 'scope:client'] },
  { sourceTag: 'scope:server', onlyDependOnLibsWithTags: ['scope:shared', 'scope:server'] },
  { sourceTag: 'scope:docs', onlyDependOnLibsWithTags: ['scope:shared'] },
  { sourceTag: 'scope:test', onlyDependOnLibsWithTags: ['*'] },
  { sourceTag: 'scope:tooling', onlyDependOnLibsWithTags: ['*'] },
  { sourceTag: 'platform:none', onlyDependOnLibsWithTags: ['platform:none'] },
];

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/build/**',
      '**/.nx/**',
      'tools/boundary-fixtures/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@nx': nx,
      cept: boundaries,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@nx/enforce-module-boundaries': ['error', { allow: [], depConstraints }],
      'cept/restricted-imports': ['error', { baseline: readBaseline() }],
    },
  },
  prettier,
];
