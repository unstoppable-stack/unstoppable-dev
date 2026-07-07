// Build-time feature flags.
//
// Each flag is replaced with a literal `true` / `false` by esbuild's
// `define` pass (see `tsup.config.ts`). At runtime, the TypeScript code
// sees constants, so standard DCE collapses `if (false) { await import(...) }`
// and the gated command's entire module tree drops out of the bundle.
//
// Profile defaults live in `tsup.config.ts`. Per-flag overrides via env:
//   US_FEAT_REMOTE=true pnpm build
//
// Keep this list in sync with PROFILES in `tsup.config.ts`.

declare const US_FEAT_INIT: boolean
declare const US_FEAT_SCAFFOLD: boolean
declare const US_FEAT_DOCTOR: boolean
declare const US_FEAT_REMOTE: boolean
declare const US_FEAT_RESEARCH: boolean
declare const US_FEAT_SEARCH: boolean
declare const US_FEAT_NODE: boolean
declare const US_FEAT_MEMORY: boolean

// Name of the profile that was used to build this bundle
// ("minimal" | "full" | custom). Surfaced via `us --version` so bug
// reports carry it for free.
declare const __US_BUILD_PROFILE__: string

// CLI version, injected from package.json at build time (see tsup.config.ts).
// Keeps `us --version` from drifting out of sync with the published version.
declare const __US_VERSION__: string
