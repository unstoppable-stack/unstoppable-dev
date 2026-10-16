import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { buildAgentPack } from '../agent-pack/index.js'
import type { AssistantId } from '../constants.js'

const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })

describe('agent-pack app integration', () => {
  for (const tool of ['claude', 'cursor', 'opencode', 'codex'] as AssistantId[]) {
    it(`${tool}: emitted guidance/skills have resolvable resources and no removed SDK setup`, async () => {
      const outputDir = await mkdtemp(join(tmpdir(), 'us-pack-test-')); directories.push(outputDir)
      const result = await buildAgentPack({ tool, template: 'blank', projectName: 'test', outputDir })
      const contents = await Promise.all(result.filesWritten.filter(f => /\.mdc?$/.test(f)).map(async path => ({ path, text: await readFile(join(outputDir, path), 'utf8') })))
      for (const { path, text } of contents) {
        expect(text, path).not.toMatch(/startQVACProvider\s*\(|delegate:\s*\{|n_discarded:\s*|filterThinkBlocks:\s*/)
        for (const match of text.matchAll(/\]\((resources\/[^)]+)\)/g)) {
          await expect(readFile(join(outputDir, path, '..', match[1]), 'utf8')).resolves.toBeTruthy()
        }
        if (path.endsWith('/SKILL.md')) {
          for (const match of text.matchAll(/\]\((\.\.\/[^)]+)\)/g)) {
            await expect(readFile(resolve(outputDir, dirname(path), match[1]), 'utf8')).resolves.toBeTruthy()
          }
        }
      }
      const root = tool === 'claude' ? 'CLAUDE.md' : tool === 'cursor' ? '.cursor/rules/project.mdc' : 'AGENTS.md'
      const instructions = await readFile(join(outputDir, root), 'utf8')
      expect(instructions).toContain('us compatibility list')
      expect(instructions).toContain('runtime-ai/index.js')
      expect(instructions).not.toContain('Get user confirmation before writing')
      expect(result.filesWritten).toContain('.unstoppable/guidance/modules/qvac.md')
    })
  }
  it('a known app without AI excludes AI skill/module guidance', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'us-pack-test-')); directories.push(outputDir)
    const result = await buildAgentPack({ tool: 'codex', template: 'blank', projectName: 'test', outputDir, platform: 'node-cli', features: [] })
    expect(result.filesWritten).not.toContain('.agents/skills/add-ai-chat/SKILL.md')
    expect(result.filesWritten).not.toContain('.unstoppable/guidance/modules/qvac.md')
    const entry = '.agents/skills/build-with-unstoppable/SKILL.md'
    expect(result.filesWritten).toContain(entry)
    const text = await readFile(join(outputDir, entry), 'utf8')
    for (const match of text.matchAll(/\]\((\.\.\/[^)]+)\)/g)) {
      await expect(readFile(resolve(outputDir, dirname(entry), match[1]), 'utf8')).resolves.toBeTruthy()
    }
  })
})
