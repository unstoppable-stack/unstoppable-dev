# Diagnose the app boundary first

1. Read `.unstoppable/project.json` and `us compatibility check -o <app>`. Identify installed versions and whether the target is experimental.
2. Distinguish worker/IPC failure from model/addon failure. Networking/storage should remain available when a lazy AI load fails.
3. Session errors have codes: `NOT_READY`, `BUSY`, `INVALID_REQUEST`, `LOAD_FAILED`, `INFERENCE_FAILED`, `CANCEL_FAILED`, `ABORTED`, `CLOSED`. Preserve code and message across IPC.
4. Retry failed loads through the same session. Do not retry partially emitted completions automatically.
5. Stop must cancel native inference, settle the iterator, and permit a subsequent request. Suppressing tokens alone is insufficient. If cancellation fails, surface the error and do not claim recovery without a real engine check.
6. Oversized latest messages must fail without truncation; old context omission should be visible. The SDK decides actual token overflow.
7. First download requires connectivity; cached startup requires a separate network-isolated run. A lockfile/model cache from an old installation can hide missing peers.

Detailed engine issues: https://docs.qvac.tether.io/sdk/runtime/cancellation/ and https://docs.qvac.tether.io/sdk/js-ts-sdk/. Compare with installed types; current docs may target a different release.
