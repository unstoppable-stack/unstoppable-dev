# Developer preview release procedure

Prepared 5 October 2026. Publication remains gated by the candidate checklist.

## Validate before publication

1. Assign a release owner and support triage owner. Review the intended release diff, including previously uncommitted work; freeze the selected changes in a clean candidate commit. Do not include unrelated planning or private material simply to obtain a clean tree.
2. Run CLI type checking, tests, minimal build, agent-pack drift comparison, and website lint/type/build checks. Record skips separately.
3. On macOS Apple Silicon, run `RUN_REAL_QVAC=1 RUN_OFFLINE_QVAC=1 TARBALL_DIR=/tmp/us-preview-artifacts bash scripts/release-smoke.sh`. This installs the packed CLI in an isolated prefix, generates and installs the app, then tests its actual worker/storage/UI boundary, real inference, error recovery, cancellation, and network-isolated cached-model restart. Retain the output and `artifact-manifest.json`. The runner requires the repository's development test tools; it is not an independent newcomer pilot.
4. Record cold first-run download timing, interrupted download/retry, disk consumption, and observed memory. The warm cached-model run does not supply those results.
5. Repeat on a clean machine and complete the independent pilot. Validate maintained-example restart persistence and observable peer interaction. Attach evidence to the same commit and artifact checksums.
6. Verify final tarball README/LICENSE and dependency contents. Select an explicit prerelease tag such as `preview`; never publish this prerelease to `latest` by default.

## Publish and verify

The core preview publishes the CLI only; deferred Node packages are not prerequisites. Before publishing, verify npm credentials, package ownership, intended version/tag, public repository access, issue intake, and private security reporting. Publish the tested tarball, not a newly rebuilt folder, using an explicit tag. Confirm registry version/tag and integrity match the retained artifact. Switch website instructions to that exact version only after availability is confirmed.

From an anonymous clean environment, copy the public installation and workspace/scaffold commands verbatim; confirm app startup, real inference, example access, support entry point, and exact CLI version. Announce only after this passes. Record the website deployment identifier and candidate commit.

## Incident and rollback

Retain the previous working website deployment identifier before deployment. If installation or runtime regresses, pause announcement and restore that deployment; ensure its instructions point to a previously verified package version. For an already published broken npm version, deprecate it with a concrete recovery instruction and publish a corrected version under the preview tag. Do not overwrite npm versions or downgrade user data automatically. Record the affected version, symptom, mitigation, owner, and retest result in release notes. Exercise the hosting rollback in a preview environment before claiming it is verified.
