import { defineConfig } from 'tsup'

// Dual output on purpose: the Vite web app consumes ESM, NestJS compiles to CJS.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
})
