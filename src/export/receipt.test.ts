import { expect, test } from "vitest";
import { createAppStore } from "../app/store";
import { auditDocument, createInitialDocument } from "../editor/document";
import { serializeReceipt } from "./receipt";

test("serializes a deterministic secret-free review receipt", () => {
  const store = createAppStore();
  const receipt = serializeReceipt(store);
  expect(JSON.parse(receipt)).toEqual({
    product: "FrameGuard",
    revision: 1,
    document: createInitialDocument(),
    activeProposal: null,
    audit: auditDocument(createInitialDocument()),
  });
  expect(receipt).toBe(serializeReceipt(store));
  expect(receipt).toContain('"product": "FrameGuard"');
  expect(receipt).not.toMatch(/secret|token|process|environment|password/i);
});
