// Runtime-neutral filesystem/path access. The daemon is used from both Node.js
// (CLI/tests) and Bare (Pear/Electron sidecars), whose built-in module names
// intentionally differ.
const fsModule = typeof globalThis.Bare !== 'undefined'
  ? await import('bare-fs/promises')
  : await import('fs/promises')

const pathModule = typeof globalThis.Bare !== 'undefined'
  ? await import('bare-path')
  : await import('path')

export const runtimeFs = fsModule.default || fsModule
export const runtimePath = pathModule.default || pathModule

export async function atomicWriteFile (file, data, options = {}) {
  const directory = runtimePath.dirname(file)
  const name = runtimePath.basename(file)
  const temporary = runtimePath.join(
    directory,
    `.${name}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`
  )

  await runtimeFs.mkdir(directory, { recursive: true })
  try {
    await runtimeFs.writeFile(temporary, data, { mode: 0o600, flag: 'wx', ...options })
    await runtimeFs.rename(temporary, file)
  } catch (error) {
    try { await runtimeFs.unlink(temporary) } catch {}
    throw error
  }
}
