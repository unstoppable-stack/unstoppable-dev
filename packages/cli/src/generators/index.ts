import type { Generator, Platform } from './types.js'
import { generateNodeCli } from './node-cli.js'
import { generatePearDesktop } from './pear-desktop.js'
import { generateExpoMobile } from './expo-mobile.js'

export { type Platform, type Feature, type GeneratorOptions, type GeneratedFile, PLATFORMS, FEATURES } from './types.js'

const generators: Record<Platform, Generator> = {
  'node-cli': generateNodeCli,
  'pear-desktop': generatePearDesktop,
  'expo-mobile': generateExpoMobile,
}

export function getGenerator(platform: Platform): Generator {
  const gen = generators[platform]
  if (!gen) throw new Error(`Unknown platform: ${platform}`)
  return gen
}
