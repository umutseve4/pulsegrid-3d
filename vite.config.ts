import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/pulsegrid-3d/',
  test: {
    environment: 'node',
    coverage: { reporter: ['text', 'json-summary'] }
  }
});
