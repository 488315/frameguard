# Changelog

This document records the user-visible evolution of FrameGuard. FrameGuard follows
[Semantic Versioning](https://semver.org/); dates use ISO 8601.

## [Unreleased]

## [0.3.0] - 2026-09-01

FrameGuard 0.3.0 strengthens the product around one clear boundary: agents may
propose visual work, policy constrains it, and only a human can grant the exact
one-use authority needed to commit approved changes. It also adds browser-local
draft recovery, a synchronized Layers navigator, deterministic visual-regression
gates, and substantially broader automated coverage.

### Bounded WebMCP authority

- Registers state-dependent tools only while their document, review, undo, or one-use authorization prerequisites hold.
- Removes agent-facing approval decisions and the predefined adaptation path; adds proposal inspection, pre-review revision, and non-mutating withdrawal tools.
- Replaces transient Boolean delegation with a one-use capability bound to proposal, base revision, and exact approved change IDs, with consumption recorded in committed review history.
- Exposes scoped agent-apply authorization during inspection and marks user-authored or imported tool output as untrusted.
- Adds an executable deterministic WebMCP workflow gate and a separate browser-agent evaluation protocol.
- Prevents undo from being offered while a newer proposal is active, avoiding accidental loss of in-progress review work.

The tool surface now has one responsibility per operation: inspect the committed
document, create or inspect a proposal, revise or withdraw an unreviewed proposal,
apply a human-authorized subset, undo the last committed change set, or export its
review receipt. Approval and rejection remain human-only UI actions. Agent proposal
revision preserves provisional workspace ownership, refuses after review begins,
and withdrawal leaves no committed mutation behind.

### Review workspace and Layers navigation

- Adds an accessible Layers navigator derived from authoritative review state, including protected status and unresolved-change indicators.
- Synchronizes layer selection across the navigator, desktop canvas, mobile canvas, and proposal inspector without creating a second state owner.
- Keeps selected rows visible, supports keyboard interaction and visible focus, and remains usable with long labels, narrow layouts, high display density, and reduced motion.
- Separates the blocked protected-Logo annotation from the masthead so policy evidence stays readable without obscuring the design.
- Improves desktop readability and makes the mobile before/after comparison explicitly two-up, with clearer changed-headline evidence.

### Opt-in browser-local draft recovery

- Added an explicit recovery control that keeps default startup empty and can clear saved bytes without mutating the live review.
- Reconstructs saved provisional or imported reviews through isolated production validation, with fresh IDs and rederived protection and applicability.
- Persists only bounded, versioned authority-owned proposal input, origin/document, and decisions; transient UI, WebMCP, authorization, and history state remain excluded.
- Fails closed for malformed, stale, inconsistent, oversized, partial, or protection-tampered data and visibly reports browser-storage failures.
- Attempts both payload invalidation and durable opt-out when persisting a newer active review fails, and does not report recovery disabled when storage rejects both safeguards.

Recovery is deliberately local and opt-in. Applying, rejecting, resetting, or
disabling recovery clears the saved draft. Restored input is revalidated through a
new isolated review authority before adoption; stale identifiers, policy results,
authorization, history, and transient UI state are never trusted from storage.

### Quality, accessibility, and project operations

- Adds GitHub Actions gates for formatting, linting, unit/component tests, production build, and Playwright browser workflows.
- Adds exactly three reviewed Ubuntu 24.04 Chromium baselines for the empty workspace, active side-by-side proposal, and blocked protected-Logo state.
- Adds a serious-impact accessibility violation gate and deterministic reduced-motion coverage using immediate, non-retrying checkpoints.
- Expands end-to-end coverage for synchronized Layers review, draft recovery, proposal lifecycle, bounded authorization, protected targets, receipts, and undo.
- Adds contribution guidance and structured bug/feature issue templates, and updates architecture, evaluation, product-positioning, and visual-evidence documentation.

### Verification

- 121 unit, component, state, recovery, receipt, and WebMCP tests passed.
- 2 deterministic WebMCP evaluation tests passed.
- 9 Playwright end-to-end and accessibility tests passed.
- 3 canonical Ubuntu 24.04 Chromium visual-regression comparisons passed.
- Prettier formatting, ESLint, TypeScript compilation, and the Vite production build passed.
- GitHub CI, visual regression, and GitHub Pages deployment passed for the release candidate.

### Compatibility and known limits

- FrameGuard remains a browser-local application with no server-side collaboration or account system.
- WebMCP agent tools require a compatible browser; the human review workflow remains usable when WebMCP is unavailable.
- Draft recovery is opt-in per browser and intentionally excludes authorization, history, selection, activity, and composer text.
- This release does not claim completion of external browser-agent trials or competition submission/video work.

## [0.2.0] - 2026-08-26

FrameGuard 0.2.0 turns the original visual-review prototype into a controlled,
agent-native review workspace. The release begins with an honest empty state,
accepts exact structured proposals through WebMCP, and keeps the committed design
unchanged until a human explicitly approves and applies eligible changes.

### A deliberate empty beginning

FrameGuard now opens without fabricated layers, sample artwork, or an active
proposal. The Layers rail, review workspace, proposal inspector, header controls,
and activity strip each communicate that no review is loaded while preserving the
application's editorial layout. A user can start from either a proposal request or
a validated layout import; cancelled and invalid imports leave the empty workspace
intact.

### Structured, inspectable WebMCP proposals

The `create_proposal` tool accepts a bounded proposal title and an exact list of
typed changes. FrameGuard generates proposal and change identifiers, then registers
proposal-scoped review tools whose schemas expose only the identifiers that are
currently valid. Compatibility requests continue to pass through the same central
operation registry, so UI actions and agent actions share one state authority and
one validation path.

The proposal composer mirrors that contract for human input. It provides per-field
validation, accessible focus management, clear recovery after invalid submissions,
and immediate removal of a field error once the corresponding value is corrected.
Creating or inspecting a proposal never mutates the committed document.

### Human authorization and protected design intent

Every proposed change is reviewed independently. Logo and Legal remain protected
at the document-model boundary: attempted mutations are retained as visible,
blocked review evidence but are never eligible for approval or application. Valid
changes require explicit approval, and agent-driven application additionally uses
a one-use human authorization that is consumed by the operation.

Application is atomic and revision-aware. A proposal created from an obsolete
revision fails closed rather than overwriting newer work. Applying approved changes
creates one history entry, clears the active proposal, and advances the document
revision; rejecting clears only provisional review state. Undo restores the prior
committed document without treating proposal inspection as document history.

### Review receipts and responsive production polish

Completed reviews can be exported as deterministic receipts derived from committed
state. Unapproved and blocked changes cannot leak into the exported document.
Interaction states, keyboard focus, readable utility typography, balanced desktop
and mobile previews, and the proposal drawer have been refined across laptop,
desktop, and 4K-class viewports. When WebMCP is unavailable, the interface remains
fully usable and reports the capability honestly.

### Verification

The release is covered by 64 unit, component, state, and WebMCP tests plus four
Playwright workflow tests. The complete workflow was also exercised in a real
WebMCP-enabled Chrome session: empty workspace, structured proposal creation,
blocked protected-logo mutation, individual approval, one-use authorization,
atomic apply, revision advance, and undo. Formatting, linting, TypeScript
compilation, the Vite production build, and dependency audit all pass.

## [0.1.0] - 2026-08-25

Initial public hackathon release. It established the three-column visual review
workspace, proposal-scoped WebMCP registration, protected Logo and Legal layers,
explicit approval, atomic apply and reject behavior, undo, responsive layout, and
GitHub Pages deployment.

[Unreleased]: https://github.com/488315/frameguard/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/488315/frameguard/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/488315/frameguard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/488315/frameguard/releases/tag/v0.1.0
