// The one collection command (`npm run metrics:collect`): PR metrics from GitHub, then SDLC stages from origin/main.
// Each half runs on its own, so a failure in one does not stop the other; the exit code is non-zero if either failed.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LOKI, collect } from './collect-metrics.mjs'
import { collectStages } from './collect-sdlc-stages.mjs'

/** Runs both collectors and returns the exit code (0 only if both succeeded). */
export async function collectAll({ collect: runMetrics, collectStages: runStages, err = console.error }) {
  let code = 0
  for (const run of [runMetrics, runStages]) {
    try {
      if ((await run()) !== 0) code = 1
    } catch (e) {
      err(`collection failed: ${e.message}`)
      code = 1
    }
  }
  return code
}

function main(argv) {
  const i = argv.indexOf('--loki')
  const lokiUrl = i >= 0 ? argv[i + 1] : DEFAULT_LOKI
  const gh = (a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const git = (a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  collectAll({ collect: () => collect({ gh, lokiUrl }), collectStages: () => collectStages({ git, lokiUrl }) }).then((code) => {
    process.exitCode = code
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
