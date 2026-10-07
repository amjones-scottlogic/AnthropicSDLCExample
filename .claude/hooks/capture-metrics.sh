#!/bin/bash
# Metrics hook: after `gh pr create`, post the AI-SDLC metrics comment on the new PR
# (and refresh comments on merged PRs still awaiting their post-merge values).
# Never blocks and never fails the command: any problem is reported and ignored.
# Reads hook JSON from stdin; matches the command field directly (no jq dependency).
input=$(cat)
[[ "$input" =~ \"command\"[[:space:]]*:[[:space:]]*\"[^\"]*gh[[:space:]]+pr[[:space:]]+create ]] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

number=$(gh pr view --json number -q .number 2>/dev/null)
if [ -z "$number" ]; then
  echo "capture-metrics: could not find the PR for this branch; no metrics comment posted" >&2
  exit 0
fi

node .claude/skills/capture-metrics/capture.mjs --pr "$number" --catch-up \
  || echo "capture-metrics: failed; the PR is unaffected" >&2
exit 0
