#!/usr/bin/env node
/**
 * A budget for what the first paint costs.
 *
 * Route splitting cut the JavaScript a signed-out visitor downloads by a third.
 * Nothing stops the next feature from putting it back: one eager import in the
 * route tree pulls a whole feature into the entry chunk, and nobody notices,
 * because the app still works. This fails the build instead.
 *
 * The budget is on the gzipped entry chunk, because that is what crosses the
 * network. It sits a little above the current size, so it catches a regression
 * rather than ordinary drift.
 */
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const ASSETS = join(here, '..', 'dist', 'assets')
const ENTRY_BUDGET_KB = 185

const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
if (files.length === 0) {
  console.error('No JavaScript in dist/assets. Run the build first.')
  process.exit(1)
}

const sized = files
  .map((name) => ({
    name,
    kb: gzipSync(readFileSync(join(ASSETS, name))).length / 1024,
  }))
  .sort((a, b) => b.kb - a.kb)

// The entry chunk is the largest: everything else is a route or a shared
// fragment pulled in on demand.
const [entry, ...rest] = sized
const total = sized.reduce((sum, f) => sum + f.kb, 0)

console.log(`entry chunk   ${entry.name}  ${entry.kb.toFixed(1)} kB gz`)
console.log(
  `lazy chunks   ${rest.length}, ${(total - entry.kb).toFixed(1)} kB gz total`,
)
console.log(`budget        ${ENTRY_BUDGET_KB} kB gz`)

if (entry.kb > ENTRY_BUDGET_KB) {
  console.error(
    `\nThe entry chunk is ${entry.kb.toFixed(1)} kB gz, over the ${ENTRY_BUDGET_KB} kB budget.\n` +
      'Something that should load on demand is probably imported eagerly in\n' +
      'src/routes.tsx. Run `ANALYZE=1 pnpm build` and open dist/bundle-stats.html.',
  )
  process.exit(1)
}

console.log('\nWithin budget.')
