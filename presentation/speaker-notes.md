# Speaker Notes

Detailed talking points for each slide. Use these to prepare — don't read
them verbatim.

---

## Slide 1: Title
- Keep it simple. Let the subtitle do the work.
- "This is about making our developer tools actually usable."

## Slide 2: It Started with My Mom
- This is the emotional hook. Take your time here.
- Paint the picture: she's running a yoga studio in Chile, she's got a
  notebook with names and payments, she's calling people to remind them.
- "I thought — I'm a developer, I should be able to help her."
- Don't rush to the technical part. Let the audience connect with the problem.

## Slide 3: The Power of Vibe-Coding
- Explain vibe-coding briefly if the audience isn't familiar: "You describe
  what you want in natural language, the AI writes the code."
- Emphasize speed: "Not perfect, not production-ready, but functional."
- The insight: "Claude has gotten incredibly good at building apps."

## Slide 4: A Finance App
- Quick slide. The point is: once you see the pattern, ideas flow.
- Mention the 0.00002 BTC — it's funny and relatable.
- "Two apps in days. That's when I started thinking bigger."

## Slide 5: El Salvador — The Pillars
- Reference the specific Tether presentation about stable pillars.
- This connects your personal project to the company's mission.
- "People need stability. And stability comes from tools they control."
- Key phrase: "free, private, unstoppable"

## Slide 6: The Pillars — As Apps
- This is the vision slide. Don't get bogged down in details.
- The point: each pillar can be an app, and they all use our stack.
- "Imagine if every person had a private health tracker, a personal AI,
  a self-custodial wallet, and a way to find their community — all on
  their phone, all controlled by them."

## Slide 7: AI Already Wins — For Centralized Apps
- This is where you acknowledge the competition. Be honest, not defensive.
- "Let me show you what the world looks like right now. If I open Claude
  or Cursor and say 'build me a SaaS dashboard with auth and payments'
  — it does it in minutes. Perfect. React, Next.js, Stripe, Postgres.
  The AI knows all of it."
- "Centralized development has never been easier. And it's getting easier
  every month."
- Let that sink in. This is the context for the next slide.

## Slide 8: Our Stack Gets Left Behind
- Now the contrast. This should feel urgent.
- "But ask that same AI to build with our stack — Holepunch, QVAC, Pear —
  and it falls apart. The AI puts P2P modules in the browser. It uses
  Node.js APIs that don't exist in Bare. It guesses package versions."
- "I spent hours debugging the same setup issues that the AI kept
  recreating. And this is me — I work here. Imagine a random developer
  trying this for the first time."
- The punchline: "If the AI can't build with it, developers won't use it."

## Slide 9: The Existential Risk
- This is the alarm bell slide. For the CEO, this is the business case.
- "This isn't just annoying for developers. It's an existential risk."
- Walk through the table: "AI is accelerating centralized development.
  Every day it gets better at React and Next.js. And every day, the gap
  between 'easy to build centralized' and 'hard to build with us' widens."
- "If we don't solve this, AI will make our stack irrelevant. Not because
  it's bad technology — because nobody can use it."
- Pause. Then transition: "But there's a flip side."

## Slide 9b: The Opportunity — Flip the Advantage
- This is the hope slide. The energy should shift from alarm to excitement.
- "If we solve the AI knowledge problem — and that's what the Unstoppable
  Stack does — our stack actually has a structural advantage."
- Walk through the table comparison slowly.
- Hit hard on: "No servers. No monthly AWS bill. No DevOps. No infra.
  The app just runs on the user's device."
- "With centralized, you vibe-code the app in minutes but then you need
  servers, deployment, monitoring, billing... With the Unstoppable Stack,
  you vibe-code the app and you're done. There's nothing to maintain."
- "And for users who want more power — cloud AI, backup, always-on files —
  that's where subscriptions come in. But the base app costs the developer
  nothing to run."
- "We don't just catch up. We surpass centralized."

## Slide 10: The Solution
- Keep the architecture simple. Three boxes.
- "The CLI gives you the project. The Agent Pack gives the AI the knowledge.
  The website gives developers the community."

## Slide 11: The CLI
- If doing a live demo, this is a good moment.
- Show how fast it is: 10 seconds to a scaffolded project.
- "You pick your AI tool, you pick a template, and you're ready to go."

## Slide 12: The Agent Pack
- This is the core innovation. Spend time here.
- "This is not documentation. This is a structured knowledge base designed
  to be consumed by AI assistants."
- Emphasize the numbers: 12 modules, 10 skills, 17 recipes.
- "It works with Claude, Cursor, and OpenCode. You use what you prefer."

## Slide 13: Knowledge Acquisition
- Walk through the loop slowly.
- "We don't write knowledge from docs. We build real apps, hit real bugs,
  and extract working patterns."
- "If the AI can build the same app using only the agent pack — the
  knowledge is validated."

## Slide 14: The Validation Loop in Practice
- Tell the story of the two Coffee Assistant apps.
- "First version was CLI — two terminal apps. We found issues with bare-rpc
  and QVAC."
- "Second version was desktop with React UIs. That's where we found 6
  critical bugs in our knowledge."
- List the bugs briefly — they show you did the work.

