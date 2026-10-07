#!/bin/bash
# Test guard: an existing (git-tracked) test file can only be edited if the approved
# plan for the current branch (plan/NNN-*.md for branch build/NNN-*) names its path. New test files are free.
# Protects unit tests (*.test.ts, *.test.tsx) and everything under e2e/. Only sees Edit and Write
# calls, not shell edits. Reads hook JSON from stdin (no jq dependency) and
# fails open on anything it cannot parse.
input=$(cat)

# Target path from tool_input.file_path; undo JSON escaping of backslashes.
[[ "$input" =~ \"file_path\"[[:space:]]*:[[:space:]]*\"([^\"]*)\" ]] || exit 0
backslash=$'\\'
target="${BASH_REMATCH[1]}"
target="${target//"$backslash$backslash"//}"
target="${target//"$backslash"//}"
target="${target,,}"

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0

# Tracked protected file whose path the target ends with.
protected=""
while IFS= read -r tracked; do
  lower="${tracked,,}"
  if [[ "$target" == "$lower" || "$target" == */"$lower" ]]; then
    protected="$tracked"
    break
  fi
done < <(git ls-files -- '*.test.ts' '*.test.tsx' 'e2e/*' 2>/dev/null)
[ -z "$protected" ] && exit 0

# Unlocked when the approved plan for this branch (build/NNN-*) names the path.
# Plans from other work don't count, or an old plan would unlock a test forever.
branch=$(git branch --show-current 2>/dev/null)
if [[ "$branch" =~ ([0-9]{3}) ]]; then
  for plan in plan/"${BASH_REMATCH[1]}"-*.md; do
    [ -f "$plan" ] || continue
    if grep -q 'Status: approved' "$plan" && grep -qF -- "$protected" "$plan"; then
      exit 0
    fi
  done
fi

cat <<JSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"$protected is an existing test and is protected. Fix the code, not the test. If the test genuinely has to change, add its path to the Tests section of an approved plan/*.md first."}}
JSON
exit 0
