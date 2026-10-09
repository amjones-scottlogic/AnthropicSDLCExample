// Loads one snapshot of where every intent, spec and plan sits in the SDLC into a local Loki.
// Reads origin/main only (never the working tree). Nothing is sent anywhere except the local Loki; the one network call
// is the `git fetch` of the repo's own origin.
import { DEFAULT_LOKI, push } from './collect-metrics.mjs'

export const STAGES_JOB = 'ai-sdlc-stages'
const DIRS = ['intent', 'spec', 'plan']
const NAME = /^(\d{3})-(.+)\.md$/

const BUILD_FORMS = [
  /^Build (\d{3})\b/,
  /^Build\b.*\(spec (\d{3})\)\s*$/, // before the `Build NNN` convention (items 001 and 003)
  /^Merge pull request #\d+ from \S+\/build\/(\d{3})-/, // merged build branches (items 004 and 007)
]

/** Item number -> date of the first commit that is its build. Takes commits as `{ date, subject }`. */
export function builtItems(commits) {
  const built = new Map()
  for (const { date, subject } of commits) {
    const number = BUILD_FORMS.map((re) => re.exec(subject)?.[1]).find(Boolean)
    if (!number) continue
    if (!built.has(number) || Date.parse(date) < Date.parse(built.get(number))) built.set(number, date)
  }
  return built
}

/**
 * One row per item number. `files` lists names per directory, `statuses` and `added` are keyed by `dir/name`
 * (the file's first Status word, and the date it first landed on main), `built` is `builtItems`' result.
 * Files that do not look like `NNN-slug.md` are returned in `unplaced`.
 */
export function classify({ files, statuses, added, built }) {
  const items = new Map()
  const unplaced = []
  for (const dir of DIRS) {
    for (const name of files[dir]) {
      const m = NAME.exec(name)
      if (!m) {
        unplaced.push(`${dir}/${name}`)
        continue
      }
      const item = items.get(m[1]) ?? { number: m[1], slugs: {} }
      item[dir] = `${dir}/${name}`
      item.slugs[dir] = m[2]
      items.set(m[1], item)
    }
  }
  const rows = [...items.values()]
    .sort((a, b) => a.number.localeCompare(b.number))
    .map((item) => {
      let stage
      let since
      if (built.has(item.number)) [stage, since] = ['built', built.get(item.number)]
      else if (item.plan) [stage, since] = ['in-build', added[item.plan]]
      else if (item.spec) [stage, since] = ['awaiting-plan', added[item.spec]]
      else [stage, since] = ['awaiting-spec', added[item.intent]]
      const status = (dir) => (item[dir] ? (statuses[item[dir]] ?? '') : '')
      return {
        number: item.number,
        slug: item.slugs.intent ?? item.slugs.spec ?? item.slugs.plan,
        stage,
        stage_since: since ?? '',
        intent_status: status('intent'),
        spec_status: status('spec'),
        plan_status: status('plan'),
      }
    })
  return { rows, unplaced }
}

const lines = (text) => text.split('\n').filter(Boolean)

/** Runs one stages collection. `git` takes an argument array and returns stdout. Returns the exit code (0 ok, 1 failure). */
export async function collectStages({ git, fetch: fetchFn = fetch, lokiUrl = DEFAULT_LOKI, now = new Date(), log = console.log, err = console.error }) {
  try {
    try {
      git(['fetch', 'origin', 'main'])
    } catch (e) {
      throw new Error(`git fetch failed: ${e.message}`)
    }
    const mainCommit = git(['rev-parse', '--short', 'origin/main']).trim()

    const files = { intent: [], spec: [], plan: [] }
    for (const path of lines(git(['ls-tree', '--name-only', 'origin/main', 'intent/', 'spec/', 'plan/']))) {
      const [dir, ...rest] = path.split('/')
      if (files[dir] && rest.length === 1) files[dir].push(rest[0])
    }

    const statuses = {}
    const added = {}
    for (const dir of DIRS) {
      for (const name of files[dir]) {
        const path = `${dir}/${name}`
        statuses[path] = /Status:\s*([A-Za-z-]+)/.exec(git(['show', `origin/main:${path}`]))?.[1] ?? ''
        added[path] = lines(git(['log', 'origin/main', '--first-parent', '--diff-filter=A', '--format=%aI', '--', path])).at(-1) ?? ''
      }
    }

    const commits = lines(git(['log', 'origin/main', '--first-parent', '--format=%H%x09%aI%x09%s'])).map((l) => {
      const [hash, date, ...subject] = l.split('\t')
      return { hash, date, subject: subject.join('\t') }
    })

    const { rows, unplaced } = classify({ files, statuses, added, built: builtItems(commits) })

    const runId = now.toISOString()
    const base = BigInt(now.getTime()) * 1000000n
    const streams = new Map()
    rows.forEach((row, i) => {
      const labels = { job: STAGES_JOB, stage: row.stage }
      const id = JSON.stringify(labels)
      if (!streams.has(id)) streams.set(id, { stream: labels, values: [] })
      streams.get(id).values.push([(base + BigInt(i)).toString(), JSON.stringify({ ...row, run_id: runId, main_commit: mainCommit })])
    })
    await push(fetchFn, lokiUrl, [...streams.values()])

    const open = rows.filter((r) => r.stage !== 'built').length
    log(`Collected SDLC stages from origin/main (${mainCommit}): ${rows.length} items, ${open} not yet built.`)
    for (const path of unplaced) log(`Skipped: ${path} (name does not start NNN-)`)
    return 0
  } catch (e) {
    err(`collect-sdlc-stages failed: ${e.message}`)
    return 1
  }
}
