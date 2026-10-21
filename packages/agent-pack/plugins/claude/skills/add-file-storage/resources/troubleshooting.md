# File Sharing — Troubleshooting

> **Legacy custom transport/storage reference only.** New apps use
> `@unstoppable-stack/p2p` through `/service`, `/rpc`, `/data` or `/sync`.
> Read the parent skill first. These snippets do not implement the library
> protocol or its pairing/grants; do not layer them around managed helpers.


## Mirror doesn't update
- Ensure the writer keeps seeding the drive (don't close the process)
- Use `drive.watch()` for live updates on the reader side

## Reads return null
- Wait for `drive.ready()` before any operations
- Confirm the drive key matches the writer's key exactly
- Ensure at least one peer connection is established

## Large files are slow
- Hyperdrive is optimized for many small files, not single large files
- For large files, consider chunking or using Hypercore directly

## Storage grows unbounded
- Hyperdrive keeps all versions; use `drive.purge()` to clean old data
- Set `{ sparse: true }` on Corestore to only download requested files
