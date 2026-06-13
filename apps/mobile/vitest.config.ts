import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Vitest runs the PURE-logic tests (conflict engine, scheduler) in Node — no RN
// runtime needed. Component/E2E tests (jest-expo / Maestro) come later (docs/02 §10).
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
