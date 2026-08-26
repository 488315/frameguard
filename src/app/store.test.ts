import { describe, expect, it } from "vitest";
import { createInitialDocument } from "../editor/document";
import { createAppStore } from "./store";

const customProposal = {
  expectedRevision: 1,
  title: "Custom mobile proposal",
  objective: "Refine the narrow composition.",
  changes: [
    {
      target: "headline" as const,
      operation: {
        kind: "set_text" as const,
        canvas: "mobile" as const,
        value: "Custom\nmobile headline",
      },
      rationale: "Improve the line break.",
    },
  ],
};

describe("app store review focus", () => {
  it("publishes a custom proposal, dynamic focus, and non-mutating preview together", () => {
    const store = createAppStore();
    const committedBefore = store.getSnapshot().document;
    const proposal = store.createProposal(customProposal);
    expect(store.getSnapshot()).toMatchObject({
      proposal: { id: proposal.id, title: "Custom mobile proposal" },
      selectedLayer: "headline",
      selectedChange: proposal.changes[0].id,
      previewDocument: {
        layouts: { mobile: { headline: "Custom\nmobile headline" } },
      },
    });
    expect(committedBefore).toBeNull();
    expect(store.getSnapshot().document?.layouts.mobile.headline).toBe(
      "Make room for what comes next.",
    );
  });

  it("publishes deeply immutable proposal and history snapshots", () => {
    const store = createAppStore();
    const proposal = store.createProposal(customProposal);
    const active = store.getSnapshot();
    expect(Object.isFrozen(active.proposal?.changes[0].operation)).toBe(true);
    store.setApproval(proposal.changes[0].id, true);
    store.applyFromUi();
    const history = store.getSnapshot().reviewHistory[0];
    expect(Object.isFrozen(history.changes[0])).toBe(true);
    expect(Object.isFrozen(history.approvedChangeIds)).toBe(true);
  });
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
    const proposal = store.propose("adapt");
    const image = proposal.changes.find((change) => change.target === "image")!;
    store.selectLayer("image");
    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "image",
      selectedChange: image.id,
    });
  });

  it("prefers an unresolved related change when a layer has several", () => {
    const store = createAppStore();
    const proposal = store.createProposal({
      expectedRevision: 1,
      title: "Responsive headline review",
      objective: "Review both headline layouts.",
      changes: [
        {
          target: "headline",
          operation: {
            kind: "set_text",
            canvas: "mobile",
            value: "Mobile headline",
          },
          rationale: "Balance the mobile line length.",
        },
        {
          target: "headline",
          operation: {
            kind: "set_text",
            canvas: "desktop",
            value: "Desktop headline",
          },
          rationale: "Balance the desktop line length.",
        },
      ],
    });
    store.setApproval(proposal.changes[0].id, true);

    store.selectLayer("headline");

    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "headline",
      selectedChange: proposal.changes[1].id,
    });
  });

  it("publishes a proposal and its focus as one coherent update", () => {
    const store = createAppStore();
    const snapshots: ReturnType<typeof store.getSnapshot>[] = [];
    const unsubscribe = store.subscribe(() =>
      snapshots.push(store.getSnapshot()),
    );
    const proposal = store.propose("adapt");
    unsubscribe();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      proposal: { id: proposal.id },
      selectedLayer: "headline",
      selectedChange: proposal.changes[0].id,
    });
  });

  it("selects a change and its affected layer together", () => {
    const store = createAppStore();
    const proposal = store.propose("adapt");
    const logo = proposal.changes.find((change) => change.target === "logo")!;
    store.selectChange(logo.id);
    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "logo",
      selectedChange: logo.id,
    });
  });

  it("records an individual rejection without changing the document", () => {
    const store = createAppStore();
    const proposal = store.propose("adapt");
    const initial = store.getSnapshot().document;
    store.rejectChange(proposal.changes[0].id);
    expect(store.getSnapshot().proposal?.changes[0].decision).toBe("rejected");
    expect(store.getSnapshot().document).toEqual(initial);
  });

  it("preserves proposal focus when undo has no committed history", () => {
    const store = createAppStore();
    const proposal = store.propose("adapt");
    const result = store.undo();
    expect(result.changed).toBe(false);
    expect(store.getSnapshot()).toMatchObject({
      selectedLayer: "headline",
      selectedChange: proposal.changes[0].id,
      proposal: { id: proposal.id },
    });
  });

  it("clears proposal focus only after a successful apply", () => {
    const store = createAppStore();
    const proposal = store.propose("adapt");
    store.setApproval(proposal.changes[0].id, true);
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
    const proposal = store.propose("adapt");
    store.setApproval(proposal.changes[0].id, true);
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
