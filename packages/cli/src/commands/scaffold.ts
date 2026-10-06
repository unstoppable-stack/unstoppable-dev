import { Command } from 'commander'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { getGenerator, PLATFORMS, FEATURES } from '../generators/index.js'
import type { Platform, Feature } from '../generators/index.js'

export interface ScaffoldCommandOptions {
  /** Restrict the published preview to the release-contract surface. */
  publicPreview?: boolean
}

export function getScaffoldCatalog(options: ScaffoldCommandOptions = {}) {
  if (!options.publicPreview) return { platforms: PLATFORMS, features: FEATURES }

  return {
    // Expo is deferred and Node CLI is a scripted validation target, not a
    // supported public-preview journey.
    platforms: PLATFORMS.filter((platform) => platform.id === 'pear-desktop'),
    // Wallet is planned, Personal Node is deferred, and multi-writer remains
    // an advanced agent-pack workflow. Keep the preview's generated surface
    // to the feature used by its one documented journey.
    features: FEATURES
      .filter((feature) => feature.id === 'local-ai')
      .map((feature) => ({ ...feature, platforms: ['pear-desktop'] as Platform[] })),
  }
}

export function registerScaffoldCommand(program: Command, config: ScaffoldCommandOptions = {}) {
  const { platforms, features: availableFeatures } = getScaffoldCatalog(config)
  const scaffold = program
    .command('scaffold')
    .description('Scaffold platform-specific apps and components')

  scaffold
    .command('app')
    .description('Scaffold a new application')
    .requiredOption('-p, --platform <platform>', `Platform: ${platforms.map((p) => p.id).join(', ')}`)
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-f, --features <features>', `Comma-separated features: ${availableFeatures.map((f) => f.id).join(', ')}`, '')
    .option('-o, --output <dir>', 'Output directory (default: ./<name>)')
    .option('--force', 'Overwrite existing output directory')
    .action(async (commandOptions) => {
      const platform = commandOptions.platform as Platform
      if (!platforms.find((p) => p.id === platform)) {
        const knownButExcluded = PLATFORMS.some((p) => p.id === platform)
        const reason = knownButExcluded && config.publicPreview
          ? 'is outside the public-preview scope'
          : 'is unknown'
        output({ success: false, error: `Platform "${platform}" ${reason}. Available: ${platforms.map((p) => p.id).join(', ')}` })
        process.exit(1)
      }

      const features: Feature[] = commandOptions.features
        ? commandOptions.features.split(',').map((f: string) => f.trim()).filter(Boolean)
        : []

      for (const f of features) {
        const featureDef = availableFeatures.find((fd) => fd.id === f)
        if (!featureDef) {
          const knownButExcluded = FEATURES.some((fd) => fd.id === f)
          const reason = knownButExcluded && config.publicPreview
            ? 'is outside the public-preview scope'
            : 'is unknown'
          output({ success: false, error: `Feature "${f}" ${reason}. Available: ${availableFeatures.map((fd) => fd.id).join(', ')}` })
          process.exit(1)
        }
        if (!featureDef.platforms.includes(platform)) {
          output({ success: false, error: `Feature "${f}" is not available for platform "${platform}"` })
          process.exit(1)
        }
      }

      // node-sync registers a single Hyperbee core with the Unstoppable Node.
      // An Autobee view is a derived index that gets truncated and re-applied
      // during ordinary merges, so seeding it is not equivalent — the Node
      // would need every writer's core instead. Untested, so refuse rather
      // than emit something that looks wired up but is not.
      if (features.includes('multi-writer') && features.includes('node-sync')) {
        output({
          success: false,
          error: 'Features "multi-writer" and "node-sync" cannot be combined yet — ' +
            'Node registration of an Autobee mesh is not implemented. Pick one.',
        })
        process.exit(1)
      }

      const projectName = commandOptions.name
      const outputDir = commandOptions.output || join(process.cwd(), projectName)

      if (existsSync(outputDir) && !commandOptions.force) {
        output({ success: false, error: `Directory "${outputDir}" already exists (use --force to overwrite)` })
        process.exit(1)
      }

      try {
        const generator = getGenerator(platform)
        const files = generator({ projectName, platform, features })

        for (const file of files) {
          const fullPath = join(outputDir, file.path)
          await mkdir(dirname(fullPath), { recursive: true })
          if (file.encoding === 'base64') {
            await writeFile(fullPath, Buffer.from(file.content, 'base64'))
          } else {
            await writeFile(fullPath, file.content)
          }
        }

        output({
          success: true,
          projectName,
          projectPath: outputDir,
          platform,
          features,
          filesCreated: files.map((f) => f.path),
          nextSteps: getNextSteps(platform),
        })
      } catch (err: any) {
        output({ success: false, error: err.message })
        process.exit(1)
      }
    })

  scaffold
    .command('list-platforms')
    .description('List available platforms')
    .action(() => output(platforms))

  scaffold
    .command('list-features')
    .description('List available features and platform compatibility')
    .action(() => output(availableFeatures))
}

function output(data: any) {
  console.log(JSON.stringify(data, null, 2))
}

function getNextSteps(platform: Platform): string[] {
  const steps = ['npm install']
  switch (platform) {
    case 'node-cli':
      steps.push('npm run dev')
      break
    case 'pear-desktop':
      steps.push('npm run dev')
      break
    case 'expo-mobile':
      steps.push('npm run ios  # or: npm run android')
      break
  }
  return steps
}
