import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createAppStore, type Activity, type AppStore } from "./store";
import { installWebMcp } from "../webmcp/adapter";
import {
  LayerRail,
  ProposalInspector,
  ReviewHeader,
  ReviewWorkspace,
} from "./components";

export function App({ store: suppliedStore }: { store?: AppStore }) {
  const store = useMemo(
    () => suppliedStore ?? createAppStore(),
    [suppliedStore],
  );
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "working" | "error";
    text: string;
    activity: Activity | null;
  } | null>(null);
  useEffect(() => installWebMcp(store), [store]);
  const run = useCallback(
    (label: string, action: () => unknown) => {
      if (busy) return;
      setBusy(true);
      setNotice({ tone: "working", text: `${label}…`, activity: state.activity });
      void Promise.resolve()
        .then(action)
        .then(() => {
          setNotice(null);
        })
        .catch((error: unknown) => {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : `${label} failed`,
            activity: store.getSnapshot().activity,
          });
        })
        .finally(() => setBusy(false));
    },
    [busy, state.activity, store],
  );
  const visibleNotice =
    notice &&
    (notice.tone === "working" || notice.activity === state.activity)
      ? notice
      : null;
  return (
    <main aria-busy={busy}>
      <ReviewHeader state={state} store={store} run={run} busy={busy} />
      <div className="workspace">
        <LayerRail state={state} store={store} />
        <ReviewWorkspace state={state} />
        <ProposalInspector state={state} store={store} run={run} busy={busy} />
      </div>
      <footer
        className={`activity ${visibleNotice?.tone ?? ""}`}
        aria-live="polite"
      >
        <span>ACTIVITY</span>
        <b>{visibleNotice?.text ?? state.activity?.tool ?? "Ready for review"}</b>
        <p>
          {visibleNotice
            ? visibleNotice.tone === "error"
              ? "The committed document was not changed."
              : "State synchronized across the workspace."
            : (state.activity?.result ?? "No tool calls yet")}
        </p>
      </footer>
    </main>
  );
}
