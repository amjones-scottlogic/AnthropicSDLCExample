#!/bin/bash
# Metrics hook: after `gh pr create`, and after any `git push` on a branch that has an open PR,
# post (or update) the AI-SDLC metrics comment on that PR.
# Never blocks and never fails the command: any problem is reported and ignored.
# Reads hook JSON from stdin; matches the command field directly (no jq dependency).
input=$(cat)

if [[ "$input" =~ \"command\"[[:space:]]*:[[:space:]]*\"[^\"]*gh[[:space:]]+pr[[:space:]]+create ]]; then
  trigger=create
elif [[ "$input" =~ \"command\"[[:space:]]*:[[:space:]]*\"[^\"]*git[[:space:]]+push ]]; then
  trigger=push
else
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

number=$(gh pr view --json number -q .number 2>/dev/null)
if [ -z "$number" ]; then
  # A push with no PR yet is normal. After `gh pr create` it is worth saying.
  [ "$trigger" = create ] && echo "capture-metrics: could not find the PR for this branch; no metrics comment posted" >&2
  exit 0
fi

node .claude/skills/capture-metrics/capture.mjs --pr "$number" \
  || echo "capture-metrics: failed; the PR is unaffected" >&2
exit 0
