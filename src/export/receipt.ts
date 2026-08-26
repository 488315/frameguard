import { auditDocument } from "../editor/document";
import type { AppStore } from "../app/store";

export function serializeReceipt(store: AppStore): string {
  const state = store.getSnapshot();
  if (!state.document) throw new Error("No workspace loaded");
  return JSON.stringify(
    {
      product: "FrameGuard",
      revision: state.document.revision,
      document: state.document,
      audit: auditDocument(state.document),
    },
    null,
    2,
  );
}

export function downloadReceipt(store: AppStore): string {
  const receipt = serializeReceipt(store);
  const documentState = store.getSnapshot().document;
  if (!documentState) throw new Error("No workspace loaded");
  if (typeof URL.createObjectURL === "function") {
    const url = URL.createObjectURL(
      new Blob([receipt], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `frameguard-revision-${documentState.revision}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  store.record("export_review_receipt", "Receipt prepared locally");
  return receipt;
}
