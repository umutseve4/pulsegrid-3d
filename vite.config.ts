import { defineConfig } from 'vitest/config';

const base = '/pulsegrid-3d/';

export default defineConfig({
  base,
  plugins: [{
    name: 'pulsegrid-favicon',
    transformIndexHtml: {
      order: 'pre',
      handler: () => [{
        tag: 'link',
        attrs: { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` },
        injectTo: 'head'
      }]
    }
  }],
  test: {
    environment: 'node',
    coverage: { reporter: ['text', 'json-summary'] }
  }
});
