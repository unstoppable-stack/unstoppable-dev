# Node trust and resource evidence

Report assembled 10 October 2026 on macOS Apple Silicon, Node 22.21.1 and host Bare 1.28.6. Native QVAC and headless smoke logs were captured 9 October; final regression, portable tarball and sidecar runs were captured 10 October. Baseline: a85172ba11288e7ad70433a58f5d6d3b8a317f6e, tested working tree on codex/node-trust-resource-controls.

The real inference log uses installed SDK 0.21.0 and the existing Qwen3.5-0.8B Q4_K_M model. It tests completion, cancellation/reuse and active grant revocation; it does not repeat cold download or offline acceptance. Bare demo inference is mocked; its transport and storage are real. The sidecar check runs a real Bare worker. The package manifest identifies four unpublished tarballs tested together outside the repository. Source hashes identify the tested implementation. Hosted CI evidence is linked from the PR.

Limits bound admitted capability work and buffered control data. They do not bound native CPU/RAM, raw transport allocation or retained disk blocks. Third-party handlers must cooperate with cancellation. No package publication or replacement of the frozen CLI artifact is represented here.
