import type { GeneratedFile, GeneratorOptions } from './types.js'
import { dataExampleSource } from '../generated/data-example.js'

/** Managed data is opt-in; do not silently migrate an app's existing store. */
export function sharedDataFiles(opts: GeneratorOptions): GeneratedFile[] {
  if (opts.platform === 'expo-mobile') return [] // Native worklet graph remains unvalidated.
  const modulePath = opts.platform === 'node-cli' ? 'src/shared-data.ts' : 'shared-data.js'
  return [
    {
      path: modulePath,
      content: `// Use in Node or the desktop worker, never the renderer.\n// Each dataset/device needs its own storage directory.\nexport { openCollection, openCollaborativeDatabase } from '@unstoppable-stack/p2p/data'\n`,
    },
    { path: 'examples/share-data.mjs', content: dataExampleSource },
    {
      path: 'SHARED-DATA.md',
      content: `# Share JSON data between apps

The managed API owns storage, discovery, replication and cleanup. This is an
opt-in dataset; it does not migrate or automatically share the app's existing
Hyperbee/Autobee store. Keep private state in its existing separate directory.

\`\`\`js
import { openCollection } from './${modulePath.replace(/\.ts$/, '.js')}'
const notes = await openCollection({ storage: './shared-notes' })
await notes.put('welcome', { text: 'Hello!' })
// Open locally even offline. Before sharing with another device:
await notes.network.ready()
console.log({ key: notes.key, version: notes.version })
// At app shutdown: await notes.close()
\`\`\`

On another device, open with its own storage directory and the shared key,
then call \`sync({ version })\` before reading. A key grants reading, not writing.
Reopening with the same directory remembers the dataset. Keep the writer running
until the reader confirms downloading. Timeout diagnostics distinguish unreachable
DHT nodes, missing peers and missing data. Public discovery requires UDP access.

## Run on two devices

From this generated app's directory, Device A runs:

\`\`\`sh
npm run share-data -- mirror-host ./shared-writer
\`\`\`

Device B replaces KEY and VERSION with Device A's SHARE output:

\`\`\`sh
npm run share-data -- mirror-read ./shared-reader KEY VERSION
\`\`\`

The host stays running; Ctrl+C closes safely and keeps local data. The reader
prints DOWNLOADED only after retaining the requested version locally.

## Collaborative data (experimental)

Install the optional engine on both devices:

\`\`\`sh
npm install autobase@7.28.2
# Device A:
npm run share-data -- db-host ./shared-alice
# Device B, using A's DATABASE key:
npm run share-data -- db-join ./shared-bob KEY
\`\`\`

Verify B's WRITER key, then paste it into A's terminal to approve writing.
Wait for OBSERVED on A before closing. In your app use
\`openCollaborativeDatabase\` from the same module, then
\`members.add(writerKey)\`, \`put\`, \`get\` and \`del\`. The founder alone manages
writers. Concurrent replacements use Autobase order, not text merging or
wall-clock ordering. Stable progress can depend on the founder/indexer.

Desktop code belongs in the worker and reaches the renderer through the existing
IPC bridge. The standalone example above runs in Node; it does not validate a
packaged desktop app or a native/mobile runtime. The schema-driven multi-writer
scaffold remains a separate experimental implementation, not a compatible
on-disk format. Do not point these helpers at its existing storage directory.

See https://unstoppable-stack.dev/docs/p2p/sync and
https://unstoppable-stack.dev/docs/p2p/database for the complete API and limits.
`,
    },
  ]
}
