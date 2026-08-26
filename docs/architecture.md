# FrameGuard architecture

FrameGuard has at most one committed document and one mutation authority. The browser UI and WebMCP adapter call the same `AppStore`, which delegates workspace and review operations to `ReviewAuthority`.

## Ownership

- `src/editor` defines the committed document, strict JSON import validation, canvas layouts, protected elements, cloning, and deterministic audit.
- `src/review` owns the nullable workspace lifecycle, proposals, approval selection, base-revision validation, atomic apply, rejection, and one-level undo history.
- `src/app/store.ts` is the observable production interface shared by React and WebMCP. It owns UI activity, synchronized layer/change focus, WebMCP availability, and the one-use human authorization for agent apply.
- `src/webmcp` declares exact browser tool schemas, validates all runtime inputs, and delegates every operation to the store. Review-only registrations use one generation-scoped `AbortController` per active proposal, and availability requires both static and currently required review tools to register successfully.
- `src/export` deterministically serializes the committed document and audit only. Active, rejected, and blocked proposal data is excluded from exported receipts.

## Invariants

- Logo and Legal are protected in the editor document.
- Startup has no document, layers, proposal, selection, or undo history. Explicit proposal creation or a validated import is required to load work.
- Invalid imports fail before the review authority is called, so partial documents and weakened protection never become active.
- A proposal records its base revision. Apply fails before mutation when that revision is stale.
- Blocked changes remain visible but cannot be selected or applied.
- Apply clones the committed document, performs selected allowed edits on the clone, then commits once.
- Reject never mutates an explicitly loaded document. A proposal that provisioned the demo workspace returns atomically to the unloaded state when rejected.
- Undo restores the exact prior document and is safe when history is empty.
- Tool results are returned only after the shared store has emitted the visible state update and the browser has received two animation frames to paint it.

## Boundaries

This is a browser-local WebMCP demonstration deployed as a static GitHub Pages application. It has no backend MCP server, accounts, persistence, analytics, remote export, or secret access. Reload therefore starts a new empty workspace rather than restoring transient review data.
