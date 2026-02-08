  

**1) What you’re building (one sentence)**

A website + CLI that lets developers scaffold and “vibe-code” apps on the **Unstoppable Stack**, using a shared agent/plugin that works across **Claude**, **Cursor**, and **OpenCode**, plus optional cloud add-ons (inference hosting + backups).

⸻

**2) The Unstoppable Stack (define it as a bundle)**

**Core (v1)**

• QVAC SDK (By Tether)

• Holepunch P2P Stack (By Holepunch)

• Pear (By Holepunch)

• WDK Wallet (By Tether)

• Bare (By Holepunch)

• Expo Bare (By Holepunch)

• QVAC Agent lib (Not implemented - By us?)

• Unstoppable Auth (Not implemented - By us? )


**Coming soon**

• QVAC Assistant (first-class agent UX build by Tether?)


**Suggestion:** in docs + CLI, treat each item as a **module** with:

• what it does

• when you need it

• quick-start snippet

• pitfalls / constraints

• templates it enables

⸻
  
**D) Cloud optional but planned)**

• Inference model hosting

• Backup for files/databases

• (Later) observability, key management, hosted relays, etc.

  
⸻




⸻
  

### **Roadmap (after POC)**  

**Phase 1: Templates + docs depth**

• Add more templates (Expo Bare app, P2P sync app, inference-enabled app)

• Fill docs for each module (copy/paste snippets + recipes)

• Improve CLI module selection

  
**Phase 2: Unstoppable Auth (core product)**

• Define auth model (local-first identity + recovery + device linking)

• Integrate into templates + agent recipes

• Add website docs + examples


**Phase 3: Cloud services (monetization path)**

• Inference hosting

• Backup + sync services

• Billing + dashboard

• Optional “hosted relays” depending on your p2p model


**Phase 4: QVAC Assistant**

• Polished experience on top of the agent pack

• Tight integration with CLI and templates

⸻



**8) Immediate next tasks (good first tickets)**

1. **Define 1 POC template** (name, modules included, what it runs)

2. **CLI skeleton**

• init command

• prompts (tool choice + modules)

• generates project + README

3. **Agent pack v0**

• “rules of the repo”

• “how to add a feature”

• 3–5 recipes that match the template

4. **Website v0**

• landing copy + install instructions

• docs placeholder + “Showcase coming soon”


If you want, paste your preferred POC template idea (e.g., “Expo Bare starter with P2P + auth stub” vs “Bare + Pear minimal”), and I’ll turn this into a tighter spec with: folder layout, CLI prompts, and the exact “agent instructions” you’d ship for Claude/Cursor/OpenCode.