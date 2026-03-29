# lectio — documentation index

**Version:** 1.0  
**Last Updated:** 2026-03-28

---

## documents

| # | document | description |
|---|---|---|
| 01 | [PRD](./01_PRD.md) | Full product requirements — all phases, business rules, edge cases, success metrics |
| 02 | [Phase Breakdown](./02_PHASE_BREAKDOWN.md) | 7-phase delivery plan with deliverables, exit criteria, and effort estimates |
| 03 | [Technical Architecture](./03_TECHNICAL_ARCHITECTURE.md) | System diagram, monorepo structure, tech decisions, data flows, deployment |
| 04 | [Database Schema](./04_DATABASE_SCHEMA.md) | Full DDL, RLS policies, indexes, seed expectations, design rationale |
| 05 | [API Contracts](./05_API_CONTRACTS.md) | All endpoints, request/response shapes, error codes, auth rules |
| 06 | [Design System](./06_DESIGN_SYSTEM.md) | Colour palette, typography, spacing, components, do's/don'ts |
| 07 | [AI Coding Standards](./07_AI_CODING_STANDARDS.md) | Code rules for all contributors (human and AI) |
| 08 | [Testing Guidelines](./08_TESTING_GUIDELINES.md) | Unit, component, hook, and E2E test standards and coverage targets |
| 09 | [Component Library](./09_COMPONENT_LIBRARY.md) | All UI components — props, states, interaction rules, Storybook stories |
| 10 | [Environment & Deployment](./10_ENVIRONMENT_AND_DEPLOYMENT.md) | Local setup, Supabase config, CI/CD, production deployment |
| 11 | [Implementation Plan](./11_IMPLEMENTATION_PLAN.md) | Step-by-step build plan — all 7 phases, task sequences, file lists, test points, exit invariants |

---

## product rules — quick reference

These 7 rules are non-negotiable. Every document, design decision, and line of code is held against them.

| # | rule |
|---|---|
| R1 | "mark day complete" may exist as a shortcut but must internally write verse-level reads — never bypasses verse_reads |
| R2 | No forced reading order — users can always read ahead or backfill |
| R3 | No gamification — no badges, streaks UI should be informational only, no celebrations |
| R4 | No pressure messaging — never "you're behind", "you missed a day", no urgency language |
| R5 | Progress is passive — the UI surfaces data; it never instructs the user |
| R6 | verse_reads is the single source of truth — all metrics are derived, never stored |
| R7 | Reading happens in jw.org — Lectio never renders Bible text inline |

---

## current phase

**Phase 1 — Foundation** (in progress)

Next phase begins only after Phase 1 exit criteria are fully met. See [Phase Breakdown](./02_PHASE_BREAKDOWN.md).

---

## key decisions log

| date | decision | rationale |
|---|---|---|
| 2026-03-28 | "mark day complete" button reinstated per product owner direction | Convenience shortcut; internally writes all verse_reads for the day range |
| 2026-03-28 | Reading happens in jw.org, not inline | Scope reduction; respects jw.org content; avoids translation licensing complexity |
| 2026-03-28 | KJV for verse data seed | Public domain; no licensing required for MVP |
| 2026-03-28 | global_order on verses (not chapter/verse composite) | Enables cross-boundary range arithmetic with a single integer comparison |
| 2026-03-28 | No derived state stored in DB | Simplicity, correctness; avoids cache invalidation bugs |

---

## version history

| version | date | notes |
|---|---|---|
| 1.0 | 2026-03-28 | Initial documentation suite |
