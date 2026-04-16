import { Command } from 'commander'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { getGenerator, PLATFORMS, FEATURES } from '../generators/index.js'
import type { Platform, Feature } from '../generators/index.js'

export function registerScaffoldCommand(program: Command) {
  const scaffold = program
    .command('scaffold')
    .description('Scaffold platform-specific apps and components')

  scaffold
    .command('app')
    .description('Scaffold a new application')
    .requiredOption('-p, --platform <platform>', `Platform: ${PLATFORMS.map((p) => p.id).join(', ')}`)
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-f, --features <features>', 'Comma-separated features: p2p, kv-storage, qvac, autobase', '')
    .option('-o, --output <dir>', 'Output directory (default: ./<name>)')
    .option('--force', 'Overwrite existing output directory')
    .action(async (options) => {
      const platform = options.platform as Platform
      if (!PLATFORMS.find((p) => p.id === platform)) {
        output({ success: false, error: `Unknown platform "${platform}". Available: ${PLATFORMS.map((p) => p.id).join(', ')}` })
        process.exit(1)
      }

      const features: Feature[] = options.features
        ? options.features.split(',').map((f: string) => f.trim()).filter(Boolean)
        : []

      for (const f of features) {
        const featureDef = FEATURES.find((fd) => fd.id === f)
        if (!featureDef) {
          output({ success: false, error: `Unknown feature "${f}". Available: ${FEATURES.map((fd) => fd.id).join(', ')}` })
          process.exit(1)
        }
        if (!featureDef.platforms.includes(platform)) {
          output({ success: false, error: `Feature "${f}" is not available for platform "${platform}"` })
          process.exit(1)
        }
      }

      const projectName = options.name
      const outputDir = options.output || join(process.cwd(), projectName)

      if (existsSync(outputDir) && !options.force) {
        output({ success: false, error: `Directory "${outputDir}" already exists (use --force to overwrite)` })
        process.exit(1)
      }

      try {
        const generator = getGenerator(platform)
        const files = generator({ projectName, platform, features })

        for (const file of files) {
          const fullPath = join(outputDir, file.path)
          await mkdir(dirname(fullPath), { recursive: true })
          await writeFile(fullPath, file.content)
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
    .action(() => output(PLATFORMS))

  scaffold
    .command('list-features')
    .description('List available features and platform compatibility')
    .action(() => output(FEATURES))
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
      steps.push('pear run -d .')
      break
    case 'expo-mobile':
      steps.push('npm run ios  # or: npm run android')
      break
  }
  return steps
}
