#!/usr/bin/env bash
set -euo pipefail

classifier=$(cd "$(dirname "$0")" && pwd)/metadata-only.sh
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q
git config user.name 'Status workflow fixture'
git config user.email 'test@example.invalid'
printf '{}\n' > package.json
printf 'old docs\n' > README.md
printf '[]\n' > incidents.json
git add .
git commit -qm base
base=$(git rev-parse HEAD)

printf 'new docs\n' > README.md
git commit -qam docs
bash "$classifier" "$base" "$(git rev-parse HEAD)"

printf '[{}]\n' > incidents.json
git commit -qam incidents
if bash "$classifier" "$base" "$(git rev-parse HEAD)"; then
    echo 'A site input was treated as metadata' >&2
    exit 1
fi

git reset --hard -q "$base"
printf '{"dependencies":{"fixture":"1.0.0"}}\n' > package.json
git commit -qam dependency
if bash "$classifier" "$base" "$(git rev-parse HEAD)"; then
    echo 'A runtime dependency was treated as metadata' >&2
    exit 1
fi
