import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Check,
  DownloadSimple,
  LockKey,
  ShieldCheck,
  X,
} from "@phosphor-icons/react";
import { createAppStore, type AppStore } from "./store";
import { installWebMcp } from "../webmcp/adapter";
import { downloadReceipt } from "../export/receipt";
import type { CanvasLayout } from "../editor/document";

function LaunchCanvas({
  mode,
  layout,
  proposal,
}: {
  mode: "desktop" | "mobile";
  layout: CanvasLayout;
  proposal: boolean;
}) {
  return (
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
        {mode === "mobile" && proposal && (
          <div className="boundaries" aria-label="headline boundaries">
            <i className="old" />
            <i className="new" />
          </div>
        )}
        <p>Objects and ideas for a slower, more deliberate season.</p>
        <span className="canvas-cta">
          Explore the collection <ArrowRight size={13} />
        </span>
      </div>
      <div
        className="image-field"
        style={{ backgroundPosition: layout.imagePosition }}
      >
        <div className="still-life">
          <b />
          <i />
          <em />
        </div>
      </div>
      <footer>
        © 2026 Still / Life. All rights reserved.{" "}
        <span>
          <LockKey size={10} weight="fill" /> Protected
        </span>
      </footer>
    </article>
  );
}

export function App({ store: suppliedStore }: { store?: AppStore }) {
  const store = useMemo(
    () => suppliedStore ?? createAppStore(),
    [suppliedStore],
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => installWebMcp(store), [store]);
  const selected =
    state.proposal?.changes.filter((change) => change.approved).length ?? 0;
  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <ShieldCheck weight="fill" /> FrameGuard
        </div>
        <p>Visual change review</p>
        <div className="revision">
          REVISION {String(state.document.revision).padStart(2, "0")}
        </div>
      </header>
      <div className="workspace">
        <aside className="layers">
          <h1>Layers</h1>
          <div className="layer-list" role="list">
            {Object.entries(state.document.elements).map(
              ([id, item], index) => (
                <div
                  role="listitem"
                  key={id}
                  className={`layer-row ${id === "headline" ? "active" : ""}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {item.label}
                  {item.protected && <LockKey size={12} weight="fill" />}
                </div>
              ),
            )}
          </div>
        </aside>
        <section className="stage">
          <div className="stage-heading">
            <div>
              <p>ADAPTATION REVIEW</p>
              <h1>Desktop to mobile</h1>
            </div>
            <p>Nothing changes without approval.</p>
          </div>
          <div className="canvases">
            <LaunchCanvas
              mode="desktop"
              layout={state.document.layouts.desktop}
              proposal={false}
            />
            <LaunchCanvas
              mode="mobile"
              layout={state.document.layouts.mobile}
              proposal={Boolean(state.proposal)}
            />
          </div>
          {state.proposal && (
            <div className="blocked-arrow" aria-label="blocked logo move">
              <ArrowRight /> <span>BLOCKED AT LOGO LOCK</span>
              <LockKey weight="fill" />
            </div>
          )}
        </section>
        <aside className="review">
          <div className="review-head">
            <p>CHANGE SET 01</p>
            <h1>Review proposal</h1>
            <span>{state.proposal ? "3 changes" : "No active proposal"}</span>
          </div>
          {!state.proposal ? (
            <div className="empty">
              <p>Ask the agent to prepare the mobile adaptation.</p>
              <button
                onClick={() =>
                  store.propose("Adapt the launch page for mobile")
                }
              >
                Create demo proposal
              </button>
            </div>
          ) : (
            <div className="change-list">
              {state.proposal.changes.map((change, index) => (
                <label
                  key={change.id}
                  className={change.applicable ? "" : "blocked"}
                >
                  <span className="change-no">0{index + 1}</span>
                  <span>
                    <b>{change.label}</b>
                    <small>{change.description}</small>
                    {change.blockedReason && (
                      <em>
                        <LockKey weight="fill" /> {change.blockedReason}
                      </em>
                    )}
                  </span>
                  {change.applicable ? (
                    <input
                      aria-label={`Approve ${change.label}`}
                      type="checkbox"
                      checked={change.approved}
                      onChange={(event) =>
                        store.setApproval(change.id, event.target.checked)
                      }
                    />
                  ) : (
                    <X />
                  )}
                </label>
              ))}
            </div>
          )}
          <div className="actions">
            <button disabled={!state.proposal} onClick={() => store.reject()}>
              <X /> Reject
            </button>
            <button
              className="apply"
              disabled={!state.proposal || selected === 0}
              onClick={() => store.applyFromUi()}
            >
              <Check /> Apply {selected || 2} changes
            </button>
            <button
              disabled={!state.proposal || selected === 0}
              onClick={() => store.authorizeAgentApply()}
            >
              {state.agentApplyAuthorized
                ? "Agent apply allowed"
                : "Allow agent apply"}
            </button>
            <button disabled={!state.canUndo} onClick={() => store.undo()}>
              Undo
            </button>
            <button onClick={() => downloadReceipt(store)}>
              <DownloadSimple /> Export
            </button>
          </div>
          <div className={`webmcp ${state.webMcpAvailable ? "available" : ""}`}>
            <span /> WebMCP{" "}
            {state.webMcpAvailable
              ? "connected"
              : "unavailable · UI remains active"}
          </div>
        </aside>
      </div>
      <footer className="activity" aria-live="polite">
        <span>ACTIVITY</span>
        <b>{state.activity?.tool ?? "Ready for review"}</b>
        <p>{state.activity?.result ?? "No tool calls yet"}</p>
      </footer>
    </main>
  );
}
