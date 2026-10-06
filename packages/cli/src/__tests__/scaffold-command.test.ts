import { describe, expect, it } from 'vitest'
import { getScaffoldCatalog } from '../commands/scaffold.js'

describe('scaffold release catalog', () => {
  it('limits the public preview to the documented Pear Desktop local-AI journey', () => {
    const catalog = getScaffoldCatalog({ publicPreview: true })

    expect(catalog.platforms.map(({ id }) => id)).toEqual(['pear-desktop'])
    expect(catalog.features.map(({ id }) => id)).toEqual(['local-ai'])
    expect(catalog.features[0]?.platforms).toEqual(['pear-desktop'])
  })

  it('retains experimental and validation targets in full internal builds', () => {
    const catalog = getScaffoldCatalog()

    expect(catalog.platforms.map(({ id }) => id)).toEqual([
      'pear-desktop',
      'expo-mobile',
      'node-cli',
    ])
    expect(catalog.features.map(({ id }) => id)).toEqual([
      'local-ai',
      'wallet',
      'node-sync',
      'node-host',
      'multi-writer',
    ])
  })
})
