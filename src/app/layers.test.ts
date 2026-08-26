import { describe, expect, it } from "vitest";
import { createAppStore } from "./store";
import { deriveLayerNavigatorItems } from "./layers";

const twoHeadlineChanges = {
  expectedRevision: 1,
  title: "Responsive headline review",
  objective: "Review both headline layouts.",
  changes: [
    {
      target: "headline" as const,
      operation: {
        kind: "set_text" as const,
        canvas: "mobile" as const,
        value: "Mobile headline",
      },
      rationale: "Balance the mobile line length.",
    },
    {
      target: "headline" as const,
      operation: {
        kind: "set_text" as const,
        canvas: "desktop" as const,
        value: "Desktop headline",
      },
      rationale: "Balance the desktop line length.",
    },
  ],
};

describe("layer navigator derivation", () => {
  it("counts only unresolved proposal changes for each layer", () => {
    const store = createAppStore();
    const proposal = store.createProposal(twoHeadlineChanges);

    expect(
      deriveLayerNavigatorItems(store.getSnapshot()).find(
        (layer) => layer.id === "headline",
      )?.proposedChangeCount,
    ).toBe(2);

    store.setApproval(proposal.changes[0].id, true);
    expect(
      deriveLayerNavigatorItems(store.getSnapshot()).find(
        (layer) => layer.id === "headline",
      )?.proposedChangeCount,
    ).toBe(1);

    store.rejectChange(proposal.changes[1].id);
    expect(
      deriveLayerNavigatorItems(store.getSnapshot()).find(
        (layer) => layer.id === "headline",
      )?.proposedChangeCount,
    ).toBe(0);
  });

  it("derives protected state from the committed document", () => {
    const store = createAppStore();
    store.propose("Review the mobile layout");
    const layers = deriveLayerNavigatorItems(store.getSnapshot());

    expect(layers.find((layer) => layer.id === "logo")?.protected).toBe(true);
    expect(layers.find((layer) => layer.id === "legal")?.protected).toBe(true);
    expect(layers.find((layer) => layer.id === "headline")?.protected).toBe(
      false,
    );
  });
});
