# Speaker Notes — Short Deck (15 slides, ~8 min)

## Slide 1 — Title (15s)

"Hey everyone, I'm Simon. I want to share something I've been working on that I think could be a big deal for adoption of our technology stack."

---

## Slide 2 — Vibe-Coding Has Changed Everything (~45s)

"So like many of you probably, I've been using AI to build apps. The speed is just unreal. I built a yoga studio app for my mom in Chile — class management, attendance, payments — in hours, not weeks. A personal finance app that tracks expenses and Bitcoin. These are real apps, real users. And the reason this works so well is that AI assistants are incredibly good at building centralized apps. React, Next.js, Postgres — you describe what you want and you get working code."

---

## Slide 3 — But Not With Our Stack (~60s)

"Then I tried building with Holepunch and QVAC. The same AI that builds React apps flawlessly just... falls apart."

"On the P2P side — the AI doesn't even know which libraries to pick. Holepunch has dozens of modules, and the AI can't figure out the simplest path for a given use case. It doesn't understand that Bare is not Node.js — it uses Node APIs that simply don't exist. It can't set up a Pear Desktop app correctly — the worker process, React, TypeScript, the build pipeline — it gets all of that wrong. And it guesses package versions that don't exist."

"On the AI side — same story. It doesn't know how to handle context overflow when conversations get long. Streaming is done wrong — chunks get dropped, UI breaks. Think tags from reasoning models leak raw into the user interface. And we haven't even tried vision, transcription, text-to-speech... each of those would be another round of trial and error."

"And this is the thing that really got me thinking: if developers can vibe-code any app with a regular stack but can't with ours — they simply won't adopt our technologies. It doesn't matter how good the tech is."

---

## Slide 4 — The Adoption Risk (~30s)

"Look at this comparison. On the left, centralized — AI builds it effortlessly, working app in minutes. On the right, our stack — constant errors, hours of debugging. And our stack has real structural advantages — no servers, no infra costs, private by default. But none of that matters if AI can't help developers use it. And every day AI gets better at centralized. The gap is widening."

---

## Slide 5 — The Idea (~15s)

"So I asked: what if we could teach AI how to use our stack correctly? A structured knowledge base, battle-tested against real apps, that any AI assistant can pick up and use. That's the Unstoppable Stack."

---

## Slide 6 — How I Proved It Works: CLI (~50s)

"I built the same app — Coffee Assistant — multiple times. Let me walk you through it."

"The CLI version: two P2P terminal apps with AI. Hyperswarm, bare-rpc, QVAC, Hyperbee. It took me three attempts before I got a working app. First try — complete failure, AI couldn't even set up P2P correctly. Second try — partial, got stuck on RPC and streaming. Third try — finally working, but after dozens of prompts and heavy debugging."

"After I finally got it working, I asked the AI to go through the code and identify modules that could be reused across other apps. That extraction became the first seed of the knowledge base."

"At this point I realized: if it's this hard for me, no other developer is even going to try."

---

## Slide 7 — How I Proved It Works: Desktop (~50s)

"So I decided to rebuild the same app as a Pear Desktop app with React UI."

"First attempt at the desktop version — setting up Pear was extremely difficult. I had to point the AI at the QVAC Workbench app just to get the project structure right. Most developers won't have a reference app to copy from. The silver lining: the AI could reuse the P2P logic from the CLI — that knowledge carried over. But this time I had a much better process. I documented every single fix as I went, extracting patterns systematically into the agent pack."

"Second attempt — and this is the important one. Fresh project. Agent pack loaded. One prompt to plan. One prompt to confirm. Fully working app. Decent React UI. Zero debugging. It felt like magic."

---

## Slide 8 — The Result (~20s)

"The numbers tell the story. Without the Unstoppable Stack: 5 attempts — 3 CLI tries plus a painful desktop setup — dozens of prompts each, constant debugging. With the Unstoppable Stack: 2 prompts. Plan and confirm. Working app with a real UI. That's the difference between 'this stack is too hard' and 'this is the easiest way to build a P2P app.'"

---

## Slide 9 — How the Knowledge Is Built (~40s)

"This isn't documentation generated from documentation. Every pattern comes from a real app that actually works. The process is: build a real app, hit bugs, document every fix, extract it into the agent pack. Then scaffold a fresh project, try to vibe-code the same app. If it works first try — knowledge validated. If not — fix the gaps and repeat."

