#!/bin/bash
# Approval gate: any `git push` pauses for human sign-off.
# Reads the hook JSON from stdin; matches the command field directly (no jq dependency).
input=$(cat)
if [[ "$input" =~ \"command\"[[:space:]]*:[[:space:]]*\"[^\"]*git[[:space:]]+push ]]; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"git push needs human approval before anything leaves this machine."}}
JSON
fi
exit 0
