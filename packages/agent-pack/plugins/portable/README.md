# Unstoppable Stack plugin

Version 0.1.5, public preview. Build local-first P2P apps using maintained workflow skills, the Unstoppable CLI and per-app runtime contracts.

## CLI prerequisite

Read [the bundled CLI installation guide](skills/build-with-unstoppable/resources/install-cli.md) first. It records the candidate version, registry availability, Node requirements and pinned source install. Never assume npm latest contains this plugin's maintained-contract CLI. Plugin installation does not install app dependencies, native runtimes or model weights.

## Claude Code and Claude Desktop

After the public catalog is merged into the repository, register it:

```sh
claude plugin marketplace add unstoppable-stack/unstoppable-dev
claude plugin install unstoppable-stack@unstoppable-stack --scope user
```

For Claude Desktop use Code → Local, then start a new session in an empty test folder. User-scope Code plugins are separate from Cowork customization. Type / and select unstoppable-stack:build-with-unstoppable. For a downloaded package, load the claude folder with claude --plugin-dir /absolute/path/to/claude instead.

## Codex

```sh
codex plugin marketplace add unstoppable-stack/unstoppable-dev
codex plugin add unstoppable-stack@unstoppable-stack
```

Confirm commands with codex plugin --help. On supported desktop clients install from the configured marketplace through the plugin directory, then start a new target-workspace chat and select the discovered entry skill.

## First app and updates

Ask: Build a desktop coffee assistant with local AI and P2P order sharing. Check CLI discovery, target metadata and maintained worker/session use. Then test diagnosis and a read-only upgrade review for an existing app. Generic guidance never overrides the installed app's contract/types.

Use your harness's marketplace refresh and plugin update commands to receive a new version, then start a new session. A plugin update does not migrate app files or vendored runtime. If replacing the development install, uninstall only unstoppable-stack@unstoppable-stack-dev once the public install is enabled; retain other plugins and project instructions.

This skills-only plugin has no MCP server, automatic hooks or telemetry of its own. The selected harness handles model requests and its own telemetry. Bundled guidance is locally readable; cold app/model installation requires network access. Native inference, Stop/reuse and cached-offline acceptance are separate from build/mock checks. Experimental profiles and wallet stubs remain as recorded by the CLI.

Source and support: https://github.com/unstoppable-stack/unstoppable-dev
Official host instructions: https://code.claude.com/docs/en/desktop and https://developers.openai.com/plugins/build/plugins
