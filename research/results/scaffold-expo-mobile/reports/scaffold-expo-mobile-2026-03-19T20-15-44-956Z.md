# scaffold-expo-mobile — Run Report

**Date:** 2026-03-19 20:15:44 UTC
**Status:** PASSED
**Duration:** 15.8m

## Summary

7/7 variants passed

| Variant | Status | Iterations | Errors |
|---------|--------|------------|--------|
| features=bare | PASS | 1 | — |
| features=p2p | PASS | 1 | — |
| features=qvac | PASS | 1 | — |
| features=kv-storage | PASS | 1 | — |
| features=p2p,qvac | PASS | 1 | — |
| features=p2p,kv-storage | PASS | 1 | — |
| features=p2p,kv-storage,qvac | PASS | 1 | — |

## Files to Investigate

If experiment errors above need code changes, look at:

- `packages/cli/src/generators/expo-mobile.ts`
- `packages/cli/src/generators/common.ts`
