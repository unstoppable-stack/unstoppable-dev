# Local Goods — ecommerce example

A first-party desktop developer-preview example with a searchable product catalog, persistent cart, local demo checkout, order lookup, a QVAC shopping assistant, and trusted peer order retrieval. Electron renders the UI; a Bare worker owns Hyperbee storage, Hyperswarm networking, and inference. The app derives from the former Coffee Assistant example and uses the maintained desktop AI runtime.

## Run

macOS Apple Silicon with Node.js 22.17+ and npm is the maintainer validation platform. Other platforms remain unverified. From this directory:

```sh
npm install
npm run dev
```

No global Pear or Bun installation is required. Browse products and use the cart without loading AI or connecting a peer. Prices are illustrative USD values. Checkout records a **demo order only**: there is no payment, tax, shipping, inventory reservation, merchant acceptance, or fulfillment integration.

## Try the shopping flow

1. Search for a product or category. Add the Everyday Daypack and Field Notebook; the total should be $80.00 USD.
2. Change quantities or remove an item. Close the app and reopen it to confirm the cart persists.
3. Enter an order reference such as `order-001`, then choose **Save demo order**. The worker calculates prices from the catalog and atomically saves the order and clears the cart. Existing references cannot be overwritten.
4. Choose **Look up order**, then restart and look it up again. The receipt contains items, quantities, prices, total, timestamp, and its demo status.
5. Click **Load Assistant** and ask “What would you recommend for a commute under $80?” The assistant has the catalog in its system prompt. It gives advice; cart changes and checkout require the visible controls.
6. Once a model has downloaded successfully, restart with external networking disconnected. Catalog, cart, order lookup, and cached inference should remain usable. Offline installation is not supported.

The Qwen 3.5 0.8B model requires an approximately 532 MB first download. A historical warm runtime run used about 1.4–1.5 GiB RSS on the validation Mac; this is not a minimum hardware guarantee. Stop cancels a response; Retry retries a failed load. Recent history is bounded, with visible feedback when earlier messages are omitted. Oversized requests must be shortened.

## Trusted peer demo

Run a second instance with separate storage:

```sh
npm run dev -- --storage /tmp/ecommerce-peer-demo
```

On the first app choose **Share store data** and copy the key. On the second app enter it and the saved order reference, then choose **Fetch peer order**. Both peers must be reachable and online. The app replicates the remote core before reading and waits for a live connection, so a cached receipt is not presented as a fresh fetch.

Sharing exposes the **entire database, including the cart and all orders**, to anyone who knows the key. There is no recipient identity approval. Recipients can retain downloaded copies. Use demo data only. This is a single-writer retrieval example, not multi-writer commerce or a secure customer order service.

Local data lives in Electron userData under `pear`; `--storage` selects a separate directory. The app name changed from `coffee-assistant` to `ecommerce-assistant`, so the default data directory also changes. Old data is left in place. No migration or deletion is performed.

## Validation

From the repository root, after installing CLI development dependencies and this example's dependencies:

```sh
node --test examples/ecommerce-assistant/test/*.test.js
node scripts/ecommerce-example-e2e.mjs
ECOMMERCE_TEST_PUBLIC_DHT=1 node scripts/ecommerce-example-e2e.mjs
```

The desktop test uses real Electron/Bare instances, temporary storage, and an isolated real local DHT by default. It exercises catalog checkout, totals, order retrieval, restart persistence, disconnect, and retrieval of a new order after reconnect. The public-DHT variant is a separate Internet-reachability check. Neither test loads a model. Use `node scripts/ecommerce-demo.mjs` for a real-model screenshot run; do not set `QVAC_MOCK=1` as native inference evidence.

The predecessor's runtime passed historical maintainer checks for native inference, cancellation/reuse, retry, and cached offline inference. On 16 October 2026, the ecommerce example passed the isolated local-DHT desktop test (including cart and order restart persistence, duplicate-reference rejection, and reconnect retrieval). A real QVAC run recommended the catalog’s Everyday Daypack for carrying a laptop and completed demo checkout; that run also announced a sharing key on the public DHT. This is not public peer retrieval acceptance. Fresh installation, broader shopping-response evaluation, offline inference restart, public peer retrieval, independent reproduction, other operating systems, and packaged distribution remain separate gates. See [validation and release checks](../../docs/validation.md).

The AI session is vendored in `.unstoppable/runtime-ai/`; app prompts, catalog, checkout, and peer retrieval remain app-owned. `us compatibility check -o examples/ecommerce-assistant` proposes differences without editing the app. Never use forced regeneration to upgrade an edited app.

## Troubleshooting

- Install fails: preserve the npm error and check Node version and network access before retrying. Do not delete app data.
- Worker fails: inspect the launching terminal and attach the environment summary from `us doctor --json`.
- Model fails: check disk space and initial-download connectivity, then use Retry. Cached inference needs a previously successful download.
- Missing cart or order: confirm the application name and storage directory match the previous run.
- Peer unavailable: confirm both apps are online, sharing is announced, and the key/reference are correct.

The [selected GGUF](https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF) is labeled Apache-2.0 by its publisher; see the [upstream model license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE). Model weights are downloaded on first use, not bundled. `scripts/qvac-download-e2e.mjs` remains the separate cold/interrupted-download and isolated-cache acceptance check.

MIT licensed; see LICENSE.
