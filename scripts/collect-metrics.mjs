// Collects the AI-SDLC metrics comment from every PR and loads the rows into a local Loki.
// Reads data only: nothing is written to GitHub, and nothing is sent anywhere except the local Loki.
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { findMetricsComment, listComments, parseComment } from '../.claude/skills/capture-metrics/capture.mjs'

export const DEFAULT_LOKI = 'http://127.0.0.1:3100'
export const ROW_JOB = 'ai-sdlc-metrics'
export const RUN_JOB = 'ai-sdlc-metrics-runs'
const QUERY_LIMIT = 5000
const EPOCH_START_NS = '1577836800000000000' // 2020-01-01
const MAX_PR_LIMIT = '1000'

/** Identity of a row: PR number, metric, change, notes and captured_at (spec requirement 4). */
export const rowKey = (r) => JSON.stringify([Number(r.pr_number), r.metric, r.change, r.notes, r.captured_at])

const toNs = (iso) => {
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : (BigInt(ms) * 1000000n).toString()
}

/**
 * The rows a PR contributes. `status` is 'none' (no metrics comment), 'unparsable' (a comment with the marker but no
 * readable rows) or 'ok'. Rows with an unreadable `captured_at` are returned in `skipped`, not sent.
 * An empty `value` stays empty: it is never turned into 0.
 */
export function rowsFromPr(pr, comments) {
  const comment = findMetricsComment(comments)
  if (!comment) return { status: 'none', rows: [], skipped: [] }
  const parsed = parseComment(comment.body)
  if (parsed.length === 0) return { status: 'unparsable', rows: [], skipped: [] }
  const rows = []
  const skipped = []
  for (const r of parsed) {
    const row = { ...r, pr_number: pr.number, pr_state: String(pr.state ?? '').toLowerCase() }
    if (toNs(row.captured_at) === null) skipped.push(row)
    else rows.push(row)
  }
  return { status: 'ok', rows, skipped }
}

/**
 * One Loki stream per label set, each row one JSON line stamped with its `captured_at`. Labels are the low-cardinality
 * fields; `pr_state` stays in the body because it changes when a PR merges and would split a row's stream.
 */
export function toStreams(rows) {
  const streams = new Map()
  for (const row of rows) {
    const labels = { job: ROW_JOB, stage: row.stage, kind: row.kind, metric: row.metric }
    const id = JSON.stringify(labels)
    if (!streams.has(id)) streams.set(id, { stream: labels, values: [] })
    streams.get(id).values.push([toNs(row.captured_at), JSON.stringify(row)])
  }
  // Loki rejects an entry that is older than the newest one already in its stream by more than the out-of-order window,
  // so each stream goes out oldest first.
  for (const s of streams.values()) s.values.sort((a, b) => (BigInt(a[0]) < BigInt(b[0]) ? -1 : BigInt(a[0]) > BigInt(b[0]) ? 1 : 0))
  return [...streams.values()]
}

export async function lokiFetch(fetchFn, url, init) {
  let res
  try {
    res = await fetchFn(url, init)
  } catch (e) {
    throw new Error(`cannot reach Loki at ${url.split('/loki')[0]}: ${e.message}. Start it with: npm run metrics:up`)
  }
  if (!res.ok) throw new Error(`Loki answered ${res.status} for ${url.split('?')[0]}: ${await res.text()}`)
  return res
}

/** Keys of every row Loki already holds, read back from the stored JSON lines. */
export async function existingKeys(fetchFn, lokiUrl, nowNs) {
  const keys = new Set()
  let end = nowNs
  for (;;) {
    const q = new URLSearchParams({ query: `{job="${ROW_JOB}"}`, start: EPOCH_START_NS, end, limit: String(QUERY_LIMIT), direction: 'backward' })
    const body = await (await lokiFetch(fetchFn, `${lokiUrl}/loki/api/v1/query_range?${q}`)).json()
    let count = 0
    let oldest = null
    for (const s of body.data?.result ?? []) {
      for (const [ts, line] of s.values) {
        count++
        if (oldest === null || BigInt(ts) < BigInt(oldest)) oldest = ts
        try {
          keys.add(rowKey(JSON.parse(line)))
        } catch {
          // a line that is not one of ours cannot match a row
        }
      }
    }
    if (count < QUERY_LIMIT || oldest === null) return keys
    const next = (BigInt(oldest) + 1n).toString() // inclusive of the boundary, so equal timestamps are not missed
    if (BigInt(next) >= BigInt(end)) return keys
    end = next
  }
}

export async function push(fetchFn, lokiUrl, streams) {
  if (streams.length === 0) return
  await lokiFetch(fetchFn, `${lokiUrl}/loki/api/v1/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ streams }),
  })
}

/** Runs one collection. Returns the exit code (0 ok, 1 failure). */
export async function collect({ gh, fetch: fetchFn = fetch, lokiUrl = DEFAULT_LOKI, now = new Date(), log = console.log, err = console.error }) {
  try {
    const repo = gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim()
    const prs = JSON.parse(gh(['pr', 'list', '--state', 'all', '--limit', MAX_PR_LIMIT, '--json', 'number,state']) || '[]')
    const have = await existingKeys(fetchFn, lokiUrl, (BigInt(now.getTime()) * 1000000n + 1000000000n).toString())

    const fresh = []
    const withoutComment = []
    const skipped = []
    let already = 0
    for (const pr of prs) {
      const r = rowsFromPr(pr, listComments(gh, repo, pr.number))
      if (r.status === 'none') withoutComment.push(pr.number)
      if (r.status === 'unparsable') skipped.push(`PR ${pr.number}: metrics comment could not be parsed`)
      for (const row of r.skipped) skipped.push(`PR ${pr.number}: row "${row.metric}" has an unreadable captured_at`)
      for (const row of r.rows) {
        if (have.has(rowKey(row))) already++
        else fresh.push(row)
      }
    }

    await push(fetchFn, lokiUrl, toStreams(fresh))
    // The heartbeat is what the dashboard's "last loaded" reads, so a run that adds nothing still shows as a run.
    await push(fetchFn, lokiUrl, [{ stream: { job: RUN_JOB }, values: [[(BigInt(now.getTime()) * 1000000n).toString(), JSON.stringify({ prs: prs.length, sent: fresh.length })]] }])

    log(`Collected ${prs.length} PRs: ${fresh.length} rows sent, ${already} already in Loki.`)
    log(`${withoutComment.length} PRs had no metrics comment${withoutComment.length ? ` (${withoutComment.map((n) => `#${n}`).join(', ')})` : ''}.`)
    for (const s of skipped) log(`Skipped: ${s}`)
    return 0
  } catch (e) {
    err(`collect-metrics failed: ${e.message}`)
    return 1
  }
}

function main(argv) {
  const i = argv.indexOf('--loki')
  const run = (a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  collect({ gh: run, lokiUrl: i >= 0 ? argv[i + 1] : DEFAULT_LOKI }).then((code) => {
    process.exitCode = code
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
