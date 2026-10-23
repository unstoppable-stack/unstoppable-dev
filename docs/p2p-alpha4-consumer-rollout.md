# P2P alpha.4 consumer rollout review

Reviewed 23 October 2026 after publication of `@unstoppable-stack/p2p@0.6.0-alpha.4`.
This records which distribution layers still need updates. Publishing the
library alone does not update generated projects or packaged workers.

| Consumer | Evidence inspected | Required next step |
| --- | --- | --- |
| Published CLI beta.4 | Registry tarball embeds alpha.3 desktop/Node pins and alpha.3 minimum ranges for sync features | Publish a new CLI after validating the alpha.4 source profiles and updated guidance; prerelease ranges and existing locks do not prove the resolved version |
| CLI source on main | P2P release PR #33 advanced canonical profiles to alpha.4 | Preserve those profiles; include this guidance in the next CLI artifact |
| Agent plugins | Source plugin version is 0.1.10; this review adds diagnosis/upgrade guidance and regenerates both host bundles | Version and distribute a new plugin preview, then update installed plugins; changing source bundles is not a marketplace or installed-plugin release |
| Inspected local Personal Node macOS package | Embedded P2P metadata says alpha.3; its connection implementation differs from the published alpha.4 implementation | Rebuild with the verified alpha.4 dependency, inspect the packaged worker, run packaged/installer acceptance, then distribute a new desktop artifact |
| Apps tested with the local Notes candidate | Running library contained the tested fixes, but both desktop/mobile manifests and locks still selected registry alpha.3 | Replace temporary candidate installs with published alpha.4, update locks, verify installed code and rebuild affected bundles; retain pairing and local data |
| Existing generated apps | Updating CLI/plugin does not rewrite their dependencies or vendored runtime | Use read-only compatibility inspection, migrate deliberately, rebuild and test the actual app |

The inspected desktop package is a local artifact, not evidence that every
previous installer or OTA channel contains the same bytes. Inspect each artifact
being distributed. A source dependency range or local file dependency does not
establish which version a packaged app actually contains.

## Guidance captured

The canonical diagnosis resource now covers failure timelines, locked-device
launch failures, suspension versus network cancellation, actual socket routes
(including USB networking), independent connection deadlines, bounded idempotent
snapshot retries, saved-peer recovery, native addon/bundle inspection and durable
file paths. Networking, sync, testing, mobile and upgrade skills route to it.

Acceptance requires a unique note published after each transition, a fresh
report with exact content/checkpoint verification, unchanged process/identity
where required, and one user attempt per check. Source tests, installed archives,
native builds and physical cross-network behavior remain separate claims.

## Mobile scaffold follow-up

The current experimental Expo generator does not emit a coordinated
suspend/resume handler. The tested Notes implementation owns this lifecycle in
its app worklet. A library dependency bump does not transfer that behavior into
all generated mobile apps. Port a host-version-matched lifecycle implementation
with cancellation, storage/network cleanup and resume ordering, then validate
it on physical iOS and Android before expanding the scaffold's acceptance claim.
Do not copy app-specific addon pins or bundle flags into every profile without
validating the complete native graph.

## Release boundary

This review changes guidance, not published CLI/plugin/app versions. No desktop
installer, OTA release or phone reinstall is performed by this change. P2P alpha.4
is already published under `alpha`; preserve the existing `latest` tag. Follow
[canonical release preparation](public-release.md) for the next CLI/plugin release
and the desktop's own release/installer gates for packaged applications.
