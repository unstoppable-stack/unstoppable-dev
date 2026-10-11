#!/usr/bin/env bash
#
# Release acceptance gate for the Unstoppable Stack developer preview.
#
# Simulates a clean-machine install of the core launch package and exercises the
# critical first-run paths. This is THE gate: if this script fails, the
# release is not ready.
#
# What it does:
#   1. Packs the CLI into a tarball. Deferred Node alpha packages are included
#      only when INCLUDE_NODE_ALPHA=1 is explicitly set.
#   2. Installs the selected tarballs into an ISOLATED prefix (no pollution of
#      your real global npm).
#   3. Asserts `us --version` reports the expected version + minimal profile.
#   4. Asserts the core `init`, `scaffold`, `doctor`, and read-only `compatibility` commands ship.
#   5. Verifies the scaffold catalog excludes deferred/planned targets.
#   6. Runs `us doctor`, `us init`, and a Pear Desktop scaffold.
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
#     -e SKIP_PACK=1 -e TARBALL_DIR=/tarballs node:22 \
#     bash scripts/release-smoke.sh
#
# Env knobs:
#   TARBALL_DIR  — where tarballs are staged (default: throwaway temp dir)
#   RELEASE_NPM_CACHE — optional existing cache for a clearly labeled cached retry
#   PACK_ONLY=1  — pack into TARBALL_DIR and exit (host half)
#   SKIP_PACK=1  — install pre-staged tarballs from TARBALL_DIR (container half)
#   INCLUDE_NODE_ALPHA=1 — additionally pack/install/smoke the deferred Node line
#   INSTALL_GENERATED_APP=1 — install the generated Pear/QVAC app dependency tree
#   RUN_DESKTOP_UI=1 — exercise the exact artifact-generated app UI
#   RUN_REAL_QVAC=1 — run real model/error/retry/cancel checks (implies UI)
#   RUN_OFFLINE_QVAC=1 — repeat real-model UI offline on macOS
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
PREFIX="$WORK/npm-global"
NPM_CACHE="${RELEASE_NPM_CACHE:-$WORK/npm-cache}"
STAGE="${TARBALL_DIR:-$WORK/tarballs}"
PROJECTS="$WORK/projects"
mkdir -p "$PREFIX" "$NPM_CACHE" "$STAGE" "$PROJECTS"

# Isolated global install: keep npm's prefix, cache, and logs in the throwaway
# workspace and put its bin on PATH ahead of everything else. Nothing touches
# the user's global installation or profile cache.
export npm_config_prefix="$PREFIX"
export npm_config_cache="$NPM_CACHE"
export npm_config_update_notifier=false
export PATH="$PREFIX/bin:$PATH"

