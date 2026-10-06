#!/usr/bin/env node

import { Command } from 'commander'

// Each registration is gated by a build-time flag (see
// `src/types/features.d.ts` + `tsup.config.ts`). The flags are replaced
// with literal `true` / `false` by esbuild's `define` pass, which lets the
// bundler DCE both the dynamic `import()` and the target module tree when a
// feature is off.
//
// Using dynamic `import()` inside the gate (rather than top-level static
// imports + conditional call) is what unlocks the bundler's ability to
// drop the module entirely — a static import would survive even when the
// function call behind it is dead, because ESM imports have observable
// side effects.
async function main() {
  const program = new Command()

  program
    .name('us')
    .description('The Unstoppable Stack CLI')
    .version(`${__US_VERSION__} (${__US_BUILD_PROFILE__})`)

  if (US_FEAT_INIT) {
    const { registerInitCommand } = await import('./commands/init.js')
    registerInitCommand(program)
  }
  if (US_FEAT_SCAFFOLD) {
    const { registerScaffoldCommand } = await import('./commands/scaffold.js')
    registerScaffoldCommand(program, { publicPreview: __US_BUILD_PROFILE__.startsWith('minimal') })
  }
  if (US_FEAT_DOCTOR) {
    const { registerDoctorCommand } = await import('./commands/doctor.js')
    registerDoctorCommand(program, {
      includeNode: US_FEAT_NODE,
      publicPreview: __US_BUILD_PROFILE__.startsWith('minimal'),
    })
  }
  if (US_FEAT_REMOTE) {
    const { registerRemoteCommand } = await import('./commands/remote.js')
    registerRemoteCommand(program)
  }
  if (US_FEAT_RESEARCH) {
    const { registerResearchCommand } = await import('./commands/research.js')
    registerResearchCommand(program)
  }
  if (US_FEAT_SEARCH) {
    const { registerSearchCommand } = await import('./commands/search.js')
    registerSearchCommand(program)
  }
  if (US_FEAT_NODE) {
    const { registerNodeCommand } = await import('./commands/node.js')
    registerNodeCommand(program)
  }
  if (US_FEAT_MEMORY) {
    const { registerMemoryCommand } = await import('./commands/memory.js')
    registerMemoryCommand(program)
  }

  await program.parseAsync()
}

main().catch((err) => {
  // Commander throws with .code === 'commander.helpDisplayed' for --help
  // and similar benign exits. Let those pass through silently.
  if (err?.code?.startsWith?.('commander.')) return
  console.error(err)
  process.exit(1)
})
