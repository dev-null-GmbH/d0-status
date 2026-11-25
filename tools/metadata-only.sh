#!/usr/bin/env bash
set -euo pipefail

base=${1:-}
head=${2:-}
[[ $base =~ ^[0-9a-f]{40}$ && $head =~ ^[0-9a-f]{40}$ ]] || exit 1
[[ $(git rev-parse HEAD) == "$head" ]] || exit 1
git cat-file -e "$base^{commit}" 2>/dev/null || exit 1
git merge-base --is-ancestor "$base" "$head" || exit 1
jq -e '(.dependencies // {}) == {} and (.optionalDependencies // {}) == {}' package.json >/dev/null || exit 1

changed_paths=$(mktemp)
trap 'rm -f "$changed_paths"' EXIT
git diff-tree --no-commit-id --no-renames --raw -r -z "$base" "$head" > "$changed_paths" || exit 1
[[ -s $changed_paths ]] || exit 1
while IFS= read -r -d '' change; do
    IFS= read -r -d '' path || exit 1
    case "$change" in
        ':100644 100644 '*" M" | ':000000 100644 '*" A") ;;
        *) exit 1 ;;
    esac
    case "$path" in
        AGENTS.md | README.md | package.json | bun.lock | browser-smoke.ts | status.test.ts | \
        .github/workflows/public-status.yml | .github/workflows/artifact-security.yml | \
        tools/metadata-only.sh | tools/test-metadata-only.sh | tools/verify-static-artifact.ts) ;;
        *) exit 1 ;;
    esac
done < "$changed_paths"
