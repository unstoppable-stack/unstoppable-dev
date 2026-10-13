---
name: scaffold-project
description: Create a new supported Unstoppable app target with the installed CLI, preserving existing apps and their profiles.
---

# Scaffold a new target

`us init <workspace>` configures an assistant workspace. `us scaffold app` creates an executable target. Inspect `us scaffold list-platforms` and `us scaffold list-features` first; the public preview and internal build have different catalogs.

```bash
us scaffold app -p <platform> -n <name> -f <features> -o <new-directory>
```

Inspect JSON success output and generated README/scripts. The app records platform, features, generator/profile/runtime versions, model identity, expected dependency declarations and validation maturity in `.unstoppable/project.json`. Native compatibility is not implied by successful generation/install.

Desktop/Node local AI includes a vendored, maintained session at `.unstoppable/runtime-ai/`; prompts/UI belong in app code. Read entrypoints before extending managers. Expo remains a separate experimental native profile, wallet a stub and Personal Node deferred.

For existing apps, run `us compatibility list -o <workspace>` and `us compatibility check -o <app>` to inspect profiles and upgrade differences. Preserve edited files and migrate deliberately; do not re-scaffold an edited app with `--force` as an upgrade. Use installed types and version-matched docs for advanced APIs, not copied dependency tables.

Install/run the generated target’s scripts and validate the actual changed behavior before extending it. Cache/offline/native claims require their own runtime checks.

## Bundled integration references

For app ownership and runtime boundaries, load only the relevant [foundation](../unstoppable-foundations/SKILL.md), [module](../unstoppable-modules/SKILL.md), or [recipe](../unstoppable-recipes/SKILL.md) reference. Bundled links resolve from this skill; app paths resolve from the selected target.
