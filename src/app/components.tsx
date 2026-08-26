import {
  ArrowCounterClockwise,
  ArrowRight,
  Browser,
  Check,
  DownloadSimple,
  FileText,
  LockKey,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import React from "react";
import type { CanvasLayout, ElementId } from "../editor/document";
import type { ReviewChange } from "../review/review";
import { downloadReceipt } from "../export/receipt";
import type { AppSnapshot, AppStore } from "./store";
import { ProposalComposer } from "./ProposalComposer";
import { deriveLayerNavigatorItems, type LayerNavigatorItem } from "./layers";

export function ReviewHeader({
  state,
  store,
  run,
  busy,
}: {
  state: AppSnapshot;
  store: AppStore;
  run: (label: string, action: () => unknown) => void;
  busy: boolean;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <ShieldCheck weight="fill" /> FrameGuard
      </div>
      <p>{state.document ? "Still / Life · Mobile adaptation" : "Workspace"}</p>
      <div className="header-actions">
        <button
          disabled={!state.canUndo || busy}
          onClick={() => run("Undoing change set", store.undo)}
        >
          <ArrowCounterClockwise /> Undo
        </button>
        <button
          disabled={!state.document || busy}
          onClick={() =>
            run("Exporting revision", () => downloadReceipt(store))
          }
        >
          <DownloadSimple /> Export
        </button>
        <span>
          REVISION {String(state.document?.revision ?? 1).padStart(2, "0")}
        </span>
      </div>
    </header>
  );
}

export function LayerRail({
  state,
  store,
}: {
  state: AppSnapshot;
  store: AppStore;
}) {
  const layers = deriveLayerNavigatorItems(state);
  const listRef = React.useRef<HTMLUListElement>(null);
  const accessibleName = (layer: LayerNavigatorItem) => {
    const changeDescription = layer.hasProposedChanges
      ? `${layer.proposedChangeCount} proposed ${layer.proposedChangeCount === 1 ? "change" : "changes"}`
      : "no proposed changes";
    return [
      layer.label,
      layer.selected && "selected",
      layer.protected && "protected",
      changeDescription,
    ]
      .filter(Boolean)
      .join(", ");
  };
  const handleLayerKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    index: number,
    id: ElementId,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      store.selectLayer(id);
      return;
    }
    const movement = {
      ArrowDown: Math.min(index + 1, layers.length - 1),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: layers.length - 1,
    }[event.key];
    if (movement === undefined) return;
    event.preventDefault();
    const options =
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
    options?.[movement]?.focus();
  };
  return (
    <aside className="layers" aria-label="Layers navigator">
      <h1>Layers</h1>
      {!state.document ? (
        <div className="layers-empty">
          <b>No layers yet</b>
          <p>Import a layout or create a proposal to get started.</p>
        </div>
      ) : (
        <ul
          ref={listRef}
          className="layer-list"
          role="listbox"
          aria-label="Document layers"
        >
          {layers.map((layer, index) => (
            <li
              key={layer.id}
              role="option"
              aria-label={accessibleName(layer)}
              aria-selected={layer.selected}
              tabIndex={
                layer.selected || (!state.selectedLayer && index === 0) ? 0 : -1
              }
              className={`layer-row ${layer.selected ? "active" : ""} ${layer.hasProposedChanges ? "affected" : ""}`}
              onClick={() => store.selectLayer(layer.id)}
              onKeyDown={(event) => handleLayerKeyDown(event, index, layer.id)}
            >
              <span className="layer-no">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="layer-label" title={layer.label}>
                {layer.label}
              </span>
              <span className="layer-indicator" aria-hidden="true">
                {layer.hasProposedChanges && <i />}
              </span>
              <span className="layer-protection" aria-hidden="true">
                {layer.protected && <LockKey size={12} weight="fill" />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function LaunchCanvas({
  mode,
  layout,
  selectedChange,
  selectedLayer,
  proposal,
  comparison,
}: {
  mode: "desktop" | "mobile";
  layout: CanvasLayout;
  selectedChange: ReviewChange | null;
  selectedLayer: { id: ElementId; label: string } | null;
  proposal: boolean;
  comparison?: "current" | "proposed";
}) {
  const showProposalDetails = proposal && comparison !== "current";
  const canvasName = comparison ? `${comparison} ${mode}` : mode;
  const showSelectedLayer =
    comparison !== "current" &&
    (!selectedChange || selectedChange.canvas === mode);
  const selected = (id: ElementId) =>
    showSelectedLayer && selectedLayer?.id === id;
  const selectedLabel = (id: ElementId) =>
    selected(id) ? `Selected ${selectedLayer?.label} layer` : undefined;
  return (
    <div className={`canvas-frame ${mode} ${comparison ?? ""}`}>
      <div className="canvas-label">
        <span>{comparison ? `${mode} · ${comparison}` : mode}</span>
        <span>{mode === "desktop" ? "1440 × 1014" : "390 × 696"}</span>
      </div>
      <article className={`canvas ${mode}`} aria-label={`${canvasName} canvas`}>
        <header>
          <strong
            className={selected("logo") ? "selected-element" : undefined}
            aria-label={selectedLabel("logo")}
          >
            STILL / LIFE
          </strong>
          <span>
            <LockKey size={12} weight="fill" /> Protected
          </span>
        </header>
        <div className="launch-copy">
          <p className="issue">ISSUE NO. 04 · AUTUMN</p>
          <h2
            className={selected("headline") ? "selected-element" : undefined}
            aria-label={selectedLabel("headline")}
          >
            {layout.headline.split("\n").map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p
            className={selected("body") ? "selected-element" : undefined}
            aria-label={selectedLabel("body")}
          >
            Objects and ideas for a slower, more deliberate season.
          </p>
          <span
            className={`canvas-cta ${selected("cta") ? "selected-element" : ""}`}
            aria-label={selectedLabel("cta")}
          >
            Explore the collection <ArrowRight size={13} />
          </span>
        </div>
        <div
          className={`image-field ${selected("image") ? "selected-element" : ""} ${selectedChange?.target === "image" && selectedChange.canvas === mode && showProposalDetails ? "crop-focus" : ""}`}
          aria-label={selectedLabel("image")}
          style={{ backgroundPosition: layout.imagePosition }}
        >
          <div className="still-life">
            <b />
            <i />
            <em />
          </div>
          {selectedChange?.target === "image" &&
            selectedChange.canvas === mode &&
            showProposalDetails && (
              <div className="crop-guide" aria-label="proposed crop boundary">
                <span>Proposed crop</span>
              </div>
            )}
        </div>
        <footer
          className={selected("legal") ? "selected-element" : undefined}
          aria-label={selectedLabel("legal")}
        >
          © 2026 Still / Life. All rights reserved.{" "}
          <span>
            <LockKey size={10} weight="fill" /> Protected
          </span>
        </footer>
        {selectedChange?.target === "logo" &&
          selectedChange.canvas === mode &&
          !selectedChange.applicable &&
          showProposalDetails && (
            <div className="blocked-vector" aria-label="blocked logo move">
              <ArrowRight />
              <span>Blocked at protected anchor</span>
              <LockKey weight="fill" />
            </div>
          )}
      </article>
    </div>
  );
}

export function ReviewWorkspace({
  state,
  busy,
  openImport,
  openComposer,
}: {
  state: AppSnapshot;
  busy: boolean;
  openImport: () => void;
  openComposer: () => void;
}) {
  const [zoom, setZoom] = React.useState(0);
  const zoomScale = [0.82, 1, 1.16][zoom + 1];
  const selectedProposalChange =
    state.proposal?.changes.find(
      (change) => change.id === state.selectedChange,
    ) ?? null;
  const selectedLayer = state.selectedLayer
    ? {
        id: state.selectedLayer,
        label:
          state.document?.elements[state.selectedLayer].label ??
          state.selectedLayer,
      }
    : null;
  const showMobileDiff = Boolean(
    state.proposal && selectedProposalChange?.canvas === "mobile",
  );
  if (!state.document) {
    return (
      <section className="stage empty-stage" aria-label="Empty workspace">
        <div className="stage-heading">
          <div>
            <p>WORKSPACE</p>
            <h1>Desktop to mobile</h1>
            <span>No active review</span>
          </div>
        </div>
        <div className="workspace-empty-card">
          <div className="empty-illustration" aria-hidden="true">
            <Browser weight="thin" />
            <span className="form-tall" />
            <span className="form-low" />
            <span className="form-round" />
          </div>
          <h2>Start your first review</h2>
          <p>
            You don’t have an active proposal or adaptation yet. Create a
            proposal to begin a guided review, or import a layout to get
            started.
          </p>
          <div className="workspace-empty-actions">
            <button disabled={busy} onClick={openComposer}>
              Create proposal
            </button>
            <button disabled={busy} onClick={openImport}>
              Import layout
            </button>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="stage" aria-label="Visual comparison workspace">
      <div className="stage-heading">
        <div>
          <p>ADAPTATION REVIEW</p>
          <h1>Desktop to mobile</h1>
        </div>
        <p>Nothing changes without approval.</p>
      </div>
      <div className="viewport-tools" aria-label="Preview zoom controls">
        <button
          aria-label="Zoom out"
          disabled={zoom === -1}
          onClick={() => setZoom((value) => Math.max(-1, value - 1))}
        >
          <MagnifyingGlassMinus />
        </button>
        <button onClick={() => setZoom(0)}>
          {zoom === 0 ? "Fit" : `${Math.round(zoomScale * 100)}%`}
        </button>
        <button
          aria-label="Zoom in"
          disabled={zoom === 1}
          onClick={() => setZoom((value) => Math.min(1, value + 1))}
        >
          <MagnifyingGlassPlus />
        </button>
      </div>
      <div className="canvas-scroll">
        <div
          className={`canvases ${showMobileDiff ? "with-mobile-diff" : ""}`}
          style={{ "--preview-zoom": zoomScale } as React.CSSProperties}
        >
          <LaunchCanvas
            mode="desktop"
            layout={
              state.previewDocument?.layouts.desktop ??
              state.document.layouts.desktop
            }
            selectedChange={selectedProposalChange}
            selectedLayer={selectedLayer}
            proposal={Boolean(state.proposal)}
          />
          {showMobileDiff ? (
            <div className="mobile-diff" aria-label="Mobile before and after">
              <LaunchCanvas
                mode="mobile"
                comparison="current"
                layout={state.document.layouts.mobile}
                selectedChange={selectedProposalChange}
                selectedLayer={selectedLayer}
                proposal={Boolean(state.proposal)}
              />
              <LaunchCanvas
                mode="mobile"
                comparison="proposed"
                layout={
                  state.previewDocument?.layouts.mobile ??
                  state.document.layouts.mobile
                }
                selectedChange={selectedProposalChange}
                selectedLayer={selectedLayer}
                proposal={Boolean(state.proposal)}
              />
            </div>
          ) : (
            <LaunchCanvas
              mode="mobile"
              layout={state.document.layouts.mobile}
              selectedChange={selectedProposalChange}
              selectedLayer={selectedLayer}
              proposal={Boolean(state.proposal)}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function decisionLabel(change: ReviewChange) {
  if (!change.applicable) return "Blocked";
  if (change.decision === "approved") return "Approved";
  if (change.decision === "rejected") return "Rejected";
  return "Pending";
}

export function ProposalInspector({
  state,
  store,
  run,
  busy,
  composerOpen,
  openComposer,
  closeComposer,
}: {
  state: AppSnapshot;
  store: AppStore;
  run: (label: string, action: () => unknown) => void;
  busy: boolean;
  composerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;
}) {
  const approved =
    state.proposal?.changes.filter(
      (change) => change.applicable && change.decision === "approved",
    ).length ?? 0;
  const focusAfterClose = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (composerOpen || !focusAfterClose.current) return;
    document.querySelector<HTMLElement>(focusAfterClose.current)?.focus();
    focusAfterClose.current = null;
  }, [composerOpen, state.proposal]);
  const closeAndFocus = (selector: string) => {
    focusAfterClose.current = selector;
    closeComposer();
  };
  return (
    <aside
      className={`review ${!state.proposal ? "empty-workspace-review" : ""}`}
      aria-label="Proposal inspector"
    >
      <div className="review-head">
        <p>{state.proposal ? "CHANGE SET 01" : "REVIEW PROPOSAL"}</p>
        <h1>
          {composerOpen
            ? "Create proposal"
            : (state.proposal?.title ?? "No active proposal")}
        </h1>
        <span>
          {composerOpen
            ? "Draft · committed document unchanged"
            : state.proposal
              ? `${state.proposal.changes.length} proposed changes`
              : "Nothing to review yet."}
        </span>
      </div>
      {composerOpen ? (
        <ProposalComposer
          state={state}
          store={store}
          onCancel={() => closeAndFocus(".empty button")}
          onCreated={() => closeAndFocus(".change-focus")}
        />
      ) : !state.proposal ? (
        <div className="empty">
          <div className="proposal-empty-icon" aria-hidden="true">
            <FileText weight="thin" />
            <i />
          </div>
          <p>Create a proposal to begin a controlled review.</p>
          <button disabled={busy} onClick={openComposer}>
            Create proposal
          </button>
        </div>
      ) : (
        <div className="change-list">
          {state.selectedLayer && !state.selectedChange && (
            <p className="layer-selection-empty">
              {state.document?.elements[state.selectedLayer].label} has no
              proposed changes.
            </p>
          )}
          <div role="list" aria-label="Proposed changes">
            {state.proposal.changes.map((change, index) => (
              <div
                role="listitem"
                key={change.id}
                className={`change-row ${!change.applicable ? "blocked" : ""} ${state.selectedChange === change.id ? "selected" : ""}`}
              >
                <button
                  className="change-focus"
                  aria-label={`Inspect ${state.document?.elements[change.target].label ?? change.target} change`}
                  aria-current={
                    state.selectedChange === change.id ? "true" : undefined
                  }
                  onClick={() => store.selectChange(change.id)}
                >
                  <span className="change-no">0{index + 1}</span>
                  <span>
                    <b>{change.summary}</b>
                    <small>{change.rationale}</small>
                    <em>
                      {change.canvas} ·{" "}
                      {change.operation.kind.replaceAll("_", " ")}
                    </em>
                    <dl className="change-values">
                      <div>
                        <dt>Before</dt>
                        <dd>{change.before}</dd>
                      </div>
                      <div>
                        <dt>After</dt>
                        <dd>{change.proposed}</dd>
                      </div>
                    </dl>
                  </span>
                  <span
                    className={`decision ${decisionLabel(change).toLowerCase()}`}
                  >
                    {decisionLabel(change)}
                  </span>
                </button>
                {change.applicable ? (
                  <div className="change-decisions">
                    <button
                      aria-label={`Reject ${state.document?.elements[change.target].label ?? change.target} change`}
                      disabled={busy || change.decision === "rejected"}
                      onClick={() => store.rejectChange(change.id)}
                    >
                      <X /> Reject
                    </button>
                    <button
                      aria-label={`Approve ${state.document?.elements[change.target].label ?? change.target} change`}
                      aria-pressed={change.decision === "approved"}
                      disabled={busy}
                      onClick={() =>
                        store.setApproval(
                          change.id,
                          change.decision !== "approved",
                        )
                      }
                    >
                      <Check /> Approve
                    </button>
                  </div>
                ) : (
                  <p className="blocked-reason">
                    <LockKey weight="fill" /> {change.blockedReason}. Original
                    retained.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {!composerOpen && (
        <div className="actions">
          <button
            disabled={composerOpen || !state.proposal || busy}
            onClick={() => run("Rejecting proposal", store.reject)}
          >
            <X /> Reject all
          </button>
          <button
            className="apply"
            disabled={composerOpen || !state.proposal || approved === 0 || busy}
            onClick={() => run("Applying approved changes", store.applyFromUi)}
          >
            <Check /> Apply {approved} {approved === 1 ? "change" : "changes"}
          </button>
          <button
            className="agent-approval"
            disabled={composerOpen || !state.proposal || approved === 0 || busy}
            onClick={store.authorizeAgentApply}
          >
            {state.agentApplyAuthorized
              ? "Agent apply allowed once"
              : "Allow agent apply once"}
          </button>
        </div>
      )}
      <div className={`webmcp ${state.webMcpAvailable ? "available" : ""}`}>
        <span /> WebMCP{" "}
        {state.webMcpAvailable
          ? "connected"
          : "unavailable · UI remains active"}
      </div>
    </aside>
  );
}
