import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  const importInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
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
      setNotice({
        tone: "working",
        text: `${label}…`,
        activity: state.activity,
      });
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
    notice && (notice.tone === "working" || notice.activity === state.activity)
      ? notice
      : null;
  const readFile = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Layout file could not be read"));
      reader.readAsText(file);
    });
  const importLayout = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    run("Importing layout", async () =>
      store.importLayout(await readFile(file)),
    );
  };
  return (
    <main aria-busy={busy}>
      <input
        ref={importInput}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="Import layout file"
        onChange={importLayout}
      />
      <ReviewHeader state={state} store={store} run={run} busy={busy} />
      <div className="workspace">
        <LayerRail state={state} store={store} />
        <ReviewWorkspace
          state={state}
          busy={busy}
          openImport={() => importInput.current?.click()}
          openComposer={() => setComposerOpen(true)}
        />
        <ProposalInspector
          state={state}
          store={store}
          run={run}
          busy={busy}
          composerOpen={composerOpen}
          openComposer={() => setComposerOpen(true)}
          closeComposer={() => setComposerOpen(false)}
        />
      </div>
      <footer
        className={`activity ${visibleNotice?.tone ?? ""}`}
        aria-live="polite"
      >
        <span>ACTIVITY</span>
        <b>
          {visibleNotice?.text ??
            state.activity?.tool ??
            (state.document ? "Ready for review" : "No review loaded")}
        </b>
        <p>
          {visibleNotice
            ? visibleNotice.tone === "error"
              ? "The committed document was not changed."
              : "State synchronized across the workspace."
            : (state.activity?.result ??
              (state.document ? "No tool calls yet" : "Workspace is empty"))}
        </p>
      </footer>
    </main>
  );
}
