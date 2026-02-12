# WDK (Wallet / Payments) Roadmap

## Current State

WDK is the **least validated** part of the stack. The agent pack has a
`modules/wdk.md` and `skills/wallet-integration/` but they are based on
limited documentation — no working code has been tested.

This is also the module most critical to the **subscription business model**.

---

## Core Wallet Operations

| Item | Status | Agent Pack File | Notes |
|------|--------|----------------|-------|
| Wallet creation | Not validated | modules/wdk.md | API from docs |
| Wallet recovery | Not validated | — | Seed phrase or device linking? |
| Balance query (USDt) | Not validated | modules/wdk.md | — |
| Balance query (BTC) | Not validated | — | — |
| Send payment | Not validated | modules/wdk.md | — |
| Receive payment | Not validated | modules/wdk.md | — |
| Transaction history | Not validated | — | — |
| Multi-currency support | Not covered | — | — |

## Payment Flows

| Item | Status | Notes |
|------|--------|-------|
| Simple send/receive | Not validated | — |
| Payment request (invoice) | Not covered | Request → approve → confirm |
| Payment verification | Not covered | Confirm payment was received |
| Payment over P2P | Not covered | Send payment info via Hyperswarm |
| Recurring payments | Not covered | Key for subscriptions |
| Micropayments | Not covered | Per-use pricing model |

## Integration Patterns

| Item | Status | Notes |
|------|--------|-------|
| WDK in Pear Desktop (worker) | Not covered | Wallet ops in worker, UI shows balance |
| WDK in Pear Terminal | Not covered | CLI payment flows |
| WDK in Expo Bare (mobile) | Not covered | Mobile wallet |
| WDK + P2P (pay a peer) | Not covered | Critical: pay for P2P services |
| WDK + QVAC (pay for inference) | Not covered | Critical for subscription model |

---

## Subscription Model (Future)

These items connect to the Unstoppable Subscriptions vision:

| Item | Status | Notes |
|------|--------|-------|
| Subscription payment flow | Not designed | User pays recurring USDt |
| Subscription tiers | Not designed | Free / Basic / Pro |
| Revenue share with builders | Not designed | How builders get paid |
| Payment verification for cloud services | Not designed | Prove subscription is active |
| Grace period / expiry | Not designed | What happens when subscription lapses |

---

## Priority Order

1. **Core wallet operations** — Create, send, receive, balance. The basics.
2. **Payment over P2P** — Send payment info alongside P2P data.
3. **WDK in Pear Desktop worker** — Integration pattern with the proven stack.
4. **Payment request flow** — Invoice → approve → confirm pattern.
5. **Subscription payments** — Recurring, verification, tiers.

## Suggested App

**"Coffee Assistant with Payments"** — Extend the existing coffee-assistant-ui
to accept USDt payments for orders. This validates:
- WDK wallet creation (in worker)
- Send/receive (client pays, backoffice receives)
- Payment verification over P2P
- UI for balance and transaction history

This is the lowest-effort path since the P2P infrastructure already exists.
