#!/bin/bash
# Plan sync gate: a commit that changes implementation files must either include
# a change to plan/*.md (the plan was updated in the same commit) or carry a
# "Plan-Checked:" trailer saying the plan was reviewed and still matches.
# Only applies once the repo has a plan under plan/. Reads hook JSON from stdin
# (no jq dependency).
input=$(cat)

# Only act on `git commit`.
[[ "$input" =~ \"command\"[[:space:]]*:[[:space:]]*\"[^\"]*git[[:space:]]+commit ]] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# No plans yet: nothing to keep in sync.
ls plan/*.md >/dev/null 2>&1 || exit 0

# Acknowledged: the author reviewed the plan against the diff.
[[ "$input" =~ Plan-Checked: ]] && exit 0

# Files this commit will contain (-a / --all also takes unstaged tracked changes).
if [[ "$input" =~ git[[:space:]]+commit[^\"]*[[:space:]]-[a-zA-Z]*a || "$input" =~ --all ]]; then
  files=$(git diff --name-only HEAD 2>/dev/null)
else
  files=$(git diff --cached --name-only 2>/dev/null)
fi
[ -z "$files" ] && exit 0

# Plan updated in this commit: in sync.
grep -q '^plan/' <<<"$files" && exit 0

# Implementation files = everything except plan/intent/spec docs, .claude config and markdown.
impl=$(grep -Ev '^(plan|intent|spec|\.claude)/|\.md$' <<<"$files")
[ -z "$impl" ] && exit 0

cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"This commit changes implementation files but not plan/*.md. Compare the staged diff with the plan. If the implementation departs from it (files, order, approach or tests), update the plan, add a Deviations entry, stage it, and commit again in the same commit. If the plan still matches, re-run the commit with a 'Plan-Checked: yes' trailer in the message."}}
JSON
exit 0
