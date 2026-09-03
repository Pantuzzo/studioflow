import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'node:path'

/**
 * `ANALYZE=1 pnpm build` writes a treemap and the raw module sizes next to the
 * bundle. Off by default: a normal build should not pay for instrumentation,
 * and CI should not produce an artefact nobody reads.
 */
const analyze = process.env['ANALYZE'] === '1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(analyze
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            gzipSize: true,
            brotliSize: true,
          }),
          visualizer({
            filename: 'dist/bundle-stats.json',
            template: 'raw-data',
            gzipSize: true,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Same-origin in development, matching production. This is what makes the
    // SameSite session cookie behave identically in both, and removes CORS from
    // the picture entirely. It is a correctness measure, not a security one —
    // the security is that no token ever reaches the browser (docs/adr/0006).
    proxy: {
      '/api': {
        target: process.env['VITE_API_PROXY_TARGET'] ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Only measure our own source; keeps dist/, public/ and config out.
      include: ['src/**'],
      exclude: ['src/mocks/**', 'src/test/**', 'src/main.tsx', '**/*.d.ts'],
    },
  },
})
