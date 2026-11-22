import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

const config = [
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...nextVitals,
  ...nextTypescript,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'error',
    },
  },
]

export default config
