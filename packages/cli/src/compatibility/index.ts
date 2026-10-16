import manifest from './profiles.json'
import { runtimeSources, runtimeVersion, cliVersion } from '../generated/runtime-ai.js'
import type { GeneratorOptions, GeneratedFile, Platform } from '../generators/types.js'

export { manifest }
export function profileFor(platform: Platform) { return manifest.profiles[platform] }

export function dependenciesFor(opts: GeneratorOptions) {
  const profile = profileFor(opts.platform)
  const dependencies: Record<string, string> = { ...profile.dependencies }
  for (const feature of opts.features) {
    Object.assign(dependencies, (profile.featureDependencies as Record<string, Record<string, string>>)[feature] || {})
  }
  if (opts.features.includes('multi-writer')) delete dependencies.hyperbee
  return dependencies
}

export function projectFiles(opts: GeneratorOptions): GeneratedFile[] {
  const profile = profileFor(opts.platform)
  const ai = opts.features.includes('local-ai') && !!profile.aiRuntime
  return [{
    path: '.unstoppable/project.json',
    content: JSON.stringify({
      schemaVersion: manifest.schemaVersion,
      generator: { name: '@unstoppable-stack/cli', version: cliVersion },
      platform: opts.platform,
      features: opts.features,
      compatibility: { id: profile.id, revision: profile.revision },
      maturity: profile.maturity,
      featureMaturity: Object.fromEntries(opts.features.map(feature => [feature, profile.featureMaturity[feature]])),
      runtimeRequirements: profile.runtimeRequirements,
      aiRuntime: ai ? { version: runtimeVersion, delivery: 'vendored', path: '.unstoppable/runtime-ai' } : null,
      model: opts.features.includes('local-ai') ? manifest.model : null,
      validation: profile.validation,
      expected: { dependencies: dependenciesFor(opts), devDependencies: profile.devDependencies },
    }, null, 2) + '\n',
  }, {
    path: '.unstoppable/APP.md',
    content: `# App integration\n\nRead project.json in this directory and the app's package.json/lockfile before changing infrastructure. The profile records selected features and maturity.\n\nDesktop native code belongs in worker.js; the renderer uses app/bridge.js and the preload API. Node managers live in src/. Expo has a separate React Native SDK host and Bare networking worklet. Read the generated entrypoints before importing a helper.\n\n${ai ? 'Local AI uses the vendored runtime-ai/index.js session. The app owns history/prompts/UI; the runtime owns loading, streaming, native Stop, context bounds and shutdown. One model supports one active session request. Keep consuming or return the iterator so cancellation can settle. Native acceptance still requires real model and offline tests.' : 'Do not assume local AI or Personal Node is installed. Select integrations from this app’s recorded features.'}\n\nUse us compatibility check -o <app> to inspect upgrade differences. Preserve application edits; do not regenerate an edited app with --force. Read installed types and version-matched upstream docs for advanced SDK APIs.\n`,
  }, ...ai ? Object.entries(runtimeSources).map(([name, content]) => ({ path: `.unstoppable/runtime-ai/${name}`, content })) : []]
}
