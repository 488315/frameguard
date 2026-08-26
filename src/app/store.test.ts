import { describe, expect, it } from "vitest";
import { createAppStore } from "./store";

describe("app store review focus", () => {
  it("starts with no active proposal or proposal selection", () => {
    const state = createAppStore().getSnapshot();
    expect(state.proposal).toBeNull();
    expect(state.selectedChange).toBeNull();
    expect(state.canUndo).toBe(false);
    expect(state.document.elements.logo.protected).toBe(true);
    expect(state.document.elements.legal.protected).toBe(true);
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
    const initial = store.getSnapshot().document;
    store.propose("adapt");
    store.rejectChange("headline-reflow");
    expect(store.getSnapshot().proposal?.changes[0].rejected).toBe(true);
    expect(store.getSnapshot().document).toEqual(initial);
  });
});
