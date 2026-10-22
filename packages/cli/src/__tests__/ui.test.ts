// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import ts from 'typescript'
import { generatePearDesktop } from '../generators/pear-desktop.js'
import { generateExpoMobile } from '../generators/expo-mobile.js'
import { uiTokens } from '../generated/ui-theme.js'
import type { Feature } from '../generators/types.js'

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })
function desktop(features: Feature[] = [], ready = Promise.resolve()) {
  const files = Object.fromEntries(generatePearDesktop({ projectName: 'ui-check', platform: 'pear-desktop', features }).map(file => [file.path, file.content]))
  document.body.innerHTML = '<div id="app"></div>'
  const send = vi.fn()
  let receive: (message: Record<string, unknown>) => void = () => {}
  const navigation = new Function(files['app/shell.js'].replace('export function', 'function') + '\nreturn setupNavigation')()
  const script = files['app/index.js'].replace(/^import .+$/gm, '')
  new Function('sendToWorker', 'onWorkerMessage', 'workerReady', 'setupNavigation', script)(send, (handler: typeof receive) => { receive = handler }, ready, navigation)
  return { send, receive, files }
}
function click(id: string) { document.getElementById(id)!.click() }
function input(id: string, value: string) { (document.getElementById(id) as HTMLInputElement).value = value }

describe('Unstoppable UI scaffold behavior', () => {
  for (const features of [[], ['local-ai'], ['wallet', 'node-sync'], ['local-ai', 'multi-writer']] as Feature[][]) {
    it(`navigation points to existing sections and retains feature controls: ${features.join(',') || 'base'}`, () => {
      desktop(features)
      const links = [...document.querySelectorAll<HTMLAnchorElement>('.sidebar .nav-link')]
      expect(links.length).toBeGreaterThan(2)
      for (const link of links) {
        expect(document.getElementById(link.hash.slice(1)), link.hash).not.toBeNull()
        link.click()
        expect(link.getAttribute('aria-current')).toBe('location')
        expect(document.querySelectorAll('[aria-current="location"]')).toHaveLength(1)
      }
      expect(!!document.querySelector('#load-ai')).toBe(features.includes('local-ai'))
      expect(document.querySelector('#kv-save')).not.toBeNull()
    })
  }
  it('keeps real KV commands and results wired through the restyled controls', () => {
    const { send, receive } = desktop()
    input('kv-key', 'note'); input('kv-value', 'Local first')
    click('kv-save')
    expect(send).toHaveBeenLastCalledWith({ type: 'db-put', key: 'note', value: 'Local first' })
    click('kv-fetch')
    expect(send).toHaveBeenLastCalledWith({ type: 'db-get', key: 'note' })
    receive({ type: 'db-get-ok', key: 'note', value: '<b>Local first</b>' })
    expect(document.querySelector('#kv-result')!.textContent).toContain('<b>Local first</b>')
    expect(document.querySelector('#kv-result b')).toBeNull()
  })
  it('keeps the shell usable and renders worker failure as text', async () => {
    desktop([], Promise.reject(new Error('<img src=x onerror=alert(1)>')))
    await Promise.resolve()
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('<img')
    expect(document.querySelector('img')).toBeNull()
    expect(document.querySelector('.sidebar')).not.toBeNull()
    expect(document.querySelector('#worker-status')!.textContent).toBe('Worker unavailable')
  })
  it('emits syntactically valid mobile light/dark themes for base and AI variants', () => {
    for (const features of [[], ['local-ai', 'wallet', 'node-sync']] as Feature[][]) {
      const files = generateExpoMobile({ projectName: 'mobile-ui', platform: 'expo-mobile', features })
      for (const file of files.filter(file => /\.(tsx|ts)$/.test(file.path))) {
        const result = ts.transpileModule(file.content, { fileName: file.path, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } })
        expect(result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error), file.path).toEqual([])
      }
      const theme = files.find(file => file.path === 'src/theme.ts')!.content
      expect(theme).toContain(uiTokens.colors.dark.accent)
      expect(theme).toContain(uiTokens.colors.light.accent)
      const screen = files.find(file => file.path === 'app/index.tsx')!.content
      expect(screen).toContain('useColorScheme()')
      expect(screen).toContain('styles.btnOutlineText')
    }
  })
})

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
}
describe('shared palette readability', () => {
  for (const [appearance, colors] of Object.entries(uiTokens.colors)) {
    it(`${appearance}: body, secondary, and primary action text meet normal-text contrast`, () => {
      for (const [foreground, background] of [[colors.text, colors.surface], [colors.text, colors.bg], [colors.muted, colors.surface], [colors.muted, colors.sidebar], [colors.accentText, colors.accent]]) {
        const [high, low] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
        expect((high + .05) / (low + .05), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})