"Right now the agent pack has 12 module docs, 10 skills, 18 recipes, 8 reusable components. All with pinned verified package versions. Real error messages mapped to real fixes. And it works across Claude Code, Cursor, and OpenCode."

---

## Slide 10 — Coverage (~30s)

"We track every capability across four categories. Platform, QVAC, P2P, and WDK. Today we're at 39% battle-tested. After 7 more reference apps — each targeting specific gaps — we project hitting 81%. Same build-extract-validate loop."

---

## Slide 11 — Unstoppable Vault (~45s)

"Now for the opportunity. The Unstoppable Vault is a desktop app that syncs with any app built with our stack. Three services: data sync for Hyperbees and HyperDBs, file sync for Hyperdrives, and — this is the exciting one — an AI provider. Your desktop runs a 7B model. Your phone app delegates inference to it over P2P. If the Vault is offline, the phone falls back to its own smaller model automatically. This is already built into QVAC — startQVACProvider on one side, loadModel with delegate on the other."

---

## Slide 12 — Vault → Cloud (~30s)

"And here's the key insight. The Vault and the Cloud use the exact same protocol. Your Vault is free — your desktop, your GPU, your storage. The Cloud is a subscription — Tether-hosted, H100 GPUs, 70B+ models, always on. The app code is identical. You literally just swap a topic and a key. Users start free with their Vault, upgrade to Cloud naturally when they need more power."

---

## Slide 13 — Business Model (~30s)

"The business model is clean. Developers pay zero for infrastructure — they just build the app. Users pay in USDt for Cloud services. Developers get revenue share. More apps built with our stack means more users, which means more USDt flowing through WDK. Every subscription payment goes through our wallet."

---

## Slide 14 — Phases (~20s)

"Phase 1 — the toolchain — is done. The CLI, agent pack, and website work today. Phase 2 is the Vault — designed and ready to build. Phase 3 is local-first Auth across apps. Phase 4 is the Cloud and subscriptions. Each phase unlocks the next."

---

## Slide 15 — The Vision (~40s)

"This is where it all comes together. Imagine a factory of apps — each one built by independent developers using our toolchain. Coffee apps, chat apps, note-taking, voice — whatever they want. Every app has Holepunch P2P, QVAC AI, and WDK Wallet baked in. They deploy to Pear, or the App Store, or the Play Store."

"Users download these apps and connect to their personal Unstoppable Vault — free, running on their desktop, backing up their data, seeding their files, running AI inference. When they need more power — bigger models, always-on storage — they upgrade to the Unstoppable Cloud. Same identity through Unstoppable Auth. Same protocol. Just more horsepower."

"Subscriptions flow in USDt through WDK. Builders get revenue share. The more apps built with our stack, the more users, the more USDt flows. Everyone wins."

---

## Slide 16 — The Ask (~20s)

"What I'm looking for: continue building 7 reference apps to get to 81% coverage. Build the Vault — it bridges directly to Cloud and validates 7 stack gaps at once. Collaborate with Holepunch on docs and Auth. And launch the public beta at unstoppable.dev."

---

## Slide 17 — Demo / Closing (~15s)

"Let me show you. One prompt to plan, one prompt to build."

[Run npx create-unstoppable-app live or show video]

"That's the unstoppable stack. Questions?"

---

## Total Time: ~9–10 minutes

## Anticipated Questions

**Q: Why not just improve the official docs?**
A: Docs tell you what an API does. The agent pack teaches AI how to combine them into working apps — with verified versions, error mappings, and code patterns. They're complementary. The best outcome would be for this to feed back into official docs too.

**Q: What if AI models improve and learn this on their own?**
A: They will — if people build with our stack. That's a chicken-and-egg problem. The agent pack kickstarts adoption so training data exists. Plus, AI training always lags by months. The agent pack provides day-one accuracy.

**Q: How is this different from just writing good prompts?**
A: A good prompt helps once. The agent pack helps every developer, every time, automatically. It's infrastructure, not a workaround.

**Q: Why focus on the Vault instead of going straight to Cloud?**
A: The Vault validates the exact protocols the Cloud will use, but without needing hosting infrastructure. It also gives users an immediate free option, which drives adoption.

**Q: What about WDK — you have 0% coverage?**
A: That's intentional for now. WDK gets validated when we build payments into the Vault/Cloud flow. It's a Phase 4 item but the integration surface is well understood.
