import { describe, expect, it } from "vitest";
import { createInitialDocument } from "../editor/document";
import { createAppStore } from "./store";

describe("app store review focus", () => {
  it("starts with no active proposal or proposal selection", () => {
    const state = createAppStore().getSnapshot();
    expect(state.proposal).toBeNull();
    expect(state.selectedChange).toBeNull();
    expect(state.canUndo).toBe(false);
    expect(state.document).toBeNull();
    expect(state.selectedLayer).toBeNull();
  });

  it("selects layers and focuses their proposal change", () => {
    const store = createAppStore();
    store.propose("adapt");
    store.selectLayer("image");
    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "image",
      selectedChange: "image-crop",
    });
  });

  it("publishes a proposal and its focus as one coherent update", () => {
    const store = createAppStore();
    const snapshots: ReturnType<typeof store.getSnapshot>[] = [];
    const unsubscribe = store.subscribe(() =>
      snapshots.push(store.getSnapshot()),
    );
    store.propose("adapt");
    unsubscribe();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      proposal: { id: "mobile-adaptation-1" },
      selectedLayer: "headline",
      selectedChange: "headline-reflow",
    });
  });

  it("selects a change and its affected layer together", () => {
    const store = createAppStore();
    store.propose("adapt");
    store.selectChange("logo-move");
    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "logo",
      selectedChange: "logo-move",
    });
  });

  it("records an individual rejection without changing the document", () => {
    const store = createAppStore();
    store.propose("adapt");
    const initial = store.getSnapshot().document;
    store.rejectChange("headline-reflow");
    expect(store.getSnapshot().proposal?.changes[0].rejected).toBe(true);
    expect(store.getSnapshot().document).toEqual(initial);
  });

  it("preserves proposal focus when undo has no committed history", () => {
    const store = createAppStore();
    store.propose("adapt");
    const result = store.undo();
    expect(result.changed).toBe(false);
    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "headline",
      selectedChange: "headline-reflow",
      proposal: { id: "mobile-adaptation-1" },
    });
  });

  it("clears proposal focus only after a successful apply", () => {
    const store = createAppStore();
    store.propose("adapt");
    store.setApproval("headline-reflow", true);
    store.applyFromUi();
    expect(store.getSnapshot()).toMatchObject({
      proposal: null,
      selectedChange: null,
      document: { revision: 2 },
    });
  });

  it("imports validated content and leaves failed imports empty", () => {
    const failed = createAppStore();
    expect(() => failed.importLayout('{"revision":1}')).toThrow(
      "complete FrameGuard document",
    );
    expect(failed.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      selectedLayer: null,
    });

    const store = createAppStore();
    store.importLayout(JSON.stringify(createInitialDocument()));
    expect(store.getSnapshot()).toMatchObject({
      document: {
        revision: 1,
        elements: {
          logo: { protected: true },
          legal: { protected: true },
        },
      },
      proposal: null,
      selectedLayer: null,
    });
  });

  it("resets all transient and committed workspace state", () => {
    const store = createAppStore();
    store.propose("adapt");
    store.setApproval("headline-reflow", true);
    store.authorizeAgentApply();
    store.resetWorkspace();
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      canUndo: false,
      modifiedElements: [],
      selectedLayer: null,
      selectedChange: null,
      agentApplyAuthorized: false,
    });
  });
});
