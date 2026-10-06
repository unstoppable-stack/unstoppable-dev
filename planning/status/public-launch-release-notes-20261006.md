# Desktop developer preview — draft release notes

Version: `@unstoppable-stack/cli@0.4.0-beta.1`. Proposed npm tag: `preview`. Unpublished; human-dependent and public-channel acceptance gates remain pending.

The tested candidate provides a working macOS Apple Silicon path from a Codex assistant workspace to a Pear Desktop app with local storage, P2P networking and real QVAC inference. The maintained Coffee Assistant adds saved coffee orders and explicit read-only order sharing. The first model download requires network access; cached inference and local data work offline.

The default CLI exposes `init`, `scaffold` and `doctor`, with Pear Desktop and `local-ai` as the preview catalog. Personal Node, mobile and payments remain outside this preview. Peer sharing exposes every saved order to anyone knowing the sharing key, and stopping sharing does not delete recipient copies.

Validated runtime source: `3ce97590ba2c85eca49917327226d77f69fa3716`. Artifact: `unstoppable-stack-cli-0.4.0-beta.1.tgz`, 245,727 bytes. SHA-256: `94afd44a4bb6b62008197785ded043547669da117d6f06869635969d6d1ff3f1`.

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

See [candidate validation](public-launch-progress-20261006.md) for real/offline inference, retry/cancel/recovery, public peer reconnect, download interruption, resource measurements and remote check results. See the [release and rollback procedure](public-launch-release-runbook.md) for publishing the tested artifact and rollback. A rollback has not been exercised against hosting.
