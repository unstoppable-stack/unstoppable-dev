---
id: pear
name: Pear Runtime
category: module
requires: [bare]
tags: [runtime, desktop, p2p]
priority: high
---

# Pear Runtime

## Overview

Pear is a peer-to-peer runtime, development, and distribution platform for
desktop and terminal apps. It stages app files into a Hypercore-backed app drive
and runs them from `pear://` links; versioning and distribution happen via DHT
seeding and sparse replication.

## Version Notes

- CLI version not pinned in local sources; docs referenced from
  docs.pear.holepunch.to (2026-02-04).

## Installation

```bash
npm i -g pear
```

## Quick Start

```bash
mkdir my-pear-app
cd my-pear-app
pear init --yes
pear run --dev .
```

## Core Concepts

- Staging: `pear stage <channel>` snapshots files into app storage (Hypercore)
  and outputs a `pear://` link.
- Seeding: `pear seed <channel|link>` announces the app on the DHT so other
  peers can replicate it.
- Releases: `pear release <channel|link>` marks a release point so
  `pear run <link>` loads the latest released version.

## API Reference

- `pear init [flags] <link|name> [dir]`: scaffold a new Pear app from a
  template.
- `pear run [flags] <link|dir> [...app-args]`: run a local app or `pear://`
  link.
- `pear stage <channel|link> [dir]`: stage local changes into app storage.
- `pear seed <channel|link> [dir]`: announce and serve the staged app over the
  DHT.
- `pear release <channel|link> [dir]`: mark a release pointer for a channel.
- `pear dump <link> <dir>`: sync a `pear://` app to disk.

## Integration with Other Modules

- Pear apps are built on Bare, so P2P code can use Hyperswarm, Hypercore,
  Hyperbee, and Hyperdrive directly.
- QVAC integrates via a Pear terminal "engine" process and a Pear desktop UI,
  typically connected with `pear-run` and `pear-pipe`.

## Common Patterns

```bash
# Stage and seed a dev channel
pear stage dev
pear seed dev
```

```bash
# Release a production channel
pear stage production
pear release production
pear seed production
```

```bash
# Run a staged but unreleased version for preview
pear run --checkout=staged pear://<app-key>
```

## Pitfalls & Gotchas

- Apps are not reachable by other peers until you run `pear seed` and keep it
  running.
- `pear run` on remote peers prompts for trust; use `--no-ask` to decline
  unknown keys in automation.
- Release pointers override staged content; use `--checkout=staged` to preview
  unreleased changes.

## Resources

- https://docs.pear.holepunch.to/guide/starting-a-pear-desktop-project
- https://docs.pear.holepunch.to/guide/sharing-a-pear-app
- https://docs.pear.holepunch.to/guide/releasing-a-pear-app
- https://docs.pear.holepunch.to/reference/cli
