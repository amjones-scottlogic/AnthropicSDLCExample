// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const hook = path.resolve(here, '..', '..', 'hooks', 'capture-metrics.sh')
const tmp = mkdtempSync(path.join(tmpdir(), 'hook-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const toBash = (p) => p.split('\\').join('/')

/** Runs the hook with stub `gh` and `node` first on PATH. The stub node records its arguments. */
function runHook(command, { ghNumber = '7', nodeExit = 0 } = {}) {
  const dir = mkdtempSync(path.join(tmp, 'run-'))
  const log = path.join(dir, 'node-args.txt')
  const stub = (name, body) => {
    const f = path.join(dir, name)
    writeFileSync(f, `#!/bin/bash\n${body}\n`)
    chmodSync(f, 0o755)
  }
  stub('gh', ghNumber === null ? 'exit 1' : `echo ${ghNumber}`)
  stub('node', `echo "$@" >> "${toBash(log)}"\nexit ${nodeExit}`)
  const r = spawnSync('bash', [toBash(hook)], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }),
    env: { ...process.env, PATH: `${toBash(dir)}:${process.env.PATH}`, CLAUDE_PROJECT_DIR: toBash(dir) },
    encoding: 'utf8',
  })
  return { status: r.status, stderr: r.stderr, calls: existsSync(log) ? readFileSync(log, 'utf8').trim() : '' }
}

// Each command the hook can see, whether the PR for the branch exists, and whether the script should run.
const cases = [
  { name: 'gh pr create', command: 'gh pr create --base main --title "x"', pr: '7', runs: true },
  { name: 'push, PR open', command: 'git push -u origin build/002-x', pr: '7', runs: true },
  { name: 'push to a ref, PR open', command: 'git push origin HEAD:refs/heads/x', pr: '7', runs: true },
  { name: 'push, no PR yet (silent)', command: 'git push -u origin x', pr: null, runs: false, silent: true },
  { name: 'gh pr view', command: 'gh pr view 7', pr: '7', runs: false },
  { name: 'git commit', command: 'git commit -m x', pr: '7', runs: false },
  { name: 'git pull', command: 'git pull', pr: '7', runs: false },
  { name: 'npm test', command: 'npm test', pr: '7', runs: false },
]

describe('capture-metrics hook (Req 5)', () => {
  it.each(cases)('$name', ({ command, pr, runs, silent }) => {
    const r = runHook(command, { ghNumber: pr })
    expect(r.status).toBe(0)
    if (runs) expect(r.calls).toContain('capture.mjs --pr 7 --catch-up')
    else expect(r.calls).toBe('')
    if (silent) expect(r.stderr).toBe('')
  })

  it('still exits 0 when the script fails, and says so on stderr', () => {
    const r = runHook('gh pr create', { nodeExit: 1 })
    expect(r.status).toBe(0)
    expect(r.stderr).toMatch(/failed/)
  })

  it('still exits 0 when the PR cannot be found', () => {
    const r = runHook('gh pr create', { ghNumber: null })
    expect(r.status).toBe(0)
    expect(r.stderr).toMatch(/could not find the PR/)
    expect(r.calls).toBe('')
  })
})
