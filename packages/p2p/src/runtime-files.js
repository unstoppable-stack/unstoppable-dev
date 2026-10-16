import FDLock from 'fd-lock'
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

// Advisory descriptor locks release on process exit/crash. Keep the lock file:
// unlinking it would allow another process to lock a different inode.
const nativeFsModule = typeof globalThis.Bare !== 'undefined'
  ? await import('bare-fs')
  : await import('fs')
const nativeFs = nativeFsModule.default || nativeFsModule

export async function acquireStorageLock (file, { timeout = 10_000 } = {}) {
  await runtimeFs.mkdir(runtimePath.dirname(file), { recursive: true })
  const deadline = Date.now() + timeout
  for (;;) {
    const fd = await new Promise((resolve, reject) => {
      nativeFs.open(file, 'a', 0o600, (error, fd) => error ? reject(error) : resolve(fd))
    })
    const lock = new FDLock(fd)
    try {
      await lock.ready()
      return () => lock.close()
    } catch (cause) {
      if (Date.now() >= deadline) {
        const error = new Error(`Storage is already in use: ${file}`, { cause })
        error.code = 'STORAGE_LOCKED'
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
}

export async function withStorageLock (file, operation) {
  const release = await acquireStorageLock(`${file}.lock`)
  try { return await operation() } finally { await release() }
}
