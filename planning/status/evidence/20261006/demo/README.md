# Frozen Coffee Assistant walkthrough

Candidate: `3ce97590ba2c85eca49917327226d77f69fa3716` (draft PR #7).

[Two-minute walkthrough](coffee-assistant-walkthrough.mp4) is a 126-second slideshow of genuine, unmodified app screenshots with optional subtitle captions. It is a screenshot walkthrough, not a continuous recording or an independent pilot. The model output is real; no response was reconstructed. All test storage was disposable.

1. `01-start.png`: worker ready after app launch.
2. `02-real-inference.png`: pinned QVAC model answers a coffee request.
3. `03-order-saved.png`: an oat latte order saved in local Hyperbee storage.
4. `04-sharing-ready.png`: the sharing key has been announced on the public DHT. Anyone with this key can read all saved orders; downloaded copies persist.
5. `05-peer-retrieval.png`: another instance with separate storage retrieves the unique saved order.
6. `06-restart-persistence.png`: the sender restarts and fetches its saved record.
7. `07-reconnected-updated-order.png`: the recipient fetches the newly updated value after reconnect rather than receiving an old cache value.

Peer images come from a separate automated run with generated unique test values. The two instances ran on the same Mac. They prove public discovery and actual peer replication for that test, not universal cross-device NAT reachability. See `../frozen-public-peer.log` for graceful disconnect/reconnect acceptance and `../frozen-download-recovery.log` for separately verified network-isolated model operation.

This is a maintained project example, not a community deployment or a payment application. Capture tooling connects to the actual Electron pages via Playwright/CDP. No UI mock mode was used for the AI frames.
