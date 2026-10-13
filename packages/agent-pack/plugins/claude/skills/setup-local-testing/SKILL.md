---
name: setup-local-testing
description: Run isolated local peers for Electron + Pear OTA, Node, and mobile apps.
---

# Set Up Local Testing

Give every peer a distinct application storage directory. Two processes must
never open the same Corestore path concurrently.

## Electron + Pear OTA

The current desktop scaffold accepts a custom runtime directory:

```bash
npm run dev -- --storage /tmp/my-app-peer-a
npm run dev -- --storage /tmp/my-app-peer-b
```

The Electron host passes `pear.storage` to the Bare worker through
`pear-runtime`; the worker reads it from `Bare.argv[2]`.

Workspace membership and hoisted dependencies are supported. The legacy
`pear-electron/pre` symlink and private-`node_modules` workarounds do not apply
to Pear OTA apps.

## Test layers

1. Unit-test message validation and storage logic with in-memory fixtures.
2. Spawn the Bare worker and assert `workerReady` and `init-complete`.
3. Exercise a real KV put/get round trip.
4. Launch Electron and drive the renderer with Playwright over CDP.
5. Run two peers with separate storage paths and verify replication.

Use a local DHT bootstrap only when the test specifically needs isolation from
the public DHT. Pass the bootstrap list explicitly to each Hyperswarm instance.

## Cleanup

Send an explicit shutdown command, close network and storage resources, wait
for the worker to exit, then close `pear-runtime`. Keep temporary peer data for
failed tests when it helps diagnosis; otherwise remove the exact test directory.

See [resources/full-setup.md](resources/full-setup.md) for a two-peer recipe.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
