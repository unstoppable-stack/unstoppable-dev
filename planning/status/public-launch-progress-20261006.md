# Technical launch progress — 6 October 2026

Human-dependent pilots, ownership, clean second-machine access and account administration are intentionally pending at the user's request.

## Gates advanced

- **Public peer discovery:** passed. All three public bootstrap nodes replied to diagnostic pings. The sender now reports completion of its DHT announcement; the test waits for that before the recipient discovers it. The previous timeout was reproduced before this correction.
- **Disconnect/reconnect:** local and public DHT tests passed visible graceful disconnection, saved-order persistence after sender restart, and retrieval of a newly updated order after reconnect. Reads wait for the remote replication handshake and update, preventing an old downloaded copy from being reported as a fresh peer fetch.
- **Cold model download:** used a separate initially empty QVAC model cache. The pinned 532,517,120-byte GGUF reached model-ready in 16.122 seconds; full process-tree RSS was 1,716.6 MiB on this Mac. SHA-256 matched `bd258782e35f7f458f8aced1adc053e6e92e89bc735ba3be89d38a06121dc517`. The older harness labeled this measurement “warm”; the cache was actually empty and the harness now distinguishes cold runs explicitly.
- **Interrupted download:** killed the test app during an actual transfer after 1,179,648 bytes. Restarting with the same isolated cache recovered the complete model, matched its checksum and completed real inference in 12.639 seconds to model-ready. The recovered model completed another prompt after a network-isolated restart. Temporary test caches are removed; user model caches are untouched.
- **SDK configuration repair:** QVAC 0.15.0's Bare loader called an unavailable CommonJS `require` from an ESM worker. The generator and example now supply `bare-module.createRequire` using the current module record as referrer, which preserves its loader and filesystem protocol. A loader created without the referrer could not access external JSON config files; this was also reproduced and corrected. Both source/bundled desktop guidance document the tested adapter.
- **CI alignment:** added a public-preview workflow testing packed CLI installation through the generated desktop UI on macOS arm64, with explicit mock versus opt-in real-model settings and retained evidence. Deferred/full-profile generators run under explicitly experimental lanes and use the full build. YAML and actionlint validation pass; remote CI execution is not yet claimed.

## Validation boundaries

These results are implementation evidence on the current Mac. They do not substitute for an independent pilot or another clean machine. Public-DHT acceptance uses two distinct app/storage instances on this machine; cross-device Internet/NAT reachability is not a universal support guarantee. The disconnect case uses graceful app/worker shutdown; abrupt network loss may take longer to detect.

The selected [GGUF publisher page](https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF) labels the model Apache-2.0; the [upstream Qwen license](https://huggingface.co/Qwen/Qwen3.5-0.8B/blob/main/LICENSE) is linked for attribution. The toolkit does not redistribute weights in its npm tarball or repository.

## Candidate validation

A dedicated managed worktree is being used to freeze only the desktop-preview changes without moving or cleaning the user's original checkout. Candidate commit, final artifact checksums and fresh artifact-run results will be recorded after its validation completes.
