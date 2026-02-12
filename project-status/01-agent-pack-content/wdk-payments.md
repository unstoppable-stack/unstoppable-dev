# WDK (Payments) — Content Status

**0 battle-tested, 0 docs-only, 6 not covered** out of 6 items.

The least validated part of the stack. All content is theoretical.

---

## Core Wallet Operations

| Item | Status | Notes |
|------|--------|-------|
| Wallet creation | Not validated | API from docs |
| Wallet recovery | Not validated | Seed phrase or device linking? |
| Balance query (USDt/BTC) | Not validated | — |
| Send payment | Not validated | — |
| Receive payment | Not validated | — |
| Transaction history | Not validated | — |

---

## Payment Flows

| Item | Status |
|------|--------|
| Simple send/receive | Not validated |
| Payment request (invoice) | Not covered |
| Payment verification | Not covered |
| Payment over P2P | Not covered |
| Recurring payments | Not covered |
| Micropayments | Not covered |

---

## Integration Patterns

| Item | Status |
|------|--------|
| WDK in Pear Desktop (worker) | Not covered |
| WDK in Pear Terminal | Not covered |
| WDK in Expo Bare (mobile) | Not covered |
| WDK + P2P (pay a peer) | Not covered |
| WDK + QVAC (pay for inference) | Not covered |

---

## Next Up

| # | Task | Effort |
|---|------|--------|
| 1 | Get WDK SDK documentation and test basic wallet creation | Medium |
| 2 | Build "Coffee Assistant with Payments" — extend existing app | Large |

**Blocked:** Depends on WDK SDK maturity and documentation availability.

Low priority until mobile and core capabilities are solid.

---

## Reference

- `packages/agent-pack/src/modules/wdk.md` — Current (theoretical) docs
- `packages/agent-pack/src/skills/wallet-integration/` — Skill (not validated)
- Roadmap suggestion: extend coffee-assistant-ui with payments
