import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writePublicDistribution } from './build-plugin.mjs'
const root = fileURLToPath(new URL('../', import.meta.url))
writePublicDistribution({ check: true })
const version = JSON.parse(readFileSync(join(root, 'package.json'))).version
const output = join(root, 'dist', 'release')
mkdirSync(output, { recursive: true })
const archives = []
for (const [host, directory] of Object.entries({ codex: 'portable', claude: 'claude' })) {
  const name = `unstoppable-stack-${host}-${version}.zip`
  execFileSync('python3', ['-c', `import pathlib,sys,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_DEFLATED) as archive:
 for path in sorted(root.rglob('*')):
  if path.is_file():
   info=zipfile.ZipInfo(path.relative_to(root).as_posix(), (2026,1,1,0,0,0))
   info.compress_type=zipfile.ZIP_DEFLATED
   info.external_attr=0o100644 << 16
   archive.writestr(info,path.read_bytes())
`, join(root, 'plugins', directory), join(output, name)])
  const bytes = readFileSync(join(output, name))
  archives.push({ name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
writeFileSync(join(output, 'checksums.json'), JSON.stringify({ version, archives }, null, 2) + '\n')
console.log(JSON.stringify({ version, archives }, null, 2))
