# Dependency upgrade evidence

Final immutable source: `064f6066c9c7f6e7998c60cb4c86a8e281852dc3`.
`artifact-manifest.json` and `hosted-real-artifact-manifest.json` identify the same final tarball. `installed-release-real-offline.log` is final local acceptance; `hosted-real.log` is final hosted acceptance.

The `preceding-*` identities/logs and other intermediate logs retain the initial upgrade experiments. `us-upgrade-frozen-artifact.log` records the missing helper failure and is superseded. `us-upgrade-final-artifact.log` predates permission normalization; its payload bytes match the corrected preceding artifact but archive file modes differ. Historical hosted mock identity is from the earlier PR merge checkout. See the acceptance report for scope and limitations. No log or artifact authorizes publication.
