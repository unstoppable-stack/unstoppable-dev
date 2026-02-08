/**
 * HyperDB Setup — Initialize a schema-driven P2P database.
 *
 * Handles: engine selection (local RocksDB vs P2P Hyperbee), ready() lifecycle, flush().
 *
 * CUSTOMIZE:
 *   1. Define your schema in spec/ and run the builder (see below)
 *   2. Import your generated definition and pass it here
 *   3. Change the engine (rocks vs bee) based on your needs
 *
 * SCHEMA SETUP (run once):
 *   1. Create spec/hyperdb/schema.js defining your collections
 *   2. Run: npx hyperdb ./spec/hyperdb
 *   3. Import the generated index: import def from './spec/hyperdb/index.js'
 */

// NOTE: You must generate this definition from your schema.
// Replace this import with your actual generated schema:
// import def from './spec/hyperdb/index.js'

/**
 * Create a local-only HyperDB instance (RocksDB engine).
 * Good for: single-device apps, fast local queries, development.
 */
export async function createLocalDB(
  storagePath: string,
  definition: any
): Promise<any> {
  // Dynamic import — HyperDB may not be installed
  const HyperDB = (await import('hyperdb')).default

  const db = HyperDB.rocks(storagePath, definition)
  // No explicit ready() needed for rocks — it's synchronous
  return db
}

/**
 * Create a P2P HyperDB instance (Hyperbee engine).
 * Good for: multi-device sync, peer-to-peer data sharing.
 *
 * IMPORTANT: The underlying Hypercore must be replicated separately
 * via Hyperswarm for P2P sync to work. Use with replication.ts.
 *
 * @param core - A Hypercore instance (from corestore or standalone)
 * @param definition - Generated schema definition
 */
export async function createP2PDB(
  core: any,
  definition: any,
  opts: { autoUpdate?: boolean } = {}
): Promise<any> {
  const HyperDB = (await import('hyperdb')).default

  const db = HyperDB.bee(core, definition, {
    autoUpdate: opts.autoUpdate ?? true,
  })
  return db
}

/**
 * Insert a document and flush to persist.
 *
 * IMPORTANT: HyperDB stages inserts in memory until flush() is called.
 * Always flush after writes, or batch multiple writes before one flush.
 */
export async function insertAndFlush(
  db: any,
  collection: string,
  doc: any
): Promise<void> {
  await db.insert(collection, doc)
  await db.flush()
}

/**
 * Query helper — find documents in a collection or index.
 * Returns an array of results.
 */
export async function queryAll(
  db: any,
  collectionOrIndex: string,
  query: any = {}
): Promise<any[]> {
  const stream = db.find(collectionOrIndex, query)
  return stream.toArray()
}
