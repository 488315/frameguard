import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { createAppStore, type AppStore } from "./store";
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
    tone: "working" | "success" | "error";
    text: string;
  } | null>(null);
  useEffect(() => installWebMcp(store), [store]);
  const run = useCallback(
    (label: string, action: () => unknown) => {
      if (busy) return;
      setBusy(true);
      setNotice({ tone: "working", text: `${label}…` });
      void Promise.resolve()
        .then(action)
        .then(() => {
          setNotice({ tone: "success", text: label.replace(/ing\b/, "ed") });
        })
        .catch((error: unknown) => {
          setNotice({
            tone: "error",
            text: error instanceof Error ? error.message : `${label} failed`,
          });
        })
        .finally(() => setBusy(false));
    },
    [busy],
  );
  return (
    <main aria-busy={busy}>
      <ReviewHeader state={state} store={store} run={run} busy={busy} />
      <div className="workspace">
        <LayerRail state={state} store={store} />
        <ReviewWorkspace state={state} />
        <ProposalInspector state={state} store={store} run={run} busy={busy} />
      </div>
      <footer className={`activity ${notice?.tone ?? ""}`} aria-live="polite">
        <span>ACTIVITY</span>
        <b>{notice?.text ?? state.activity?.tool ?? "Ready for review"}</b>
        <p>
          {notice
            ? notice.tone === "error"
              ? "The committed document was not changed."
              : "State synchronized across the workspace."
            : (state.activity?.result ?? "No tool calls yet")}
        </p>
      </footer>
    </main>
  );
}
