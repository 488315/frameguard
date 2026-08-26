import {
  ArrowCounterClockwise,
  ArrowRight,
  Check,
  DownloadSimple,
  LockKey,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import React from "react";
import type { CanvasLayout, ElementId } from "../editor/document";
import type { ChangeId, ReviewChange } from "../review/review";
import { downloadReceipt } from "../export/receipt";
import type { AppSnapshot, AppStore } from "./store";

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
      <p>Still / Life · Mobile adaptation</p>
      <div className="header-actions">
        <button
          disabled={!state.canUndo || busy}
          onClick={() => run("Undoing change set", store.undo)}
        >
          <ArrowCounterClockwise /> Undo
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run("Exporting revision", () => downloadReceipt(store))
          }
        >
          <DownloadSimple /> Export
        </button>
        <span>REVISION {String(state.document.revision).padStart(2, "0")}</span>
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
      <ul className="layer-list">
        {Object.entries(state.document.elements).map(([rawId, item], index) => {
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
        })}
      </ul>
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
  selectedChange: ChangeId | null;
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
            selectedChange === "headline-reflow" && (
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
          className={`image-field ${selectedChange === "image-crop" && proposal ? "crop-focus" : ""}`}
          style={{ backgroundPosition: layout.imagePosition }}
        >
          <div className="still-life">
            <b />
            <i />
            <em />
          </div>
          {mode === "mobile" && selectedChange === "image-crop" && proposal && (
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
        {mode === "mobile" && selectedChange === "logo-move" && proposal && (
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

export function ReviewWorkspace({ state }: { state: AppSnapshot }) {
  const [zoom, setZoom] = React.useState(0);
  const zoomScale = [0.82, 1, 1.16][zoom + 1];
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
            layout={state.document.layouts.desktop}
            selectedChange={state.selectedChange}
            proposal={Boolean(state.proposal)}
          />
          <LaunchCanvas
            mode="mobile"
            layout={state.document.layouts.mobile}
            selectedChange={state.selectedChange}
            proposal={Boolean(state.proposal)}
          />
        </div>
      </div>
    </section>
  );
}

function decisionLabel(change: ReviewChange) {
  if (!change.applicable) return "Blocked";
  if (change.approved) return "Approved";
  if (change.rejected) return "Rejected";
  return "Pending";
}

export function ProposalInspector({
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
  const approved =
    state.proposal?.changes.filter(
      (change) => change.applicable && change.approved,
    ).length ?? 0;
  return (
    <aside className="review" aria-label="Proposal inspector">
      <div className="review-head">
        <p>CHANGE SET 01</p>
        <h1>{state.proposal ? "Mobile adaptation" : "Review proposal"}</h1>
        <span>
          {state.proposal
            ? `${state.proposal.changes.length} proposed changes`
            : "No active proposal"}
        </span>
      </div>
      {!state.proposal ? (
        <div className="empty">
          <p>No active proposal.</p>
          <span>Prepare a mobile adaptation to begin a controlled review.</span>
          <button
            disabled={busy}
            onClick={() =>
              run("Creating proposal", () =>
                store.propose("Adapt the launch page for mobile"),
              )
            }
          >
            Create demo proposal
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
                aria-label={`Inspect ${change.label}`}
                aria-current={
                  state.selectedChange === change.id ? "true" : undefined
                }
                onClick={() => store.selectChange(change.id)}
              >
                <span className="change-no">0{index + 1}</span>
                <span>
                  <b>{change.label}</b>
                  <small>{change.description}</small>
                  <em>
                    {state.document.elements[change.target].label} ·{" "}
                    {change.kind}
                  </em>
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
                    aria-label={`Reject ${change.label}`}
                    aria-pressed={change.rejected}
                    onClick={() => store.rejectChange(change.id)}
                  >
                    <X /> Reject
                  </button>
                  <button
                    aria-label={`Approve ${change.label}`}
                    aria-pressed={change.approved}
                    onClick={() =>
                      store.setApproval(change.id, !change.approved)
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
      <div className="actions">
        <button
          disabled={!state.proposal || busy}
          onClick={() => run("Rejecting proposal", store.reject)}
        >
          <X /> Reject all
        </button>
        <button
          className="apply"
          disabled={!state.proposal || approved === 0 || busy}
          onClick={() => run("Applying approved changes", store.applyFromUi)}
        >
          <Check /> Apply {approved} {approved === 1 ? "change" : "changes"}
        </button>
        <button
          className="agent-approval"
          disabled={!state.proposal || approved === 0 || busy}
          onClick={store.authorizeAgentApply}
        >
          {state.agentApplyAuthorized
            ? "Agent apply allowed once"
            : "Allow agent apply once"}
        </button>
      </div>
      <div className={`webmcp ${state.webMcpAvailable ? "available" : ""}`}>
        <span /> WebMCP{" "}
        {state.webMcpAvailable
          ? "connected"
          : "unavailable · UI remains active"}
      </div>
    </aside>
  );
}
