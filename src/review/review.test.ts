import { describe, expect, it } from "vitest";
import { createInitialDocument } from "../editor/document";
import { applyChange } from "./operations";
import {
  createReviewAuthority,
  ProposalValidationError,
  type ProposalInput,
} from "./review";

const deterministicIds = () => {
  let proposal = 0;
  let change = 0;
  return {
    proposalId: () => `proposal-${++proposal}`,
    changeId: () => `change-${++change}`,
  };
};

const headlineChange = (value = "A quieter\nmobile headline.") => ({
  target: "headline" as const,
  operation: { kind: "set_text" as const, canvas: "mobile" as const, value },
  rationale: "Balance the narrow measure.",
});

const imageChange = (value = "72% center") => ({
  target: "image" as const,
  operation: {
    kind: "set_image_position" as const,
    canvas: "mobile" as const,
    value,
  },
  rationale: "Keep the subject in frame.",
});

const proposalInput = (
  changes: ProposalInput["changes"] = [headlineChange(), imageChange()],
): ProposalInput => ({
  expectedRevision: 1,
  title: "Editorial mobile pass",
  objective: "Improve the mobile composition.",
  changes,
});

describe("review authority", () => {
  it("starts without an authoritative workspace", () => {
    expect(createReviewAuthority().getState()).toEqual({
      document: null,
      proposal: null,
      canUndo: false,
      modifiedElements: [],
      reviewHistory: [],
    });
  });

  it("creates arbitrary typed changes with deterministic scoped IDs", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const proposal = review.createProposal(proposalInput());
    expect(proposal).toMatchObject({
      id: "proposal-1",
      title: "Editorial mobile pass",
      objective: "Improve the mobile composition.",
      baseRevision: 1,
      status: "active",
      changes: [
        {
          id: "change-1",
          before: "Make room for what comes next.",
          proposed: "A quieter\nmobile headline.",
          applicable: true,
          decision: "pending",
        },
        {
          id: "change-2",
          before: "center",
          proposed: "72% center",
          applicable: true,
          decision: "pending",
        },
      ],
    });
    expect(review.getState().document).toMatchObject({ revision: 1 });
  });

  it("generates a new proposal and change identity for each generation", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const first = review.createProposal(proposalInput([headlineChange()]));
    review.reject();
    const second = review.createProposal(proposalInput([imageChange()]));
    expect(second.id).not.toBe(first.id);
    expect(second.changes[0].id).not.toBe(first.changes[0].id);
  });

  it.each([
    ["title", { title: "" }, "Title is required"],
    ["objective", { objective: "" }, "Objective is required"],
    ["changes", { changes: [] }, "Add at least one proposed change"],
  ])(
    "rejects invalid %s without provisioning a workspace",
    (_field, override, message) => {
      const review = createReviewAuthority();
      expect(() =>
        review.createProposal({ ...proposalInput(), ...override }),
      ).toThrow(message);
      expect(review.getState()).toMatchObject({
        document: null,
        proposal: null,
      });
    },
  );

  it("rejects malformed and unexpectedly shaped changes", () => {
    const review = createReviewAuthority();
    const malformed = {
      ...proposalInput(),
      changes: [{ ...headlineChange(), approved: true }],
    };
    expect(() => review.createProposal(malformed as never)).toThrow(
      ProposalValidationError,
    );
  });

  it("rejects unsupported operations and wrong target-operation combinations", () => {
    const unsupported = createReviewAuthority();
    expect(() =>
      unsupported.createProposal({
        ...proposalInput(),
        changes: [
          {
            target: "headline",
            operation: { kind: "execute_css", canvas: "mobile", value: "*{}" },
            rationale: "No",
          },
        ],
      } as never),
    ).toThrow("Operation is not supported");

    const mismatch = createReviewAuthority();
    try {
      mismatch.createProposal({
        ...proposalInput(),
        changes: [
          {
            target: "image",
            operation: { kind: "set_text", canvas: "mobile", value: "No" },
            rationale: "Wrong target",
          },
        ],
      });
      throw new Error("Expected target-operation validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ProposalValidationError);
      expect((error as ProposalValidationError).issues).toEqual([
        {
          path: "changes.0.operation.kind",
          message: "Replace text is not supported for image",
        },
      ]);
    }
    expect(mismatch.getState().document).toBeNull();
  });

  it("reports invalid operation values at the exact proposal field", () => {
    const review = createReviewAuthority();
    try {
      review.createProposal({
        ...proposalInput(),
        changes: [
          {
            target: "image",
            operation: {
              kind: "set_image_position",
              canvas: "mobile",
              value: "somewhere interesting",
            },
            rationale: "Shift the focal point.",
          },
        ],
      });
      throw new Error("Expected proposal validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ProposalValidationError);
      expect((error as ProposalValidationError).issues).toEqual([
        {
          path: "changes.0.operation.value",
          message:
            "Image position must be center, left center, right center, or 0%-100% center",
        },
      ]);
    }
    expect(review.getState()).toMatchObject({ document: null, proposal: null });
  });

  it("fails proposal creation closed when the inspected revision is stale", () => {
    const review = createReviewAuthority();
    expect(() =>
      review.createProposal({ ...proposalInput(), expectedRevision: 4 }),
    ).toThrow("current revision is 1");
    expect(review.getState()).toMatchObject({ document: null, proposal: null });
  });

  it("derives base revision and before values from the committed document", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const document = createInitialDocument();
    document.revision = 7;
    document.layouts.mobile.headline = "Authoritative headline";
    review.loadDocument(document);
    const proposal = review.createProposal({
      ...proposalInput([headlineChange("Proposed headline")]),
      expectedRevision: 7,
    });
    expect(proposal.baseRevision).toBe(7);
    expect(proposal.changes[0].before).toBe("Authoritative headline");
  });

  it("records a protected target as blocked and refuses its approval", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const proposal = review.createProposal(
      proposalInput([
        headlineChange(),
        {
          target: "logo",
          operation: {
            kind: "set_text",
            canvas: "mobile",
            value: "Move logo into image",
          },
          rationale: "Attempt a protected mutation.",
        },
      ]),
    );
    expect(proposal.changes[1]).toMatchObject({
      target: "logo",
      applicable: false,
      blockedReason: "Logo is protected",
      decision: "pending",
    });
    expect(() => review.setApproval(proposal.changes[1].id, true)).toThrow(
      "Logo is protected",
    );
  });

  it("rejects a proposal containing only no-op operations", () => {
    const review = createReviewAuthority();
    review.loadDocument(createInitialDocument());
    expect(() =>
      review.createProposal(
        proposalInput([headlineChange("Make room for what comes next.")]),
      ),
    ).toThrow("no actionable changes");
    expect(review.getState()).toMatchObject({
      document: { revision: 1 },
      proposal: null,
    });
  });

  it("derives a selected proposal preview without mutating committed state", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const initial = createInitialDocument();
    review.loadDocument(initial);
    const proposal = review.createProposal(proposalInput());
    expect(
      review.preview(proposal.changes[0].id)?.layouts.mobile.headline,
    ).toBe("A quieter\nmobile headline.");
    expect(review.getState().document).toEqual(initial);
  });

  it("tracks explicit partial decisions without mutating committed state", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const proposal = review.createProposal(proposalInput());
    const initial = review.getState().document;
    review.setApproval(proposal.changes[0].id, true);
    review.rejectChange(proposal.changes[1].id);
    expect(
      review.getState().proposal?.changes.map((change) => change.decision),
    ).toEqual(["approved", "rejected"]);
    expect(review.getState().document).toEqual(initial);
  });

  it("applies approved operations atomically and rejects a second apply", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const proposal = review.createProposal(proposalInput());
    proposal.changes.forEach((change) => review.setApproval(change.id, true));
    expect(review.apply()).toMatchObject({
      document: {
        revision: 2,
        layouts: {
          mobile: {
            headline: "A quieter\nmobile headline.",
            imagePosition: "72% center",
          },
        },
      },
      modifiedElements: ["headline", "image"],
      proposal: null,
    });
    expect(() => review.apply()).toThrow("No active proposal");
  });

  it("rolls back the complete transaction when a later operation fails", () => {
    let count = 0;
    const review = createReviewAuthority({
      idFactory: deterministicIds(),
      applyOperation(document, change) {
        count += 1;
        if (count === 2) throw new Error("Synthetic operation failure");
        applyChange(document, change);
      },
    });
    const proposal = review.createProposal(proposalInput());
    proposal.changes.forEach((change) => review.setApproval(change.id, true));
    const committed = review.getState().document;
    expect(() => review.apply()).toThrow("Synthetic operation failure");
    expect(review.getState()).toMatchObject({
      document: committed,
      proposal: { id: proposal.id },
      canUndo: false,
    });
  });

  it("fails a stale apply without document mutation", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    const proposal = review.createProposal(proposalInput([headlineChange()]));
    review.setApproval(proposal.changes[0].id, true);
    review.__testOnlyAdvanceRevision();
    expect(() => review.apply()).toThrow("stale");
    expect(review.getState().document?.layouts.mobile.headline).toBe(
      "Make room for what comes next.",
    );
  });

  it("rejects without mutation and undo restores the exact prior document", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    review.loadDocument(createInitialDocument());
    const rejected = review.createProposal(proposalInput([headlineChange()]));
    const initial = review.getState().document;
    review.reject();
    expect(review.getState().document).toEqual(initial);

    const applied = review.createProposal(proposalInput([headlineChange()]));
    review.setApproval(applied.changes[0].id, true);
    review.apply();
    expect(review.undo()).toEqual({ changed: true, document: initial });
    expect(rejected.id).not.toBe(applied.id);
  });

  it("records deterministic applied and rejected review history", () => {
    const review = createReviewAuthority({ idFactory: deterministicIds() });
    review.loadDocument(createInitialDocument());
    const first = review.createProposal(proposalInput([headlineChange()]));
    review.rejectChange(first.changes[0].id);
    review.reject();
    const second = review.createProposal(proposalInput([imageChange()]));
    review.setApproval(second.changes[0].id, true);
    const state = review.apply();
    expect(state.reviewHistory).toMatchObject([
      {
        proposalId: "proposal-1",
        outcome: "rejected",
        resultingRevision: null,
        rejectedChangeIds: ["change-1"],
      },
      {
        proposalId: "proposal-2",
        outcome: "applied",
        resultingRevision: 2,
        approvedChangeIds: ["change-2"],
      },
    ]);
  });
});
