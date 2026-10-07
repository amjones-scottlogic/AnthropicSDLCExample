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

describe('capture-metrics hook (Req 5)', () => {
  it('runs the script for the new PR after gh pr create', () => {
    const r = runHook('gh pr create --base main --title "x"')
    expect(r.status).toBe(0)
    expect(r.calls).toContain('capture.mjs --pr 7 --catch-up')
  })

  it('updates the metrics when commits are pushed to a branch with an open PR', () => {
    for (const c of ['git push', 'git push -u origin build/002-x', 'git push origin HEAD:refs/heads/x']) {
      const r = runHook(c)
      expect(r.status).toBe(0)
      expect(r.calls).toContain('capture.mjs --pr 7 --catch-up')
    }
  })

  it('stays silent on a push when the branch has no open PR', () => {
    const r = runHook('git push -u origin x', { ghNumber: null })
    expect(r.status).toBe(0)
    expect(r.stderr).toBe('')
    expect(r.calls).toBe('')
  })

  it('does nothing for other commands', () => {
    for (const c of ['gh pr view 7', 'git commit -m x', 'git pull', 'npm test']) {
      const r = runHook(c)
      expect(r.status).toBe(0)
      expect(r.calls).toBe('')
    }
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
