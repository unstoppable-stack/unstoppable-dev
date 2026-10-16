# Coffee Assistant

A maintained first-party developer-preview example: ask a local coffee assistant and save named coffee orders on your device. It is derived from the current Pear Desktop/local-ai generator and the earlier sandbox Coffee Assistant lessons, using the current Electron/Bare worker integration rather than the legacy React/Bun application.

## Run

The proposed validation platform is macOS Apple Silicon with Node.js 22.17+ and npm. Other platforms are unverified for this example. From this directory:

```sh
npm install
npm run dev
```

Electron and the runtime are installed locally; no global Pear or Bun installation is required. Click **Load Assistant**. The first Qwen 3.5 0.8B model download is approximately 532 MB and requires networking. A previous warm generated-app run used about 1.4–1.5 GiB RSS on the validation Mac; this is not a minimum hardware guarantee. Wait for the model before sending a prompt. Stop cancels the active response; Retry handles a failed model load.

## Verify the demo

1. Ask “Suggest a mild coffee and explain why.” Confirm a streamed answer from the real model. Do not set `QVAC_MOCK=1` for demo evidence.
2. In Saved coffee orders, enter `morning` and `one oat latte`, then click Save.
3. Close and reopen the app, enter `morning`, and click Fetch. Confirm the same value.
4. After a successful model load, close the app, disconnect external networking, reopen it, and ask another question. This validates cached local inference, not offline installation.
5. Ask your coding assistant to rename the Save button to “Save order” in `app/index.js`; reopen the app and confirm the visible change.

The AI cannot place or persist an order itself. Use the saved-order controls. Local data is stored under Electron userData in its `pear` directory; an explicit `--storage` argument can select a separate test directory. Closing the app does not delete saved data.

## Scope and validation

To share orders, open a second instance with a separate storage directory, for example `npm run dev -- --storage /tmp/coffee-peer-demo`. On the first app click **Share my orders** and copy its key. On the second app enter that key and `morning`, then click **Fetch peer order**. Both apps must be reachable and online. Sharing exposes all saved orders to anyone who knows the key; there is no recipient identity approval. Share only with trusted people. Downloaded copies can remain on the recipient device after sharing ends.

A two-app acceptance test passed on 5 October using a real local DHT test network, with distinct storage directories and a unique remotely fetched order. Restart persistence and cached-model offline inference also passed. On 6 October, public Internet discovery passed after the acceptance test waited for the sender’s DHT announcement. Visible graceful disconnection and retrieval of an updated order after restart/reconnect also passed. Independent reproduction remains pending. No payment, Personal Node, cloud backup, or account flow is included. Independent reproduction, restart-persistence evidence, public-network peer discovery, and matching public video remain launch gates.

Prepared 5 October 2026 from CLI source version 0.4.0-beta.1 on an unfrozen working tree. See [validation and release checks](../../docs/validation.md) for public reproduction commands; this is not a frozen release artifact. This project is private in npm terms and is distributed as repository source.

## Troubleshooting

- Installation fails: preserve the npm error, confirm network access and Node version, then retry `npm install`; do not delete local app data.
- Worker does not become ready: inspect the launching terminal, confirm install completed, and attach the environment summary from `us doctor --json`.
- Model fails: confirm available disk space and initial-download networking; use Retry. Cached inference requires a previously successful model download.
- Saved value is missing: use the same application name and storage directory as the previous run; separate `--storage` directories have separate data.

MIT licensed; see LICENSE.

## Maintainer acceptance commands

From the repository root, after installing CLI development dependencies:

```sh
node scripts/coffee-example-e2e.mjs
COFFEE_TEST_PUBLIC_DHT=1 node scripts/coffee-example-e2e.mjs
```

The first command uses a real isolated local DHT network and real app instances; it does not establish Internet reachability. The second uses public discovery; both paths passed retrieval, graceful disconnect, persistence and retrieval of a new value after reconnect on 6 October. Both use separate temporary storage directories and clean up their test data. `COFFEE_P2P_BOOTSTRAP` is an optional test-only bootstrap override, passed from Electron to the worker; normal app launches use the public DHT.

QVAC inference 0.21.0 reads configuration through its native dynamic loader; the old global require adapter is removed. For an isolated model cache, set `QVAC_CONFIG_PATH` to a JSON configuration with an absolute `cacheDirectory`. The maintainer-only `node scripts/qvac-download-e2e.mjs` test uses a disposable cache, interrupts a real transfer, verifies the recovered model’s SHA-256 and runs inference again under network isolation. It never deletes the user’s existing model cache.

The selected GGUF model is [Unsloth Qwen 3.5 0.8B](https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF), labeled Apache-2.0 by its publisher, with the [upstream Qwen license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE). The repository does not bundle model weights; the app downloads the pinned model on first use.

Context uses bounded recent history, not the removed `n_discarded` setting. Earlier turns can be omitted from inference with visible feedback. An oversized latest request is rejected with an instruction to shorten it. This does not remove displayed conversation history or saved orders.

## Maintained runtime migration — 10 October 2026

The worker now uses the shared AI session implementation vendored in `.unstoppable/runtime-ai/`. Its compatibility profile, model identity and runtime version are recorded in `.unstoppable/project.json`; `us compatibility check -o examples/coffee-assistant` reports differences without editing files. Coffee prompts, order storage and peer-sharing logic remain app-owned.

After this migration, the two-app local-DHT test passed remote retrieval, visible disconnection, full restart persistence and retrieval of the updated order after reconnect. Native model streaming, Stop/reuse, failed-load retry, context-limit recovery and cached network-isolated inference passed on a newly generated desktop app using this same runtime and the example’s existing native dependency graph. This does not establish fresh installation, public-DHT revalidation, another operating system, or cold/interrupted-download acceptance for the new runtime. These are historical maintainer results, not a fresh-checkout certification. See [validation and release checks](../../docs/validation.md) for public commands and remaining gates.
