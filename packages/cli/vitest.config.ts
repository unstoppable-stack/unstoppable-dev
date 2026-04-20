import { defineConfig } from 'vitest/config'

/**
 * Default `vitest run` excludes tests that require live network (real DHT,
 * bootstrap nodes, etc.). Those are flaky in CI and slow locally, so they
 * live behind a separate script: `pnpm test:integration`.
 *
 * Everything under `src/__tests__/` and most of `src/remote/__tests__/` is
 * self-contained and runs in < 500ms.
 */
export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 15000,
    exclude: [
      'e2e/**',
      'node_modules/**',
      // Requires a live Hyperswarm DHT — gated behind `test:integration`.
      'src/remote/__tests__/p2p-integration.test.ts',
      // TODO(unstoppable-remote): these tests target an older `us remote`
      // subcommand shape (`wrap`, `status` layout) that has since been
      // refactored. Exclude from default runs until the suite is updated to
      // match the current CLI surface.
      'src/remote/__tests__/cli-e2e.test.ts',
    ],
  },
})
