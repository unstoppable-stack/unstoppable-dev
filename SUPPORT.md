# Support

The Unstoppable Stack is a developer preview. Public support is best-effort;
there is no response-time or production-availability commitment.

## Where to ask

- Reproducible bugs and documentation problems:
  [GitHub Issues](https://github.com/unstoppable-stack/unstoppable-dev/issues)
- Security vulnerabilities: follow [SECURITY.md](./SECURITY.md) and do not
  post sensitive details publicly.
- General implementation questions: use a GitHub issue only when the public
  repository and issue tracker are accessible. Include a minimal reproduction.

## Supported scope

The core preview covers assistant workspace setup and app scaffolding.
See [validation and release checks](./docs/validation.md) for acceptance gates.
Source availability is not a support claim. Personal Node, Expo Mobile,
wallets/payments, Search, Memory, Remote Coder, Flow, and the standalone Agent
are outside the core preview unless a later release record says otherwise.

When reporting a CLI or generated-app problem, include:

- operating system and architecture;
- `node --version`, package-manager version, and `us --version`;
- the exact scaffold command and generated platform/features;
- output from `us doctor -p <platform>` when applicable;
- or sanitized `us doctor -p <platform> --json` output for an attachable
  version/platform summary;
- the first relevant error and the smallest reproduction.

Remove tokens, credentials, peer secrets, wallet material, model URLs with
private query parameters, prompts, and application records before posting.
