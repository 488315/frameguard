import { describe, expect, it } from "vitest";
import { createInitialDocument } from "../editor/document";
import { createReviewAuthority } from "./review";

describe("review authority", () => {
  it("starts without an authoritative workspace", () => {
    expect(createReviewAuthority().getState()).toMatchObject({
      document: null,
      proposal: null,
      canUndo: false,
      modifiedElements: [],
    });
  });

  it("creates two applicable changes and one visible blocked logo change", () => {
    const review = createReviewAuthority();
    const proposal = review.propose("Adapt the launch page for mobile");
    expect(
      proposal.changes.map(({ id, applicable }) => ({ id, applicable })),
    ).toEqual([
      { id: "headline-reflow", applicable: true },
      { id: "image-crop", applicable: true },
      { id: "logo-move", applicable: false },
    ]);
  });

  it("rejects approval of the protected logo", () => {
    const review = createReviewAuthority();
    review.propose("adapt");
    expect(() => review.setApproval("logo-move", true)).toThrow("protected");
  });

  it("derives protected mutations from the authoritative layer model", () => {
    const proposal = createReviewAuthority().propose("adapt");
    expect(
      proposal.changes.find((change) => change.id === "logo-move"),
    ).toMatchObject({
      target: "logo",
      kind: "move",
      applicable: false,
      blockedReason: "Logo is protected",
    });
  });

  it("tracks an explicit rejected decision without approving or mutating", () => {
    const review = createReviewAuthority();
    review.propose("adapt");
    const initial = review.getState().document;
    const proposal = review.rejectChange("headline-reflow");
    expect(proposal.changes[0]).toMatchObject({
      approved: false,
      rejected: true,
    });
    expect(review.getState().document).toEqual(initial);
  });

  it("applies selected allowed changes atomically and does not apply twice", () => {
    const review = createReviewAuthority();
    review.propose("adapt");
    review.setApproval("headline-reflow", true);
    review.setApproval("image-crop", true);
    expect(review.apply().document).toMatchObject({
      revision: 2,
      layouts: {
        mobile: {
          headline: "Make room for\nwhat comes next.",
          imagePosition: "68% center",
        },
      },
    });
    expect(() => review.apply()).toThrow("No active proposal");
    expect(review.getState().document?.revision).toBe(2);
  });

  it("reports only layers changed by the committed change set", () => {
    const review = createReviewAuthority();
    expect(review.getState().modifiedElements).toEqual([]);
    review.propose("adapt");
    review.setApproval("headline-reflow", true);
    expect(review.apply().modifiedElements).toEqual(["headline"]);
    review.undo();
    expect(review.getState().modifiedElements).toEqual([]);
  });

  it("commits only real document differences and rejects a no-op apply", () => {
    const review = createReviewAuthority();
    review.propose("adapt");
    review.setApproval("headline-reflow", true);
    review.apply();

    review.propose("adapt again");
    review.setApproval("headline-reflow", true);
    review.setApproval("image-crop", true);
    expect(review.apply()).toMatchObject({
      document: { revision: 3 },
      modifiedElements: ["image"],
    });

    review.propose("adapt once more");
    review.setApproval("headline-reflow", true);
    expect(() => review.apply()).toThrow(
      "Approved changes do not modify the document",
    );
    expect(review.getState()).toMatchObject({
      document: { revision: 3 },
      proposal: { baseRevision: 3 },
      modifiedElements: ["image"],
    });
  });

  it("does not mutate with zero approvals or a stale base revision", () => {
    const empty = createReviewAuthority();
    empty.propose("adapt");
    expect(() => empty.apply()).toThrow("Select at least one");
    expect(empty.getState().document?.revision).toBe(1);
    const stale = createReviewAuthority();
    stale.propose("adapt");
    stale.setApproval("headline-reflow", true);
    stale.__testOnlyAdvanceRevision();
    expect(() => stale.apply()).toThrow("stale");
    expect(stale.getState().document?.layouts.mobile.headline).not.toContain(
      "\n",
    );
  });

  it("rejects without mutation and undo restores the exact prior document", () => {
    const review = createReviewAuthority();
    review.propose("adapt");
    const initial = review.getState().document;
    review.reject();
    expect(review.getState().document).toBeNull();
    expect(review.undo().changed).toBe(false);
    review.propose("adapt");
    review.setApproval("headline-reflow", true);
    review.apply();
    expect(review.undo()).toEqual({ changed: true, document: initial });
    expect(review.undo().changed).toBe(false);
  });

  it("keeps document protection outside the proposal lifecycle", () => {
    const review = createReviewAuthority();
    review.loadDocument(createInitialDocument());
    review.propose("adapt");
    review.reject();
    expect(review.getState()).toMatchObject({
      proposal: null,
      document: {
        elements: {
          logo: { protected: true },
          legal: { protected: true },
        },
      },
    });
  });

  it("preserves an explicitly loaded workspace when its proposal is rejected", () => {
    const review = createReviewAuthority();
    const imported = createInitialDocument();
    review.loadDocument(imported);
    review.propose("adapt");
    review.reject();
    expect(review.getState().document).toEqual(imported);
  });
});
