# Changelog

This document records the user-visible evolution of FrameGuard. FrameGuard follows
[Semantic Versioning](https://semver.org/); dates use ISO 8601.

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

[0.2.0]: https://github.com/488315/frameguard/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/488315/frameguard/releases/tag/v0.1.0
