#!/usr/bin/env node

import { Command } from 'commander'
import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { getGenerator, PLATFORMS, FEATURES } from './generators/index.js'
import type { Platform, Feature } from './generators/index.js'

const program = new Command()

program
  .name('us')
  .description('Unstoppable Stack CLI for AI agents')
  .version('0.1.0')

program
  .command('create')
  .description('Create a new project')
  .requiredOption('-p, --platform <platform>', `Platform: ${PLATFORMS.map(p => p.id).join(', ')}`)
  .requiredOption('-n, --name <name>', 'Project name')
  .option('-f, --features <features>', 'Comma-separated features: p2p, kv-storage, qvac, autobase', '')
  .option('-o, --output <dir>', 'Output directory (default: ./<name>)')
  .action(async (options) => {
    const platform = options.platform as Platform
    if (!PLATFORMS.find(p => p.id === platform)) {
      console.error(JSON.stringify({ success: false, error: `Unknown platform "${platform}". Available: ${PLATFORMS.map(p => p.id).join(', ')}` }))
      process.exit(1)
    }

    const features: Feature[] = options.features
      ? options.features.split(',').map((f: string) => f.trim()).filter(Boolean)
      : []

    for (const f of features) {
      const featureDef = FEATURES.find(fd => fd.id === f)
      if (!featureDef) {
        console.error(JSON.stringify({ success: false, error: `Unknown feature "${f}". Available: ${FEATURES.map(fd => fd.id).join(', ')}` }))
        process.exit(1)
      }
      if (!featureDef.platforms.includes(platform)) {
        console.error(JSON.stringify({ success: false, error: `Feature "${f}" is not available for platform "${platform}"` }))
        process.exit(1)
      }
    }

    const projectName = options.name
    const outputDir = options.output || join(process.cwd(), projectName)

    if (existsSync(outputDir)) {
      console.error(JSON.stringify({ success: false, error: `Directory "${outputDir}" already exists` }))
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

      const result = {
        success: true,
        projectName,
        projectPath: outputDir,
        platform,
        features,
        filesCreated: files.map(f => f.path),
        nextSteps: getNextSteps(platform, features),
      }

      console.log(JSON.stringify(result, null, 2))
    } catch (err: any) {
      console.error(JSON.stringify({ success: false, error: err.message }))
      process.exit(1)
    }
  })

program
  .command('list-platforms')
  .description('List available platforms')
  .action(() => {
    console.log(JSON.stringify(PLATFORMS, null, 2))
  })

program
  .command('list-features')
  .description('List available features and platform compatibility')
  .action(() => {
    console.log(JSON.stringify(FEATURES, null, 2))
  })

function getNextSteps(platform: Platform, features: Feature[]): string[] {
  const steps = ['npm install']

  switch (platform) {
    case 'node-cli':
      steps.push('npm run dev')
      break
    case 'pear-desktop':
      steps.push('pear run --dev .')
      break
    case 'expo-mobile':
      steps.push('npm run ios  # or: npm run android')
      break
  }

  return steps
}

program.parse()
