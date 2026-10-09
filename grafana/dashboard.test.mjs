// @vitest-environment node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { FIELDS } from '../.claude/skills/capture-metrics/capture.mjs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dashboard = JSON.parse(readFileSync(path.join(dir, 'dashboards', 'ai-sdlc-metrics.json'), 'utf8'))

// What the collector sends: stream labels, plus the JSON body (every comment field, the PR number and its state).
const STREAM_LABELS = ['job', 'stage', 'kind', 'metric']
const BODY_FIELDS = [...FIELDS, 'pr_number', 'pr_state']
// Names a query creates itself with `| regexp` from `notes`.
const DERIVED = ['skill', 'model', 'type', 'series']
const KNOWN = new Set([...STREAM_LABELS, ...BODY_FIELDS, ...DERIVED])

// What the SDLC stages collector sends (job ai-sdlc-stages): the `stage` label, plus the JSON body of each item.
const STAGE_LABELS = ['job', 'stage']
const STAGE_FIELDS = ['number', 'slug', 'stage', 'stage_since', 'intent_status', 'spec_status', 'plan_status', 'run_id', 'main_commit']
const STAGE_KNOWN = new Set([...STAGE_LABELS, ...STAGE_FIELDS])
const STAGE_VALUES = ['awaiting-spec', 'awaiting-plan', 'in-build', 'built']

const allTargets = dashboard.panels.flatMap((p) => (p.targets ?? []).map((t) => ({ panel: p.title, expr: t.expr })))
const isStages = (t) => t.expr.includes('job="ai-sdlc-stages"')
const targets = allTargets.filter((t) => !isStages(t))
const stageTargets = allTargets.filter(isStages)

describe('dashboard definition', () => {
  it('is a provisionable dashboard with a stable uid', () => {
    expect(dashboard.uid).toBe('ai-sdlc-metrics')
    expect(dashboard.panels.length).toBeGreaterThan(0)
  })

  it('has the selectors the spec asks for', () => {
    const names = dashboard.templating.list.map((v) => v.name)
    expect(names).toEqual(expect.arrayContaining(['metric', 'stage', 'kind', 'pr', 'window']))
  })

  it('has a panel for each view: stages, drill-down, skills, tokens and data age', () => {
    const titles = dashboard.panels.map((p) => p.title).join('\n')
    for (const word of ['Plan: leading', 'Design: lagging', 'Build: leading', 'chosen PR', 'Skill invocations', 'Tokens', 'Last collector run']) {
      expect(titles).toContain(word)
    }
  })

  it('states that skill and token numbers are approximate', () => {
    const notes = dashboard.panels.filter((p) => p.type === 'text').map((p) => p.options.content).join('\n')
    expect(notes).toMatch(/repository skills/)
    expect(notes).toMatch(/by branch/)
    expect(notes).toMatch(/approximate/)
  })

  it('shows no cost', () => {
    const text = dashboard.panels.map((p) => p.title).join('\n')
    expect(text).not.toMatch(/\b(cost|price|usd|dollar)/i)
  })

  it('queries only fields the collector sends', () => {
    expect(targets.length).toBeGreaterThan(0)
    for (const { panel, expr } of targets) {
      const used = new Set()
      for (const m of expr.matchAll(/(\w+)\s*(?:=~|!=|!~|=)\s*"/g)) used.add(m[1]) // matchers and label filters
      for (const m of expr.matchAll(/\bby \(([^)]*)\)/g)) m[1].split(',').forEach((n) => used.add(n.trim()))
      if (/unwrap\s+(\w+)/.test(expr)) used.add(/unwrap\s+(\w+)/.exec(expr)[1])
      for (const name of used) expect(KNOWN.has(name), `${panel}: unknown field "${name}"`).toBe(true)
      expect(expr, panel).toMatch(/job="ai-sdlc-metrics(-runs)?"/)
    }
  })

  it('has the SDLC progress panels, queried only on fields the stages collector sends', () => {
    const titles = dashboard.panels.map((p) => p.title)
    for (const title of ['SDLC stages last loaded', 'SDLC items (latest snapshot)', 'SDLC items per stage (latest snapshot)']) {
      expect(titles).toContain(title)
    }
    expect(stageTargets.length).toBe(3)
    for (const { panel, expr } of stageTargets) {
      const used = new Set()
      for (const m of expr.matchAll(/(\w+)\s*(?:=~|!=|!~|=)\s*"/g)) used.add(m[1])
      for (const name of used) expect(STAGE_KNOWN.has(name), `${panel}: unknown field "${name}"`).toBe(true)
    }
  })

  it('offers every stage in the SDLC selector, with built hidden by default', () => {
    const v = dashboard.templating.list.find((x) => x.name === 'sdlc_stage')
    expect(v.multi).toBe(true)
    expect(v.query.split(',')).toEqual(STAGE_VALUES)
    expect(v.current.value).toEqual(STAGE_VALUES.filter((s) => s !== 'built'))
  })

  it('reads the newest snapshot of each item, not every snapshot', () => {
    const ops = (title) => dashboard.panels.find((p) => p.title === title).transformations.map((t) => t.id)
    for (const title of ['SDLC items (latest snapshot)', 'SDLC items per stage (latest snapshot)']) {
      expect(ops(title).slice(0, 3), title).toEqual(['extractFields', 'sortBy', 'groupBy'])
    }
  })

  it('drops empty values from every chart line and total', () => {
    for (const { panel, expr } of targets.filter((t) => t.expr.includes('unwrap'))) expect(expr, panel).toContain('value=~".+"')
  })

  it('adds contributors together per skill, and per model and token type', () => {
    const find = (title) => targets.find((t) => t.panel.startsWith(title)).expr
    expect(find('Skill invocations for')).toMatch(/^sum by \(skill\)/)
    expect(find('Tokens for')).toMatch(/^sum by \((series)\)/)
  })
})
