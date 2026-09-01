import { expect, test } from "vitest";
import { createAppStore } from "../app/store";
import { auditDocument, createInitialDocument } from "../editor/document";
import { createTestProposal } from "../test/proposal";
import { serializeReceipt } from "./receipt";

test("refuses to export an empty workspace", () => {
  expect(() => serializeReceipt(createAppStore())).toThrow(
    "No workspace loaded",
  );
});

test("serializes a deterministic secret-free review receipt", () => {
  const store = createAppStore();
  store.importLayout(JSON.stringify(createInitialDocument()));
  const receipt = serializeReceipt(store);
  expect(JSON.parse(receipt)).toEqual({
    product: "FrameGuard",
    revision: 1,
    document: createInitialDocument(),
    audit: auditDocument(createInitialDocument()),
    reviewHistory: [],
  });
  expect(receipt).toBe(serializeReceipt(store));
  expect(receipt).toContain('"product": "FrameGuard"');
  expect(receipt).not.toMatch(/secret|token|process|environment|password/i);
});

test("excludes unapproved proposal data from the committed-state receipt", () => {
  const store = createAppStore();
  createTestProposal(store, "private draft objective");
  const receipt = serializeReceipt(store);
  expect(receipt).not.toContain("private draft objective");
  expect(receipt).not.toContain("activeProposal");
});

test("records the proposal, human decisions, blocked changes, and resulting revision", () => {
  const store = createAppStore();
  const proposal = createTestProposal(
    store,
    "Prepare a controlled mobile pass",
  );
  store.setApproval(proposal.changes[0].id, true);
  store.rejectChange(proposal.changes[1].id);
  store.applyFromUi();
  const receipt = JSON.parse(serializeReceipt(store));
  expect(receipt.reviewHistory).toMatchObject([
    {
      proposalId: proposal.id,
      title: "Mobile adaptation",
      objective: "Prepare a controlled mobile pass",
      baseRevision: 1,
      resultingRevision: 2,
      outcome: "applied",
      approvedChangeIds: [proposal.changes[0].id],
      rejectedChangeIds: [proposal.changes[1].id],
      blockedChangeIds: [proposal.changes[2].id],
    },
  ]);
});
