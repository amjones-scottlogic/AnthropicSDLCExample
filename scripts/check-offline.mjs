// Fails if built HTML or CSS refers to an external host (fonts, icons, scripts), so the app stays offline-capable.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const external = /(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\/|url\(\s*["']?\s*(?:https?:)?\/\//i

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

const offenders = files('dist')
  .filter((file) => /\.(html|css)$/.test(file))
  .filter((file) => external.test(readFileSync(file, 'utf8')))

if (offenders.length > 0) {
  console.error(`External URLs found in: ${offenders.join(', ')}`)
  process.exit(1)
}
console.log('No external URLs in built HTML or CSS.')