START_TS=$(date +%s)
STEP=0
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗ %s\033[0m\n' "$1"; exit 1; }
step() { STEP=$((STEP + 1)); printf '\n\033[1m[%d] %s\033[0m\n' "$STEP" "$1"; }

# Only remove the temp dir — never a user-provided TARBALL_DIR.
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

node "$REPO_ROOT/scripts/sync-stack-assets.mjs" --check
node "$REPO_ROOT/scripts/check-agent-pack.mjs"
node --test "$REPO_ROOT"/packages/runtime-ai/test/*.test.js

EXPECTED_CLI_VERSION="$(node -p "require('$REPO_ROOT/packages/cli/package.json').version")"
INCLUDE_NODE_ALPHA="${INCLUDE_NODE_ALPHA:-0}"
INSTALL_GENERATED_APP="${INSTALL_GENERATED_APP:-0}"
RUN_DESKTOP_UI="${RUN_DESKTOP_UI:-0}"
RUN_REAL_QVAC="${RUN_REAL_QVAC:-0}"
RUN_OFFLINE_QVAC="${RUN_OFFLINE_QVAC:-0}"
if [ "$RUN_OFFLINE_QVAC" = "1" ] && [ "$RUN_REAL_QVAC" != "1" ]; then fail "Offline QVAC requires RUN_REAL_QVAC=1"; fi
if [ "$RUN_REAL_QVAC" = "1" ]; then RUN_DESKTOP_UI=1; fi
if [ "$RUN_DESKTOP_UI" = "1" ]; then INSTALL_GENERATED_APP=1; fi

# ---------------------------------------------------------------------------
step "Packing launch packages"
# ---------------------------------------------------------------------------
# `npm pack` honors each package's prepack (the CLI rebuilds the minimal
# profile), so tarballs reflect exactly what would be published.
if [ "${SKIP_PACK:-0}" = "1" ]; then
  REQUIRED_TARBALLS=(unstoppable-stack-cli)
  if [ "$INCLUDE_NODE_ALPHA" = "1" ]; then
    REQUIRED_TARBALLS+=(unstoppable-stack-node-core unstoppable-stack-node-caps-sync unstoppable-stack-node-caps-ai unstoppable-node)
  fi
  for glob in "${REQUIRED_TARBALLS[@]}"; do
    ls "$STAGE/$glob"-*.tgz >/dev/null 2>&1 \
      || fail "SKIP_PACK=1 but no $glob-*.tgz in $STAGE — run the PACK_ONLY=1 half on the host first"
  done
  pass "using pre-staged tarballs from $STAGE"
else
  PACKAGES=(cli)
  if [ "$INCLUDE_NODE_ALPHA" = "1" ]; then
    PACKAGES=(node-core node-caps-sync node-caps-ai node cli)
  fi
  for pkg in "${PACKAGES[@]}"; do
    ( cd "$REPO_ROOT/packages/$pkg" && npm pack --pack-destination "$STAGE" >/dev/null )
    pass "packed $pkg"
  done
fi

# Retain immutable artifact identity even when packing an unfrozen source tree.
node "$REPO_ROOT/scripts/release-artifacts.mjs" "$STAGE"

if [ "${PACK_ONLY:-0}" = "1" ]; then
  printf '\n\033[32mPACK_ONLY done\033[0m — tarballs staged in %s\n' "$STAGE"
  ls -1 "$STAGE"
  exit 0
fi

# ---------------------------------------------------------------------------
step "Installing globally (isolated prefix, dependency order)"
# ---------------------------------------------------------------------------
CLI_TGZ="$(ls "$STAGE"/unstoppable-stack-cli-*.tgz)"
if [ "$INCLUDE_NODE_ALPHA" = "1" ]; then
  CORE_TGZ="$(ls "$STAGE"/unstoppable-stack-node-core-*.tgz)"
  SYNC_TGZ="$(ls "$STAGE"/unstoppable-stack-node-caps-sync-*.tgz)"
  AI_TGZ="$(ls "$STAGE"/unstoppable-stack-node-caps-ai-*.tgz)"
  NODE_TGZ="$(ls "$STAGE"/unstoppable-node-*.tgz)"
  npm install -g "$CORE_TGZ" "$SYNC_TGZ" "$AI_TGZ" "$NODE_TGZ" "$CLI_TGZ" --no-audit --no-fund
  pass "installed CLI plus deferred Node alpha packages"
else
  npm install -g "$CLI_TGZ" --no-audit --no-fund
  INSTALL_SIZE_KIB="$(du -sk "$PREFIX" | awk '{print $1}')"
  pass "installed core CLI (${INSTALL_SIZE_KIB} KiB isolated prefix)"
fi

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
for cmd in init scaffold doctor compatibility; do
  echo "$HELP_OUT" | grep -q "^  $cmd" || fail "missing command: $cmd"
done
pass "init, scaffold, doctor, compatibility present"
for cmd in remote research search node memory; do
  if echo "$HELP_OUT" | grep -q "^  $cmd"; then
    fail "'$cmd' command present — it is outside the core preview"
  fi
done
pass "deferred command surfaces correctly excluded"

# ---------------------------------------------------------------------------
step "Public scaffold catalog"
# ---------------------------------------------------------------------------
PLATFORMS_OUT="$(us scaffold list-platforms)"
FEATURES_OUT="$(us scaffold list-features)"
node -e "const x=JSON.parse(process.argv[1]); if (x.length !== 1 || x[0].id !== 'pear-desktop') process.exit(1)" "$PLATFORMS_OUT" \
  || fail "minimal scaffold catalog exposed a platform outside pear-desktop"
node -e "const x=JSON.parse(process.argv[1]); if (x.length !== 1 || x[0].id !== 'local-ai') process.exit(1)" "$FEATURES_OUT" \
  || fail "minimal scaffold catalog exposed a feature outside local-ai"
if us scaffold app -p expo-mobile -n deferred-mobile -o "$PROJECTS/deferred-mobile" >/dev/null 2>&1; then
  fail "minimal build accepted deferred expo-mobile scaffold"
fi
if us scaffold app -p pear-desktop -n planned-wallet -f wallet -o "$PROJECTS/planned-wallet" >/dev/null 2>&1; then
  fail "minimal build accepted planned wallet scaffold"
fi
pass "only Pear Desktop and local-ai are exposed by the minimal build"

# ---------------------------------------------------------------------------
step "us doctor"
# ---------------------------------------------------------------------------
# Non-fatal: a clean machine may be missing optional toolchains. We only
# require that the command runs without crashing.
DOCTOR_JSON="$(us doctor --json)"
node -e "const x=JSON.parse(process.argv[1]); const keys=Object.keys(x.readiness); if (keys.length !== 1 || keys[0] !== 'pear-desktop') process.exit(1)" "$DOCTOR_JSON" \
  || fail "minimal doctor reported deferred platform readiness"
pass "doctor reports only Pear Desktop readiness in the minimal build"
if us doctor >/dev/null 2>&1; then
  pass "doctor ran clean"
else
  pass "doctor ran (reported environment gaps — expected on a clean machine)"
fi

# ---------------------------------------------------------------------------
step "us init (non-interactive)"
# ---------------------------------------------------------------------------
( cd "$PROJECTS" && us init -a codex --no-install smoke-init >/dev/null )
[ -d "$PROJECTS/smoke-init" ] || fail "us init did not create the project dir"
[ -f "$PROJECTS/smoke-init/AGENTS.md" ] \
  || fail "us init did not write the Codex agent instructions"
pass "scaffolded smoke-init with AGENTS.md"

# ---------------------------------------------------------------------------
step "us scaffold app (Pear Desktop + local AI)"
# ---------------------------------------------------------------------------
us scaffold app -p pear-desktop -n smoke-scaffold -f local-ai -o "$PROJECTS/smoke-scaffold" >/dev/null
[ -f "$PROJECTS/smoke-scaffold/package.json" ] \
  || fail "scaffold did not produce a package.json"
node -e "const p=require('$PROJECTS/smoke-scaffold/package.json'); if (!p.dependencies?.['@qvac/inference']) process.exit(1)" \
  || fail "local-ai scaffold did not declare @qvac/inference"
pass "scaffolded Pear Desktop local-ai app"

for generated_js in electron/main.js electron/preload.cjs worker.js .unstoppable/runtime-ai/index.js .unstoppable/runtime-ai/history.js .unstoppable/runtime-ai/adapters.js app/bridge.js app/index.js; do
  node --check "$PROJECTS/smoke-scaffold/$generated_js" >/dev/null \
    || fail "generated syntax check failed: $generated_js"
done
pass "generated app JavaScript passes syntax checks"

if [ "$INSTALL_GENERATED_APP" = "1" ]; then
  # This is intentionally opt-in for fast local smoke runs: Electron and QVAC
  # pull a large native dependency tree. Final candidate evidence must enable
  # it so the documented generated application, not only the CLI, is installed.
  ( cd "$PROJECTS/smoke-scaffold" && npm install --no-audit --no-fund )
  ( cd "$PROJECTS/smoke-scaffold" && npm ls --depth=0 >/dev/null ) \
    || fail "generated app dependency tree is incomplete"
  pass "installed generated Pear Desktop local-ai dependency tree"
fi

if [ "$RUN_DESKTOP_UI" = "1" ]; then
  step "Artifact-generated desktop worker, storage, and UI"
  export US_DESKTOP_PERSISTENCE_VALUE="release-smoke-$START_TS-$$"
  AI_MOCK=1
  if [ "$RUN_REAL_QVAC" = "1" ]; then AI_MOCK=0; fi
  ( cd "$REPO_ROOT/packages/cli" &&
    US_DESKTOP_PROJECT_DIR="$PROJECTS/smoke-scaffold" QVAC_MOCK="$AI_MOCK" QVAC_REAL_E2E="$RUN_REAL_QVAC" \
    ./node_modules/.bin/tsx e2e/test-scaffold.ts --platform pear-desktop --variant local-ai --level 5 --skip-build )
  pass "artifact-generated app passed worker, storage, and UI"
  if [ "$RUN_OFFLINE_QVAC" = "1" ]; then
    ( cd "$REPO_ROOT/packages/cli" &&
      US_DESKTOP_PROJECT_DIR="$PROJECTS/smoke-scaffold" QVAC_MOCK=0 QVAC_REAL_E2E=1 QVAC_OFFLINE_E2E=1 \
      ./node_modules/.bin/tsx e2e/test-scaffold.ts --platform pear-desktop --variant local-ai --level 5 --skip-build )
    pass "artifact-generated app passed network-isolated real-model restart"
  fi
fi

if [ "$INCLUDE_NODE_ALPHA" = "1" ]; then
  # -------------------------------------------------------------------------
  step "deferred unstoppable-node alpha help"
  # -------------------------------------------------------------------------
  unstoppable-node help >/dev/null || fail "unstoppable-node help failed"
  pass "deferred Node alpha binary runs"
fi

# ---------------------------------------------------------------------------
ELAPSED=$(( $(date +%s) - START_TS ))
printf '\n\033[32m\033[1mRELEASE SMOKE PASSED\033[0m in %ds\n' "$ELAPSED"
if [ "$RUN_REAL_QVAC" = "1" ]; then
  echo "Real inference and recovery passed from the packed CLI; clean-machine, pilot, and frozen-commit gates remain separate."
elif [ "$RUN_DESKTOP_UI" = "1" ]; then
  echo "Desktop UI and storage passed with mock AI; no real model ran."
elif [ "$INSTALL_GENERATED_APP" = "1" ]; then
  echo "This validates CLI and generated-app installation, not a running model or signed desktop application."
else
  echo "This validates CLI installation and command generation. Set INSTALL_GENERATED_APP=1 for the large app install; no real model or signed desktop application ran."
fi
