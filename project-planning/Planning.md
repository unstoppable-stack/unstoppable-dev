  

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

• apps it enables

⸻
  
**D) Cloud optional but planned)**

• Inference model hosting

• Backup for files/databases

• (Later) observability, key management, hosted relays, etc.

  
⸻




⸻
  

### **Roadmap (after POC)**  

**Phase 1: Content + docs depth**

• Fill docs for each module (copy/paste snippets + recipes)

• Add mobile platform support (Expo Bare)

• Improve CLI module selection

  
**Phase 2: Unstoppable Auth (core product)**

• Define auth model (local-first identity + recovery + device linking)

• Integrate into agent recipes

• Add website docs + examples


**Phase 3: Cloud services (monetization path)**

• Inference hosting

• Backup + sync services

• Billing + dashboard

• Optional “hosted relays” depending on your p2p model


**Phase 4: QVAC Assistant**

• Polished experience on top of the agent pack

• Tight integration with CLI and agent pack

⸻



**8) Immediate next tasks (good first tickets)**

1. **CLI skeleton**

• init command

• prompts (tool choice + modules)

• generates project + README

3. **Agent pack v0**

• “rules of the repo”

• “how to add a feature”

• 3–5 recipes for common patterns

4. **Website v0**

• landing copy + install instructions

• docs placeholder + “Showcase coming soon”


The CLI scaffolds a blank project with the agent pack configured for the chosen AI assistant. The agent pack guides the developer through building from scratch.
