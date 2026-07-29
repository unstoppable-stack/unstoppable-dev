# Personal Node Product Review

> Date: 2026-07-29
> Scope: Node daemon, desktop control panel, app SDK, and generated desktop/mobile experiences

## Product decision

Present the Node as a **Personal Node**: an optional home for an app's protected
data and private compute. Apps must remain useful offline and on-device when it
is unavailable. “P2P,” “Hypercore,” “replication,” keys, topics, and provider
configuration belong in developer docs or expandable advanced controls.

The primary user promises are:

1. **Works on this device first.** Saving and reading do not wait for a Node.
2. **Protection resumes automatically.** A temporary disconnect is a state, not
   a setup failure or a reason to lose work.
3. **Every app asks permission.** Access is limited to what the app requests.
4. **Apps cannot see each other.** Status, storage, and inspection are app-scoped.
5. **Private AI is explicit.** Users turn it on, and each app needs an AI grant.

## Recommended end-user journey

### First app on the same computer

1. The app works locally immediately.
2. It looks for the Personal Node in the background.
3. The desktop shows “Allow this app?” with plain-language access requests.
4. After approval, the app shows “Protected — background replication is active.”
5. If the Node stops, the app shows “Protection paused — reconnecting” while
   local reads and writes continue.

### Remote inference

1. The Personal Node owner turns on a real local model.
2. The app requests `ai.completion.stream` and the user allows it.
3. The app shows preparing, streaming, unavailable, timeout, and cancelled as
   distinct states.
4. The caller may cancel with `AbortSignal`; the SDK stops delivering tokens.

The mock provider must always be labelled **Developer demo**. It must never look
like a real privacy-preserving model to a regular user.

### Phone or second computer

This is not an end-user-ready workflow today. Default discovery is derived from
the local user and hostname, so it intentionally finds processes on the same
computer. Shipping cross-device sync requires QR or short-code linking,
authenticated topic/key exchange, device naming, removal, recovery, and clear
network reachability feedback. Generated mobile UI now says that remote linking
must be configured instead of claiming that any nearby Node will be found.

## Changes made from this review

- Bound each active app session to the secure transport connection so messages
  cannot borrow another app's grants. Stable installation IDs remain deferred.
- Enforced least-privilege grants across registration, status, storage,
  inspection, heartbeat, and AI.
- Scoped app status and storage data and restricted inspection to owned keys.
- Added frame limits, inference cancellation/timeouts, pending-request cleanup,
  SDK TypeScript declarations, and automatic reconnect states in generators.
- Reworked the desktop hierarchy around Home, Storage, AI, and Advanced;
  translated capability prompts and app state into user language; accepted
  storage limits such as `5 GB`; and labelled JSON export accurately as settings
  export rather than data backup.

## Required before broad non-technical release

1. **Cross-device linking:** QR/code flow with authenticated key exchange and a
   distinct installation ID; never use a globally shared discovery topic.
2. **Real backup and restore:** encrypted payload archives or scoped resource
   restore, recovery testing, and an explicit keep/delete choice when removing
   an app. Current JSON export contains settings and metadata only.
3. **AI resource controls:** queueing, concurrency/rate limits, model download
   progress, memory/disk checks, and a verified cancel path into the provider.
4. **Sync confidence:** per-app progress, last successful protection time, and
   actionable degraded states backed by real replication telemetry.
5. **Accessible onboarding:** keyboard/focus audit, screen-reader labels, empty
   states, and user testing with people who have never used P2P software.

## API direction

Keep the Node schema-blind. Apps own their data schemas and file layouts; the
Node owns availability, replication, policy, bounded diagnostics, and optional
compute. Preserve the small SDK helpers while evolving the wire protocol toward
a versioned capability request/response envelope. Management operations—global
config, trust registry, all-app status, export/import, and destructive cleanup—
must remain local dashboard or administrative surfaces.
