# Reference Apps

Curated upstream applications added as **git submodules**. These are the ground truth for battle-tested patterns used in the Unstoppable Stack agent pack.

## Apps

| App | Description | Platform | Key Patterns |
|-----|-------------|----------|--------------|
| [qvac-workbench-desktop](https://github.com/tetherto/qvac-app-workbench-desktop) | QVAC AI workbench for Pear Desktop | Desktop (Pear) | Worker pattern, NDJSON IPC, streaming chat, tool calling, vision, transcription |
| [qvac-workbench-mobile](https://github.com/tetherto/qvac-app-workbench-mobile) | QVAC AI workbench for Expo Bare | Mobile (Expo) | Bare worklet, model management, mobile AI inference |
| [qvac-health](https://github.com/tetherto/qvac-health) | Health app with local AI | Mobile (Expo) | RAG, embeddings, health data, Drizzle ORM |

## Usage

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>

# If already cloned, initialize submodules
git submodule update --init --recursive

# Pull latest changes from all reference apps
git submodule update --remote --merge
```

## For AI Agents

When updating agent pack documentation:

1. **Check for upstream changes**: `git submodule update --remote` then review diffs
2. **Analyze commits**: `cd reference-apps/<app> && git log --oneline -20` to see recent changes
3. **Cross-reference patterns**: Compare implementations across apps for consistent patterns
4. **Update agent pack**: Port validated patterns to `packages/agent-pack/src/`
