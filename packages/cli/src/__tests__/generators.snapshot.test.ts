/**
 * Generator snapshot tests.
 *
 * Every generator is a pure function of (projectName, features). If the
 * output tree ever drifts — file added, removed, renamed, or content
 * changed — these tests fail loudly and the diff shows exactly what moved.
 *
 * Philosophy:
 *   - Generator unit tests (`generators.test.ts`,
 *     `pear-desktop-generator.test.ts`, `node-cli-generator.test.ts`) assert
 *     *structural* invariants: "package.json is valid JSON", "P2P deps
 *     always present", etc. They're fast to read and fail with meaningful
 *     messages.
 *   - Snapshot tests catch the *rest*: unintended whitespace changes,
 *     dependency version bumps slipped in silently, entry-point contents
 *     mutated, etc. They're noisy but exhaustive.
 *
 * When a snapshot test fails intentionally (e.g. you bumped a dep), run
 * `npx vitest -u` in `packages/cli/` to refresh the snapshots, inspect the
 * git diff in `__snapshots__/`, and commit.
 *
 * The snapshot captures the full file tree (sorted, with contents) so the
 * diff shown on failure is directly readable as "what a developer would
 * see after `us scaffold`".
 */
import { describe, it, expect } from 'vitest'
import { generateNodeCli } from '../generators/node-cli.js'
import { generatePearDesktop } from '../generators/pear-desktop.js'
import { generateExpoMobile } from '../generators/expo-mobile.js'
import type {
  Feature,
  GeneratorOptions,
  GeneratedFile,
  Platform,
} from '../generators/types.js'

// Canonicalise the output so diffs are stable across refactors that
// reorder internal generation logic but not actual files.
function canonicalize(files: GeneratedFile[]) {
  // Check for duplicates up-front — catches generator logic bugs that
  // would otherwise silently collapse files in the snapshot object.
  const seen = new Set<string>()
  for (const f of files) {
    if (seen.has(f.path)) {
      throw new Error(`Duplicate path in generator output: ${f.path}`)
    }
    seen.add(f.path)
  }
  return [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => ({ path: f.path, content: f.content }))
}

function opts(platform: Platform, features: Feature[]): GeneratorOptions {
  return { projectName: 'snap-test', platform, features }
}

// Full variant matrix — mirrors the one in `e2e/test-scaffold.ts`. Any time
// the scaffold E2E matrix grows, this list should grow to match.
const VARIANTS: Record<Platform, { name: string; features: Feature[] }[]> = {
  'pear-desktop': [
    { name: 'bare', features: [] },
    { name: 'local-ai', features: ['local-ai'] },
    { name: 'wallet', features: ['wallet'] },
    { name: 'local-ai+wallet', features: ['local-ai', 'wallet'] },
  ],
  'node-cli': [
    { name: 'bare', features: [] },
    { name: 'local-ai', features: ['local-ai'] },
    { name: 'wallet', features: ['wallet'] },
  ],
  'expo-mobile': [
    { name: 'bare', features: [] },
    { name: 'local-ai', features: ['local-ai'] },
  ],
}

describe('generator snapshots', () => {
  describe('pear-desktop', () => {
    for (const variant of VARIANTS['pear-desktop']) {
      it(`${variant.name}: file tree matches snapshot`, () => {
        const files = generatePearDesktop(opts('pear-desktop', variant.features))
        expect(canonicalize(files)).toMatchSnapshot()
      })
    }
  })

  describe('node-cli', () => {
    for (const variant of VARIANTS['node-cli']) {
      it(`${variant.name}: file tree matches snapshot`, () => {
        const files = generateNodeCli(opts('node-cli', variant.features))
        expect(canonicalize(files)).toMatchSnapshot()
      })
    }
  })

  describe('expo-mobile', () => {
    for (const variant of VARIANTS['expo-mobile']) {
      it(`${variant.name}: file tree matches snapshot`, () => {
        const files = generateExpoMobile(opts('expo-mobile', variant.features))
        expect(canonicalize(files)).toMatchSnapshot()
      })
    }
  })

  // Summary-level "list of paths" snapshot — a quicker failure signal for
  // "a file was added or removed" that doesn't drag in content diffs. Easy
  // to inspect at a glance.
  describe('file paths only', () => {
    for (const platform of Object.keys(VARIANTS) as Platform[]) {
      for (const variant of VARIANTS[platform]) {
        it(`${platform} / ${variant.name}: path list matches snapshot`, () => {
          const gen =
            platform === 'pear-desktop'
              ? generatePearDesktop
              : platform === 'node-cli'
                ? generateNodeCli
                : generateExpoMobile
          const paths = gen(opts(platform, variant.features))
            .map((f) => f.path)
            .sort()
          expect(paths).toMatchSnapshot()
        })
      }
    }
  })
})
