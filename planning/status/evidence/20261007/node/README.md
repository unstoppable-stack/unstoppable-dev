# Personal Node local acceptance

Implementation source: `60d57c0d65fbea841065f3ab0d8c91cf7b8cccde` (clean checkout).

The four tarballs in `artifact-manifest.json` were packed and installed together outside the repository using a fresh npm cache. Binary tarballs remain in `/tmp/us-node-artifacts-60d57c0/`; the manifest retains their checksums. This is not registry publication evidence.

The frozen packaged app passed native QVAC load, a deliberately interrupted real completion, and another real completion on the same model. `frozen-packaged-real-qvac.log` records the final output. `frozen-packaged-runtime.log` records metadata, hardened Electron fuses and resource size. The opt-in packaged test code asserts cancellation/reuse before reporting ready.

Other logs record the preceding acceptance run of the same implementation before the documentation commit. Node SDK real inference was tested separately over the paired P2P transport. The optional SDK was then removed and ordinary desktop tests repeated to verify that Bare inference works without relying on the Node SDK installation.

Platform: macOS Apple Silicon. Model: existing local Qwen3.5 0.8B Q4_K_M GGUF; no cold Node download or physical mobile device was tested. Public keys and test orders belong to disposable test instances. No credentials or production application data were used.
