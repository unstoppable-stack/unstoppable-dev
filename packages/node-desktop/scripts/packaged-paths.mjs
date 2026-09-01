import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function files (directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await files(target))
    else result.push(target)
  }
  return result
}

export function normalizedPath (file) {
  return file.replaceAll('\\', '/')
}

export function findPackagedExecutable (candidates, platform) {
  return candidates.find((file) => {
    const path = normalizedPath(file)
    if (platform === 'darwin') {
      return path.endsWith('.app/Contents/MacOS/unstoppable-personal-node')
    }
    if (platform === 'win32') {
      return path.endsWith('/unstoppable-personal-node.exe') ||
        path.endsWith('/Unstoppable Personal Node.exe')
    }
    return path.endsWith('/unstoppable-personal-node')
  })
}
