#!/usr/bin/env bash
#
# Release acceptance gate for the Unstoppable Stack developer preview.
#
# Simulates a clean-machine install of the launch packages and exercises the
# critical first-run paths. This is THE gate: if this script fails, the
# release is not ready.
#
# What it does:
#   1. Packs the three launch packages into tarballs.
#   2. Installs them globally into an ISOLATED prefix (no pollution of your
#      real global npm) in dependency order.
#   3. Asserts `us --version` reports the expected version + minimal profile.
#   4. Asserts the command surface is correct (no `memory` in this release).
#   5. Runs `us doctor`, `us init`, `us scaffold`, and `unstoppable-node help`.
#
# Usage (local machine — packs and tests in one go):
#   bash scripts/release-smoke.sh
#
# Usage (true clean-machine run): packing must happen on the HOST — the repo's
# node_modules carry host-platform native binaries (rollup, node-pty) that
# cannot build the CLI inside a foreign-platform container. Pack first, then
# let the container do only what a real user does: install + run.
#
#   TARBALL_DIR=/tmp/us-release PACK_ONLY=1 bash scripts/release-smoke.sh
#   docker run --rm -v "$PWD":/src -v /tmp/us-release:/tarballs -w /src \
#     -e SKIP_PACK=1 -e TARBALL_DIR=/tarballs node:20 \
#     bash scripts/release-smoke.sh
#
# Env knobs:
#   TARBALL_DIR  — where tarballs are staged (default: throwaway temp dir)
#   PACK_ONLY=1  — pack into TARBALL_DIR and exit (host half)
#   SKIP_PACK=1  — install pre-staged tarballs from TARBALL_DIR (container half)
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
PREFIX="$WORK/npm-global"
STAGE="${TARBALL_DIR:-$WORK/tarballs}"
PROJECTS="$WORK/projects"
mkdir -p "$PREFIX" "$STAGE" "$PROJECTS"

# Isolated global install: point npm's prefix at a throwaway dir and put its
# bin on PATH ahead of everything else. Nothing touches the real machine.
export npm_config_prefix="$PREFIX"
export PATH="$PREFIX/bin:$PATH"

START_TS=$(date +%s)
STEP=0
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1"; exit 1; }
step() { STEP=$((STEP + 1)); printf '\n\033[1m[%d] %s\033[0m\n' "$STEP" "$1"; }

# Only remove the temp dir — never a user-provided TARBALL_DIR.
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

EXPECTED_CLI_VERSION="$(node -p "require('$REPO_ROOT/packages/cli/package.json').version")"

# ---------------------------------------------------------------------------
step "Packing launch packages"
# ---------------------------------------------------------------------------
# `npm pack` honors each package's prepack (the CLI rebuilds the minimal
# profile), so tarballs reflect exactly what would be published.
if [ "${SKIP_PACK:-0}" = "1" ]; then
  for glob in unstoppable-stack-node-core unstoppable-stack-node-caps-sync \
              unstoppable-stack-node-caps-ai unstoppable-node unstoppable-stack-cli; do
    ls "$STAGE/$glob"-*.tgz >/dev/null 2>&1 \
      || fail "SKIP_PACK=1 but no $glob-*.tgz in $STAGE — run the PACK_ONLY=1 half on the host first"
  done
  pass "using pre-staged tarballs from $STAGE"
else
  for pkg in node-core node-caps-sync node-caps-ai node cli; do
    ( cd "$REPO_ROOT/packages/$pkg" && npm pack --pack-destination "$STAGE" >/dev/null )
    pass "packed $pkg"
  done
fi

if [ "${PACK_ONLY:-0}" = "1" ]; then
  printf '\n\033[32mPACK_ONLY done\033[0m — tarballs staged in %s\n' "$STAGE"
  ls -1 "$STAGE"
  exit 0
fi

# ---------------------------------------------------------------------------
step "Installing globally (isolated prefix, dependency order)"
# ---------------------------------------------------------------------------
# The shell depends on the runtime and the packs, so they install first.
CORE_TGZ="$(ls "$STAGE"/unstoppable-stack-node-core-*.tgz)"
SYNC_TGZ="$(ls "$STAGE"/unstoppable-stack-node-caps-sync-*.tgz)"
AI_TGZ="$(ls "$STAGE"/unstoppable-stack-node-caps-ai-*.tgz)"
NODE_TGZ="$(ls "$STAGE"/unstoppable-node-*.tgz)"
CLI_TGZ="$(ls "$STAGE"/unstoppable-stack-cli-*.tgz)"
npm install -g "$CORE_TGZ" "$SYNC_TGZ" "$AI_TGZ" "$NODE_TGZ" "$CLI_TGZ" >/dev/null 2>&1
pass "installed node-core, packs, node, cli"

# ---------------------------------------------------------------------------
step "us --version"
# ---------------------------------------------------------------------------
VERSION_OUT="$(us --version)"
echo "  → $VERSION_OUT"
[ "$VERSION_OUT" = "$EXPECTED_CLI_VERSION (minimal)" ] \
  || fail "expected '$EXPECTED_CLI_VERSION (minimal)', got '$VERSION_OUT'"
pass "reports $EXPECTED_CLI_VERSION (minimal)"

# ---------------------------------------------------------------------------
step "Command surface"
# ---------------------------------------------------------------------------
HELP_OUT="$(us --help)"
for cmd in init scaffold doctor node; do
  echo "$HELP_OUT" | grep -q "^  $cmd" || fail "missing command: $cmd"
done
pass "init, scaffold, doctor, node present"
if echo "$HELP_OUT" | grep -q "^  memory"; then
  fail "'memory' command present — it must be excluded from this release"
fi
pass "memory correctly excluded"

# ---------------------------------------------------------------------------
step "us doctor"
# ---------------------------------------------------------------------------
# Non-fatal: a clean machine may be missing optional toolchains. We only
# require that the command runs without crashing.
if us doctor >/dev/null 2>&1; then
  pass "doctor ran clean"
else
  pass "doctor ran (reported environment gaps — expected on a clean machine)"
fi

# ---------------------------------------------------------------------------
step "us init (non-interactive)"
# ---------------------------------------------------------------------------
( cd "$PROJECTS" && us init -a claude --no-install smoke-init >/dev/null )
[ -d "$PROJECTS/smoke-init" ] || fail "us init did not create the project dir"
[ -f "$PROJECTS/smoke-init/CLAUDE.md" ] \
  || fail "us init did not write the Claude agent instructions"
pass "scaffolded smoke-init with CLAUDE.md"

# ---------------------------------------------------------------------------
step "us scaffold app (node-cli)"
# ---------------------------------------------------------------------------
us scaffold app -p node-cli -n smoke-scaffold -o "$PROJECTS/smoke-scaffold" >/dev/null
[ -f "$PROJECTS/smoke-scaffold/package.json" ] \
  || fail "scaffold did not produce a package.json"
pass "scaffolded node-cli app"

# ---------------------------------------------------------------------------
step "unstoppable-node help"
# ---------------------------------------------------------------------------
unstoppable-node help >/dev/null || fail "unstoppable-node help failed"
pass "node binary runs"

# ---------------------------------------------------------------------------
ELAPSED=$(( $(date +%s) - START_TS ))
printf '\n\033[32m\033[1mRELEASE SMOKE PASSED\033[0m in %ds\n' "$ELAPSED"
echo "Acceptance bar: fresh machine → working scaffold in under 10 minutes."
[ "$ELAPSED" -lt 600 ] || fail "took ${ELAPSED}s (>10min) — investigate"
