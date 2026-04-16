# scaffold-expo-mobile — Run Report

**Date:** 2026-03-19 19:36:07 UTC
**Status:** PASSED
**Duration:** 12.5m

## Summary

5/6 variants passed

| Variant | Status | Iterations | Errors |
|---------|--------|------------|--------|
| features=bare | PASS | 1 | environment |
| features=p2p | PASS | 1 | environment |
| features=qvac | FAIL | 1 | experiment, environment |
| features=kv-storage | PASS | 1 | environment |
| features=p2p,qvac | PASS | 1 | environment |
| features=p2p,kv-storage,qvac | PASS | 2 | experiment, environment |

## Environment Errors (missing tools)

> These indicate missing tools or misconfigured dev environment.
> Run `us doctor` to check your setup.

- **ios-maestro-smoke**: Command failed: maestro test --platform ios /var/folders/h3/r38jphpj3l90s2c0r39b4zzh0000gn/T/us-maestro-1773949041957.yaml
- **android-maestro-smoke**: Command failed: maestro test --platform android /var/folders/h3/r38jphpj3l90s2c0r39b4zzh0000gn/T/us-maestro-1773949041966.yaml

## Experiment Errors (scaffold bugs)

> These are real failures in the scaffolded code — the things we need to fix.

### android-build
```
For more on this, please refer to https://docs.gradle.org/8.14.3/userguide/command_line_interface.html#sec:command_line_warnings in the Gradle documentation.

BUILD FAILED in 25s
151 actionable tasks: 151 executed
```

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

## Files to Investigate

If experiment errors above need code changes, look at:

- `packages/cli/src/generators/expo-mobile.ts`
- `packages/cli/src/generators/common.ts`
