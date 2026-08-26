# FrameGuard architecture

FrameGuard has at most one committed document and one mutation authority. The browser UI and WebMCP adapter call the same `AppStore`, which delegates workspace and review operations to `ReviewAuthority`.

## Ownership

- `src/editor` defines the committed document, strict JSON import validation, canvas layouts, protected elements, cloning, and deterministic audit.
- `src/review/models.ts` defines the typed proposal, operation, decision, and finalized-review contracts.
- `src/review/operations.ts` is the single operation registry. It owns valid target/operation combinations, display metadata, value validation, before-value derivation, protection checks, preview, and apply behavior.
- `src/review/review.ts` owns the nullable workspace lifecycle, proposal creation, approval selection, base-revision validation, atomic apply, rejection, finalized history, and one-level document undo.
- `src/app/store.ts` is the observable production interface shared by React and WebMCP. It owns UI activity, synchronized layer/change focus, WebMCP availability, and the one-use human authorization for agent apply.
- `src/webmcp` declares exact browser tool schemas, validates all runtime inputs, and delegates every operation to the store. Review-only registrations use one generation-scoped `AbortController` per active proposal, and availability requires both static and currently required review tools to register successfully.
- `src/export` deterministically serializes the committed document, audit, and finalized review history. The active draft proposal is excluded.

## State flow

```text
composer or create_proposal input
        -> validated draft data
        -> active Proposal (generated proposal/change IDs)
        -> pure selected-change preview
        -> explicit human decisions
        -> atomic apply or reject
        -> committed document + finalized review receipt
```

Draft form state lives only in `ProposalComposer`. An active proposal is a
validated review object but is not authoritative document state. `previewDocument`
is derived from the committed document and selected active change. Only
`ReviewAuthority.apply()` can commit operations, and it commits a fully prepared
clone once all checks succeed.

## Invariants

- Logo and Legal are protected in the editor document.
- Startup has no document, layers, proposal, selection, or undo history. Explicit proposal creation or a validated import is required to load work.
- Invalid imports fail before the review authority is called, so partial documents and weakened protection never become active.
- A proposal records its base revision. Apply fails before mutation when that revision is stale.
- Blocked changes remain visible but cannot be selected or applied.
- Proposal and change IDs are generated per proposal generation; review-only WebMCP schemas contain only IDs from the active generation and old registrations are aborted.
- Published store snapshots freeze nested documents, operations, proposals, and finalized history so consumers cannot mutate authority-owned state.
- Apply clones the committed document, performs selected allowed edits on the clone, then commits once.
- Reject never mutates an explicitly loaded document. A proposal that provisioned the demo workspace returns atomically to the unloaded state when rejected.
- Undo restores the exact prior document and is safe when history is empty.
- Tool results are returned only after the shared store has emitted the visible state update and the browser has received two animation frames to paint it.
- Agent apply requires a one-use human authorization after at least one applicable change has been approved. Proposal edits and decisions reset that authorization.

## Boundaries

This is a browser-local WebMCP demonstration deployed as a static GitHub Pages application. It has no backend MCP server, accounts, persistence, analytics, remote export, or secret access. Reload therefore starts a new empty workspace rather than restoring transient review data.
