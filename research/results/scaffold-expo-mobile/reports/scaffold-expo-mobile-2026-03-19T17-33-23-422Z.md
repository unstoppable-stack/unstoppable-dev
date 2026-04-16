# scaffold-expo-mobile — Run Report

**Date:** 2026-03-19 17:33:23 UTC
**Status:** PASSED
**Duration:** 14.0m

## Summary

7/7 variants passed

| Variant | Status | Iterations | Errors |
|---------|--------|------------|--------|
| features=bare | PASS | 1 | environment |
| features=p2p | PASS | 1 | environment |
| features=qvac | PASS | 1 | environment |
| features=kv-storage | PASS | 1 | environment |
| features=p2p,qvac | PASS | 1 | environment |
| features=p2p,kv-storage | PASS | 1 | environment |
| features=p2p,kv-storage,qvac | PASS | 1 | environment |

## Environment Errors (missing tools)

> These indicate missing tools or misconfigured dev environment.
> Run `us doctor` to check your setup.

- **ios-maestro-smoke**: Command failed: maestro test --platform ios /var/folders/h3/r38jphpj3l90s2c0r39b4zzh0000gn/T/us-maestro-1773941705384.yaml
- **android-maestro-smoke**: Command failed: maestro test --platform android /var/folders/h3/r38jphpj3l90s2c0r39b4zzh0000gn/T/us-maestro-1773941705398.yaml

## Files to Investigate

If experiment errors above need code changes, look at:

- `packages/cli/src/generators/expo-mobile.ts`
- `packages/cli/src/generators/common.ts`