## Slide 15: From 6 Bugs to 0 Bugs
- This is the money slide. Let the numbers speak.
- "50+ prompts to 2 prompts. Hours to minutes. This is the power of
  having the right knowledge in the right format."
- If you have time: "I can show you — right now — building the same app
  in 2 prompts."

## Slide 16: What's in the Agent Pack (Detail)
- Only go deep here if the audience is technical.
- For PM/CEO: hit the highlights and move on.
- Key point: "Everything is battle-tested. We don't ship theoretical docs."

## Slide 17: Multi-Tool Support
- Brief slide. The point: we're not locked to one AI tool.
- "Developers have preferences. We support all of them."

## Slide 18: The Website
- Brief. "This is the public face. Where developers discover us."
- Mention it's built and deployed (if it is by then).

## Slide 19: Roadmap
- Show that you have a plan, not just a prototype.
- "We've validated about half the stack. Five more apps will cover the rest."
- Each app is designed to test specific modules.

## Slide 20: The Bigger Picture — Today
- Come back to the simple story.
- "Today it's hard. With this tool, it's easy."
- "This is how we go from 'our stack is cool but nobody uses it' to
  'everyone builds with the unstoppable stack.'"
- Transition: "But I haven't told you the most exciting part yet."

## Slide 21: The Vision — Beyond the Toolchain
- This is the pivot moment. The energy should go up here.
- "What I've shown you so far is Phase 1. The toolchain. That's the
  foundation. But the real vision is much bigger."
- Three phases, quick. Don't explain yet — just set up the next slides.

## Slide 22: Unstoppable Auth
- Identity is the bridge between "developer tool" and "platform."
- "Right now, P2P apps have no identity system. Every developer builds
  their own, or they just skip it. That's not sustainable."
- "Unstoppable Auth gives users a single identity across all apps built
  with the stack. One keypair, multiple devices, no passwords, no
  centralized auth server."
- For technical audience: "It's keypair-based. The private key lives on
  the device. Device linking uses a challenge protocol. No seed phrases."
- For CEO: "Think of it as Apple ID for the unstoppable ecosystem."

## Slide 23: Unstoppable Subscriptions
- This is the business model slide. Take your time.
- "P2P apps are amazing but they have limits. Your phone can run a 3B
  model, but not a 70B model. Your files are only available when your
  laptop is open. Your data lives on one device."
- "Subscriptions remove those limits."
- "Users who want more — better AI, always-online files, cloud backup —
  they subscribe. And they pay in USDt."

## Slide 24: Zero Infrastructure for Builders
- THIS is the slide that will light up the room.
- "Here's the part that changes everything: the app builder never
  touches a server."
- "They build the app with `npx create-unstoppable-app`. They publish
  it. Users download it. Some users subscribe. Tether handles the
  infrastructure — inference, storage, seeding. And the builder gets
  a revenue share."
- "No AWS. No billing dashboard. No DevOps. Just build the app."
- Let that sink in. Pause.
- "This means a solo developer in Chile, or Nigeria, or Indonesia can
  build an app that earns money without any infrastructure costs."
- Connect to the pillars: "That's financial stability through creation."

## Slide 25: The Flywheel
- Quick visual slide. Walk through the loop.
- "Better tools → more developers → more apps → more users → more
  subscribers → more revenue → fund better tools. And every payment
  goes through USDt."
- "This is a self-reinforcing loop. And the Unstoppable Stack is the
  entry point."

## Slide 26: The Full Stack Vision
- This is the "zoom out" moment. Show the full picture.
- Don't read every row. Hit the key insight:
- "From the foundation (Holepunch P2P, QVAC AI, WDK payments) up to
  the apps that people use every day — it's all connected. And it's
  all powered by Tether technology."

## Slide 27: Why This Matters for Tether
- Now speak business. Be confident.
- For PM: "Developer adoption is the leading indicator. If developers
  build with our stack, users follow."
- For CEO: "Recurring revenue from subscriptions. Every payment in USDt.
  A developer ecosystem that grows itself."
- "No one else is doing this. There's no AI-native P2P toolkit with a
  built-in business model for app builders. We'd be first."

## Slide 28: The Ask
- Be specific and reasonable.
- "I'm not asking for a big team or a huge budget. I'm asking for
  support to keep building. Five more reference apps to validate the
  stack. Collaboration with Holepunch on docs. And a green light to
  launch publicly."
- "The subscription model is Phase 3. But we need Phase 1 and 2 solid
  first. The foundation has to work before we build on it."

## Slide 29: One More Thing
- If you can do a live demo, do it here. It's the strongest closer.
- Scaffold → open in Cursor → type one prompt → watch the app build.
- "That's the unstoppable stack."

---

## General Tips

- **For PM audience**: Emphasize the developer adoption angle and the
  competitive advantage. They care about "why will people use our tools?"
- **For CEO audience**: Emphasize the vision (pillars of society as apps),
  the business case (ecosystem growth), and the AI shift.
- **For both**: The personal story is your strongest asset. You're not
  presenting a feature request — you're telling the story of how you
  found a problem and built a solution.
- **Keep slides visual**: The outline above has a lot of text. For the
  actual deck, use minimal text on slides and let your voice tell the story.
- **Demo > slides**: If you can show the CLI + vibe-coding live, that's
  worth more than 10 slides.
