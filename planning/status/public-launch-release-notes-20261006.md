# Desktop developer preview — draft release notes

Version: `@unstoppable-stack/cli@0.4.0-beta.1`. Proposed npm tag: `preview`. Unpublished; human-dependent and public-channel acceptance gates remain pending.

The tested candidate provides a working macOS Apple Silicon path from a Codex assistant workspace to a Pear Desktop app with local storage, P2P networking and real QVAC inference. The maintained Coffee Assistant adds saved coffee orders and explicit read-only order sharing. The first model download requires network access; cached inference and local data work offline.

The upgraded app uses QVAC inference 0.21.0, llama.cpp 0.55.0 and Electron 44.5.1; development tooling needs Node 22.17+. It bounds recent chat history, reports omitted older turns and asks users to shorten oversized requests. Networking includes Hypercore 11.37.2 and HyperDHT 6.34.1. The website uses Next.js 15.5.27.

The default CLI exposes `init`, `scaffold` and `doctor`, with Pear Desktop and `local-ai` as the preview catalog. Personal Node, mobile and payments remain outside this preview. Peer sharing exposes every saved order to anyone knowing the sharing key, and stopping sharing does not delete recipient copies.

Validated runtime source: `064f6066c9c7f6e7998c60cb4c86a8e281852dc3`. Artifact: `unstoppable-stack-cli-0.4.0-beta.1.tgz`, 226,743 bytes. SHA-256: `2a53e298e981a4f3f7ad1b48770506eaad3635fcf9bacd613051f4c543c4bda9`.

Install the retained artifact for review:

```bash
npm install -g ./unstoppable-stack-cli-0.4.0-beta.1.tgz
us init my-workspace --assistant codex
cd my-workspace
us scaffold app -p pear-desktop -n coffee-assistant -f local-ai
cd coffee-assistant
npm install
npm run dev
```

After registry publication is approved and verified, the intended exact-version installation is `npm install -g @unstoppable-stack/cli@0.4.0-beta.1`. Public instructions must stay on the currently published baseline until then.

See [candidate validation](public-launch-dependency-upgrade-20261006.md) for real/offline inference, retry/cancel/recovery, public peer reconnect, download interruption, resource measurements and remote check results. See the [release and rollback procedure](public-launch-release-runbook.md) for publishing the tested artifact and rollback. A rollback has not been exercised against hosting.
