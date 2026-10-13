# Tool calling

The basic session contract streams text only. Tools need a deliberate adapter extension with version-matched SDK schemas, tool execution policy, cancellation and history semantics. Do not silently route tool requests through a text-only session or reintroduce a separate model manager.

Official reference: https://docs.qvac.tether.io/sdk/ai-capabilities/text-generation/. Use the installed version and matching release notes.
