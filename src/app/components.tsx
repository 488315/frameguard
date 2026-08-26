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
  const affected = new Set(
    state.proposal?.changes.map((change) => change.target),
  );
  return (
    <aside className="layers" aria-label="Document layers">
      <h1>Layers</h1>
      {!state.document ? (
        <div className="layers-empty">
          <b>No layers yet</b>
          <p>Import a layout or create a proposal to get started.</p>
        </div>
      ) : (
        <ul className="layer-list">
          {Object.entries(state.document.elements).map(
            ([rawId, item], index) => {
              const id = rawId as ElementId;
              const isAffected = affected.has(id);
              const selected = state.selectedLayer === id;
              const modified = state.modifiedElements.includes(id);
              const description = [
                item.label,
                item.protected && "protected",
                isAffected && "proposal affected",
                modified && "modified",
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={id}>
                  <button
                    aria-label={description}
                    aria-current={selected ? "true" : undefined}
                    className={`layer-row ${selected ? "active" : ""} ${isAffected ? "affected" : ""} ${modified ? "modified" : ""}`}
                    onClick={() => store.selectLayer(id)}
                  >
                    <span className="layer-no">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="layer-label">{item.label}</span>
                    {(isAffected || modified) && <i aria-hidden="true" />}
                    {item.protected && (
                      <LockKey aria-label="Protected" size={12} weight="fill" />
                    )}
                  </button>
                </li>
              );
            },
          )}
        </ul>
      )}
    </aside>
  );
}

function LaunchCanvas({
  mode,
  layout,
  selectedChange,
  proposal,
}: {
  mode: "desktop" | "mobile";
  layout: CanvasLayout;
  selectedChange: ReviewChange | null;
  proposal: boolean;
}) {
  return (
    <div className={`canvas-frame ${mode}`}>
      <div className="canvas-label">
        <span>{mode}</span>
        <span>{mode === "desktop" ? "1440 × 1014" : "390 × 696"}</span>
      </div>
      <article className={`canvas ${mode}`} aria-label={`${mode} canvas`}>
        <header>
          <strong>STILL / LIFE</strong>
          <span>
            <LockKey size={12} weight="fill" /> Protected
          </span>
        </header>
        <div className="launch-copy">
          <p className="issue">ISSUE NO. 04 · AUTUMN</p>
          <h2>
            {layout.headline.split("\n").map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          {mode === "mobile" &&
            proposal &&
            selectedChange?.target === "headline" &&
            selectedChange.canvas === mode && (
              <div
                className="headline-overlay"
                aria-label="headline boundaries"
              >
                <span>Current</span>
                <i className="old" />
                <span>Proposed</span>
                <i className="new" />
              </div>
            )}
          <p>Objects and ideas for a slower, more deliberate season.</p>
          <span className="canvas-cta">
            Explore the collection <ArrowRight size={13} />
          </span>
        </div>
        <div
          className={`image-field ${selectedChange?.target === "image" && selectedChange.canvas === mode && proposal ? "crop-focus" : ""}`}
          style={{ backgroundPosition: layout.imagePosition }}
        >
          <div className="still-life">
            <b />
            <i />
            <em />
          </div>
          {selectedChange?.target === "image" &&
            selectedChange.canvas === mode &&
            proposal && (
              <div className="crop-guide" aria-label="proposed crop boundary">
                <span>Proposed crop</span>
              </div>
            )}
        </div>
        <footer>
          © 2026 Still / Life. All rights reserved.{" "}
          <span>
            <LockKey size={10} weight="fill" /> Protected
          </span>
        </footer>
        {selectedChange?.target === "logo" &&
          selectedChange.canvas === mode &&
          !selectedChange.applicable &&
          proposal && (
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
          className="canvases"
          style={{ "--preview-zoom": zoomScale } as React.CSSProperties}
        >
          <LaunchCanvas
            mode="desktop"
            layout={
              state.previewDocument?.layouts.desktop ??
              state.document.layouts.desktop
            }
            selectedChange={selectedProposalChange}
            proposal={Boolean(state.proposal)}
          />
          <LaunchCanvas
            mode="mobile"
            layout={
              state.previewDocument?.layouts.mobile ??
              state.document.layouts.mobile
            }
            selectedChange={selectedProposalChange}
            proposal={Boolean(state.proposal)}
          />
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
          onCancel={closeComposer}
          onCreated={closeComposer}
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
        <div className="change-list" role="list" aria-label="Proposed changes">
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
