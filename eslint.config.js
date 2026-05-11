import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

// 사이즈/복잡도 한계 — ADR 0005 (docs/adr/0005-component-size-limits.md)
// 기존 위반 파일은 inline `/* eslint-disable max-lines */` 등으로 일시 억제 후 Phase 4에서 분해.
const SIZE_RULES = {
  'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
  complexity: ['error', { max: 15 }],
  'max-params': ['error', 5],
  'max-depth': ['error', 4],
}

// 신규 코드 금지 패턴 (RULES.md §34)
const FORBIDDEN_PATTERNS = {
  'no-alert': 'error',
  'no-console': ['warn', { allow: ['warn', 'error'] }],
}

const LANG = {
  ecmaVersion: 2020,
  globals: globals.browser,
  parserOptions: {
    ecmaVersion: 'latest',
    ecmaFeatures: { jsx: true },
    sourceType: 'module',
  },
}

const EXTENDS = [
  js.configs.recommended,
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
]

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),

  // 1) 신규 아키텍처 코드 — 엄격 (사이즈 + 금지 패턴)
  // NOTE: src/stores/* 는 Phase 5에서 재설계 대상 → 그때 strict block으로 이전
  {
    files: [
      'src/app/**/*.{js,jsx}',
      'src/features/**/*.{js,jsx}',
      'src/entities/**/*.{js,jsx}',
      'src/shared/**/*.{js,jsx}',
    ],
    extends: EXTENDS,
    languageOptions: LANG,
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      ...SIZE_RULES,
      ...FORBIDDEN_PATTERNS,
    },
  },

  // 2) 신규 페이지(index.jsx) — 더 엄격 (≤ 200줄)
  {
    files: ['src/pages/**/index.jsx'],
    extends: EXTENDS,
    languageOptions: LANG,
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 100 }],
      complexity: ['error', { max: 10 }],
      ...FORBIDDEN_PATTERNS,
    },
  },

  // 3) Legacy 코드 — 마이그레이션 동안 사이즈 규칙 미적용
  {
    files: [
      'src/components/**/*.{js,jsx}',
      'src/pages/*.jsx',
      'src/hooks/**/*.{js,jsx}',
      'src/api/**/*.{js,jsx}',
      'src/utils/**/*.{js,jsx}',
      'src/layouts/**/*.{js,jsx}',
      'src/constants/**/*.{js,jsx}',
      'src/stores/**/*.{js,jsx}',
    ],
    extends: EXTENDS,
    languageOptions: LANG,
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // 사이즈 규칙은 Phase 4 종료 시 활성화
    },
  },
])
