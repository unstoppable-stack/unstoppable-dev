The CLI should allow users to scaffold a project with the Unstoppable stack and choose their preferred assitant (Cursor CLI, Claude Code, Open Code, etc) 

**A) CLI (project initializer)**

Responsibilities:

• scaffold templates

• install deps

• generate configs

• add “agent pack” for chosen tool

• optionally set up auth/cloud hooks ()


**B) Agent Pack (the “brains”)**

Deliverable: a repository of **portable skills/scripts + rules** that can be used in:

• Claude (instructions / tool prompts)

• Cursor (project rules / commands)

• OpenCode (skills + agents)

  
It should contain:

• Architecture guidelines (how unstoppable apps are structured)

• Module-aware generation (knows what stack modules are available)

• Recipes: auth, p2p sync, model inference, storage, etc.