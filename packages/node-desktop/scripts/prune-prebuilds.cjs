'use strict'

const fs = require('node:fs')
const path = require('node:path')

function findPrebuildDirectories (rootPath) {
  const found = []

  function walk (directory) {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const fullPath = path.join(directory, entry.name)
      if (entry.name === 'prebuilds') {
        found.push(fullPath)
        continue
      }
      // Native dependencies bundled inside generated workers are managed by
      // their parent package. Avoid walking arbitrary nested dependency trees.
      if (entry.name !== 'node_modules' || directory === rootPath) walk(fullPath)
    }
  }

  walk(rootPath)
  return found
}

function pruneForeignPrebuilds (buildPath, platform, arch) {
  const nodeModules = path.join(buildPath, 'node_modules')
  const target = `${platform}-${arch}`
  const result = { directories: 0, kept: 0, removed: 0 }

  for (const prebuildsPath of findPrebuildDirectories(nodeModules)) {
    result.directories += 1
    const entries = fs.readdirSync(prebuildsPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
    const targetEntries = entries.filter((entry) => entry.name.startsWith(target))

    if (targetEntries.length === 0) {
      fs.rmSync(prebuildsPath, { recursive: true, force: true })
      result.removed += entries.length
      continue
    }

    for (const entry of entries) {
      if (entry.name.startsWith(target)) {
        result.kept += 1
        continue
      }
      fs.rmSync(path.join(prebuildsPath, entry.name), { recursive: true, force: true })
      result.removed += 1
    }
  }

  return result
}

module.exports = { findPrebuildDirectories, pruneForeignPrebuilds }
