# FrameGuard architecture

FrameGuard has at most one committed document and one mutation authority. The browser UI and WebMCP adapter call the same `AppStore`, which delegates workspace and review operations to `ReviewAuthority`.

## Ownership

- `src/editor` defines the committed document, strict JSON import validation, canvas layouts, protected elements, cloning, and deterministic audit.
- `src/review/models.ts` defines the typed proposal, operation, decision, and finalized-review contracts.
- `src/review/operations.ts` is the single operation registry. It owns valid target/operation combinations, display metadata, value validation, before-value derivation, protection checks, preview, and apply behavior.
- `src/review/review.ts` owns the nullable workspace lifecycle, proposal creation, approval selection, base-revision validation, atomic apply, rejection, finalized history, and one-level document undo.
- `src/app/store.ts` is the observable production interface shared by React and WebMCP. It owns UI activity, canonical synchronized layer/change focus, WebMCP availability, and the one-use human authorization for agent apply.
- `src/recovery` is an opt-in browser-storage adapter around store construction. It serializes only recovery data exported by `ReviewAuthority`, validates a saved candidate in isolation through production import and review methods, and can provide a fully reconstructed authority to `createAppStore` before the first snapshot is published.
- `src/app/layers.ts` derives navigator rows and unresolved proposal counts from committed document elements and the active proposal. It does not own durable state or protection policy.
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

When browser-local recovery is enabled, successful proposal and decision mutations
ask the recovery adapter to serialize the authority-owned workspace origin, an
explicitly imported document when present, exact active proposal input, and its
pending, approved, or rejected decisions. Bootstrap checks the opt-in flag and byte
limit, parses the exact versioned shape, creates an isolated `ReviewAuthority`,
validates imported documents with `parseImportedDocument`, recreates the proposal
with `createProposal`, and replays decisions with the normal authority methods.
Only a completely reproduced candidate is adopted by `createAppStore`, before its
first snapshot and before WebMCP registration.

Layer and change navigation share the store selection. Selecting a layer resolves
its first unresolved related change, or clears change focus when none exists.
Selecting a change updates the associated layer. The Layers navigator, inspector,
and real preview element outlines render from that same snapshot.

## Invariants

- Logo and Legal are protected in the editor document.
- Startup has no document, layers, proposal, selection, or undo history. Explicit proposal creation or a validated import is required to load work.
- Invalid imports fail before the review authority is called, so partial documents and weakened protection never become active.
- A proposal records its base revision. Apply fails before mutation when that revision is stale.
- Blocked changes remain visible but cannot be selected or applied.
- A Layers modification indicator means at least one related change remains pending. Approving or rejecting the final pending change removes the indicator immediately.
- Protected layers remain selectable for inspection. Protection is derived from the committed document and enforced again by the operation registry during apply.
- The imported document contract currently contains exactly six reviewable elements. The navigator is internally scrollable and keeps canonical selection visible, but arbitrary layer creation is outside the current document schema.
- Proposal and change IDs are generated per proposal generation; review-only WebMCP schemas contain only IDs from the active generation and old registrations are aborted.
- Published store snapshots freeze nested documents, operations, proposals, and finalized history so consumers cannot mutate authority-owned state.
- Published recovery status is frozen with the rest of the store snapshot. Recovery never writes directly to an `AppSnapshot` and never becomes a second review owner.
- Apply clones the committed document, performs selected allowed edits on the clone, then commits once.
- Reject never mutates an explicitly loaded document. A proposal that provisioned the demo workspace returns atomically to the unloaded state when rejected.
- Undo restores the exact prior document and is safe when history is empty.
- Tool results are returned only after the shared store has emitted the visible state update and the browser has received two animation frames to paint it.
- Agent apply requires a one-use human authorization after at least one applicable change has been approved. Proposal edits and decisions reset that authorization.
- Recovery is off by default, and enabling it alone does not provision a workspace. A valid provisional or imported active review receives fresh proposal and change IDs after refresh; protection and applicability are rederived, so protected decisions cannot be restored as approved.
- Apply, reject, workspace reset, turning recovery off, and explicit clearing remove saved draft bytes. Explicit clearing does not mutate the live review and reports it as unsaved until another durable review mutation succeeds.

## Recovery failure and cleanup

Saved recovery data is limited to 64 KiB and uses an exact versioned schema. It
does not contain generated IDs, derived before/applicability/blocked fields,
preview or selection state, activity, WebMCP availability, agent authorization,
history or undo, or composer fields. Imported origins include the validated
authority-owned document; proposal-provisioned origins do not infer ownership from
document equality.

Malformed, oversized, stale, partial, inconsistent, or protection-tampered data
fails closed. The isolated candidate is discarded, startup remains empty, recovery
reports an error, and no proposal-scoped WebMCP tools are registered. Browser
storage read, write, or clear failures never roll back a valid in-memory review
operation and are surfaced as unavailable rather than saved.

## Boundaries

This is a browser-local WebMCP demonstration deployed as a static GitHub Pages application. It has no backend MCP server, accounts, server persistence, analytics, remote export, or secret access. Reload starts empty unless the user explicitly enabled browser-local recovery for an active validated review. Cross-refresh history and undo, agent authorization, selection and activity, cross-tab or cloud sync, composer autosave, and arbitrary recovery-schema growth are intentionally out of scope.
