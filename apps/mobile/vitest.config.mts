import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['lib/**/*.spec.ts', 'app/**/*.spec.ts', 'components/**/*.spec.ts'],
  },
});
