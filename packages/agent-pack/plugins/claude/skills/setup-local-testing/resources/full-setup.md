# Two-peer Pear OTA test

Run two Electron instances from the same installed project with different
storage directories:

```bash
npm run dev -- --storage /tmp/my-app-peer-a
npm run dev -- --storage /tmp/my-app-peer-b
```

No source copy or `node_modules` symlink is needed. Each `--storage` directory
contains that instance's Pear OTA state and application Corestore.

For automation, launch Electron with a unique remote-debugging port per peer,
connect Playwright to both CDP endpoints, and assert a write in peer A appears
in peer B. Always terminate the Electron process group and close the Bare
worker after the assertion.

When using a local DHT bootstrap, start it first and configure both workers with
the same bootstrap address. Do not assume public-DHT connectivity in CI.
