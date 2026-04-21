import { describe, it, expect } from 'vitest'
import { parseVersion, compareVersion } from '../commands/doctor.js'

describe('doctor / parseVersion', () => {
  it('extracts the first capture group from matching output', () => {
    expect(parseVersion('v20.19.5', /v(\d+\.\d+)/)).toBe('20.19')
  })

  it('returns the full match when there is no capture group', () => {
    expect(parseVersion('git version 2.47.0', /\d+\.\d+/)).toBe('2.47')
  })

  it('returns null when the pattern does not match', () => {
    expect(parseVersion('command not found', /v(\d+)/)).toBeNull()
  })

  it('handles multi-line binary output', () => {
    const xcrunOut = 'xcrun version 72.\nalso some other noise'
    expect(parseVersion(xcrunOut, /xcrun version (\d+)/)).toBe('72')
  })
})

describe('doctor / compareVersion', () => {
  it('passes when major > minimum', () => {
    expect(compareVersion('22.0', [20, 0])).toBe(true)
  })

  it('passes when major equals minimum and minor >= minimum', () => {
    expect(compareVersion('20.0', [20, 0])).toBe(true)
    expect(compareVersion('20.19', [20, 0])).toBe(true)
  })

  it('fails when major < minimum', () => {
    expect(compareVersion('18.20', [20, 0])).toBe(false)
  })

  it('fails when major equals and minor < minimum', () => {
    expect(compareVersion('20.0', [20, 5])).toBe(false)
  })

  it('returns true when version string is not a valid semver (benefit of doubt)', () => {
    // We prefer false negatives over false positives — if we can't read the
    // version we'd rather let the user proceed and see the real error.
    expect(compareVersion('unparsable', [20, 0])).toBe(true)
  })

  it('handles leading v prefixes', () => {
    expect(compareVersion('v20.19.5', [20, 0])).toBe(true)
    expect(compareVersion('v18.20.0', [20, 0])).toBe(false)
  })
})
