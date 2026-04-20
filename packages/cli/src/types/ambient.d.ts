// Ambient declarations for untyped P2P modules consumed by the CLI.
//
// These packages ship as plain JS with no bundled types. We only use a thin
// surface (default exports used as constructors), so a permissive `any`
// module declaration is enough to unblock `tsup --dts` in CI without
// committing to maintaining our own typings.
//
// When upstream ships proper types, delete the corresponding entry.

declare module 'hyperswarm'
declare module 'hypercore-crypto'
declare module 'b4a'
declare module 'corestore'
declare module 'hyperbee'
declare module 'hypercore'
declare module 'hyperdrive'
declare module 'jsdom'
declare module 'qrcode-terminal'
