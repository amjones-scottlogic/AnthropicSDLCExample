#!/bin/bash
# Manual test for test-guard.sh: runs it against sample hook JSON in a throwaway repo.
# Usage: .claude/hooks/test-guard.test.sh
hook="$(cd "$(dirname "$0")" && pwd)/test-guard.sh"
repo=$(mktemp -d)
cd "$repo" || exit 1
git init -q -b main
mkdir -p src e2e plan
touch src/a.test.ts src/b.test.tsx e2e/j.e2e.ts src/App.tsx
git add -A && git -c user.email=t@t -c user.name=t commit -qm init
export CLAUDE_PROJECT_DIR="$repo"

fail=0
check() { # name expected(deny|allow) json
  out=$(printf '%s' "$3" | "$hook")
  got=allow; [[ "$out" == *'"deny"'* ]] && got=deny
  if [ "$got" = "$2" ]; then echo "ok   $1"; else echo "FAIL $1 (expected $2, got $got)"; fail=1; fi
}
edit() { printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$1"; }

check "tracked .test.ts, no plan"      deny  "$(edit "$repo/src/a.test.ts")"
check "tracked .test.tsx, no plan"     deny  "$(edit "$repo/src/b.test.tsx")"
check "tracked e2e file, no plan"      deny  "$(edit "$repo/e2e/j.e2e.ts")"
check "windows escaped path"           deny  "$(edit 'C:\\x\\src\\a.test.ts')"
check "new untracked test"             allow "$(edit "$repo/src/new.test.ts")"
check "non-test file"                  allow "$(edit "$repo/src/App.tsx")"
check "unparseable input"              allow "not json"

git switch -q -c build/001-x
printf 'Status: draft.\nTests: src/a.test.ts\n' > plan/001-x.md
check "draft plan names it"            deny  "$(edit "$repo/src/a.test.ts")"
printf 'Status: approved.\nTests: src/a.test.ts\n' > plan/001-x.md
check "approved plan names it"         allow "$(edit "$repo/src/a.test.ts")"
git switch -q -c build/002-y
check "approved plan for another branch" deny  "$(edit "$repo/src/a.test.ts")"
git switch -q build/001-x
check "approved plan names another"    deny  "$(edit "$repo/src/b.test.tsx")"

rm -rf "$repo"
exit $fail
