# FrameGuard architecture

FrameGuard has one committed document and one mutation authority. The browser UI and WebMCP adapter call the same `AppStore`, which delegates review operations to `ReviewAuthority`.

## Ownership

- `src/editor` defines the committed document, canvas layouts, protected elements, cloning, and deterministic audit.
- `src/review` owns proposals, approval selection, base-revision validation, atomic apply, rejection, and one-level undo history.
- `src/app/store.ts` is the observable production interface shared by React and WebMCP. It owns UI activity, WebMCP availability, and the one-use human authorization for agent apply.
- `src/webmcp` declares exact browser tool schemas, validates all runtime inputs, and delegates every operation to the store. Review-only registrations use one generation-scoped `AbortController` per active proposal, and availability requires both static and currently required review tools to register successfully.
- `src/export` deterministically serializes current review state. The optional UI download stays in the browser and performs no external transmission.

## Invariants

- Logo and Legal are protected in the editor document.
- A proposal records its base revision. Apply fails before mutation when that revision is stale.
- Blocked changes remain visible but cannot be selected or applied.
- Apply clones the committed document, performs selected allowed edits on the clone, then commits once.
- Reject never mutates the committed document.
- Undo restores the exact prior document and is safe when history is empty.
- Tool results are returned only after the shared store has emitted the visible state update and the browser has received two animation frames to paint it.

## Boundaries

This is a local WebMCP demonstration. It has no backend MCP server, accounts, persistence, analytics, remote export, deployment, or secret access.
