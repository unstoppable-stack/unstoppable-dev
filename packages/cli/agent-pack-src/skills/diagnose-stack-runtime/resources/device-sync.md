# Diagnose physical-device sync

Use this when a real mobile/desktop pair fails to discover, reconnect or import
fresh data. Start with the existing library and app lifecycle; a failed lookup
alone does not establish a router, carrier or NAT defect.

## Identify the running artifact

Record the app target, host, installed P2P version, lockfile, worker bundle and
native dependency graph. Compare the running artifact with the tested source;
a manifest version or an edited node_modules directory is not release evidence.
P2P alpha.4 introduced initial-discovery recovery, independent concurrent-call
deadlines/cancellation, retry after a pre-pairing transport loss, pairing-refusal
cleanup and reverse-RPC batching fixes. Older artifacts may lack these fixes.
Use canonical compatibility metadata for current version selection.

Verify the existing saved identity, peer key and grants before changing pairing.
Never create a new invitation merely to hide a reconnect defect. Keep identities,
recordings, tokens and raw network addresses out of public logs and reports.
Use separate storage paths for test peers; stop the confirmed owner before a
harness reopens a desktop store. Do not kill unrelated app instances.

## Trace one request across boundaries

Capture timestamps and request IDs from both sides: app foreground/resume,
worker ready, connection attempt, transport open/close, pairing, manifest offer,
protected checkpoint and local content import. Preserve the underlying error
code alongside the user-facing result. Record the original request deadline and
whether it expired, was explicitly cancelled, or was cancelled by suspension.

A locked phone rejecting a launch, missing signing/trust, and a terminated app
are different failures. Check device launch results and crash/lifecycle logs
before diagnosing networking. A generic CANCELLED result is not proof of a
network timeout. Read the freshest report from this attempt, not the last saved
successful report. Keep attempt start and completion times distinct.

For discovery failures, inspect both peers' listen/advertisement state, outbound
attempts and inbound connections. With the root node API, initiate bounded
connections to saved approved peers on foreground startup on both devices;
listening alone may leave the returning peer waiting on a failed outbound path.
Keep startup and local reads usable while those connections are pending.
Do not add a second swarm or reset trust around managed /data or /service helpers.

Use the library's reconnect policy. An individual connect() still has its own
deadline; reconnect is not a guarantee that an application transaction completes.
Concurrent callers must not inherit an almost-expired background deadline.
If an app retries a snapshot exchange, retain one overall deadline and abort
signal, retry only classified transient failures, and replay only operations
known to be idempotent. Do not replay invitations, denied grants, malformed
content, calendar writes or other effects without an explicit idempotency design.
Never replay the same cancelled request after suspension or user cancellation;
foreground resume may start a new operation under the app's explicit sync policy.

For existing custom Protomux integrations, investigate nested reverse RPC that
stalls only when messages are batched. Awaiting a long-running callback can keep
required replies corked. Fix and regression-test the library boundary instead
of adding arbitrary delays or copying an app-specific transport workaround.

## Mobile lifecycle and native graph

Use the installed BareKit/host lifecycle contract. Serialize suspend/resume with
active work: stop admitting requests, cancel/drain operations, close or suspend
owned network/storage resources, and release IPC/event-loop references as the
host requires. Resume/reopen before accepting new work with the saved identity
and storage. Do not copy desktop lifecycle APIs into the mobile host blindly.
A running process does not prove its worker stayed active during suspension.
Keep-awake helps a foreground test; it does not defeat a manual lock, app switch
or iOS suspension and does not authorize continuous background networking.

After dependency changes, inspect the native addon graph as well as JavaScript.
Check duplicate addon versions, bundle-linked references, embedded frameworks
and the exact architecture. Rebuild the worklet after its code/dependencies
change; rebuild/reinstall the native app when its bundle or native graph changes.
For imports outside the app directory, choose a bundle base containing those
shared files. Defer only modules the host actually provides. App-specific addon
pins and bundler flags are evidence for that graph, not universal overrides.
Store durable audio/file references relative to app storage: iOS can relocate
an app data container between installs. Verify playback twice after restoring a
saved recording; a successful transcript does not prove playback works.

## Acceptance that detects the original failure

1. Establish a baseline with persistent pairing. Publish a unique note after
   each tested transition, then perform one user sync request. Check exact note
   ID/content and protected checkpoint; for audio check received bytes/hash.
   A connected icon or successful manifest exchange alone is insufficient.
2. Exercise sleep/resume and Wi-Fi → cellular → Wi-Fi (or the reverse) without
   force-closing the app. Record the same process across transitions and the
   worker lifecycle events. Require one tap per attempt; success after manual
   retries is a failed first-attempt gate. Keep every failed attempt in evidence.
3. Verify the real transport route. USB used for installation/logs can also
   provide a network interface. Radio state alone does not prove cellular use.
   Inspect the authenticated socket endpoint on both devices and distinguish
   LAN/USB from public or relay routes. Same Wi-Fi is not proof of LAN reachability.
4. Test an initially unavailable peer returning within the request's budget,
   cancellation while unavailable, and saved-peer restart without re-pairing.
   Separate a deliberately expired request followed by automatic reconnect from
   recovery within the original request; they are different acceptance claims.
5. Reopen received data with the source actually stopped. Accept a protected
   persisted checkpoint only when its content is locally verified; an unknown
   empty key or partial download is not proof of a complete offline copy.

Use a local isolated DHT to reproduce and regression-test protocol bugs. Then
check the packed/installed library and the physical devices separately. Do not
infer Android runtime support from iPhone tests or an Android build. Report
mock, isolated-network, packaged-runtime and physical/offline evidence separately.
One successful carrier route is not universal NAT/UDP-blocked-network coverage;
a relay fallback needs an explicit design and its own acceptance tests.
