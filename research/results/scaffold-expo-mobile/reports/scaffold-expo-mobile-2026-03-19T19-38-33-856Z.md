# scaffold-expo-mobile — Run Report

**Date:** 2026-03-19 19:38:33 UTC
**Status:** FAILED
**Duration:** 7.7m

## Summary

4/5 variants passed

| Variant | Status | Iterations | Errors |
|---------|--------|------------|--------|
| features=bare | PASS | 1 | environment |
| features=p2p | PASS | 1 | environment |
| features=qvac | PASS | 1 | environment |
| features=kv-storage | PASS | 1 | environment |
| features=p2p,kv-storage,qvac | FAIL | 3 | experiment, infrastructure |

## Infrastructure Errors (research framework bug)

> These are bugs in the research process itself, not in the scaffolded code.
> Fix these first — they prevent experiments from running correctly.

### npm-install
```
Command failed: npm install
npm warn ERESOLVE overriding peer dependency
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publici
```
<details><summary>stderr</summary>

```
npm warn ERESOLVE overriding peer dependency
npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated glob@7.2.3: Old versions of glob are not supported, an
```
</details>

## Environment Errors (missing tools)

> These indicate missing tools or misconfigured dev environment.
> Run `us doctor` to check your setup.

- **ios-maestro-smoke**: Command failed: maestro test --platform ios /var/folders/h3/r38jphpj3l90s2c0r39b4zzh0000gn/T/us-maestro-1773949192221.yaml
- **android-maestro-smoke**: Command failed: maestro test --platform android /var/folders/h3/r38jphpj3l90s2c0r39b4zzh0000gn/T/us-maestro-1773949192231.yaml

## Experiment Errors (scaffold bugs)

> These are real failures in the scaffolded code — the things we need to fix.

### scaffold
```
Command failed: us scaffold app -p expo-mobile -n test-mobile -f p2p,qvac -o /tmp/us-research-scaffold-expo-mobile-p2p-qvac
```

### scaffold
```
Command failed: us scaffold app -p expo-mobile -n test-mobile -f p2p,kv-storage,qvac -o /tmp/us-research-scaffold-expo-mobile-p2p-kv-storage-qvac
```

## Files to Investigate

If experiment errors above need code changes, look at:

- `packages/cli/src/generators/expo-mobile.ts`
- `packages/cli/src/generators/common.ts`
