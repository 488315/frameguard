import { expect, test } from "vitest";
import { createAppStore } from "../app/store";
import { auditDocument, createInitialDocument } from "../editor/document";
import { serializeReceipt } from "./receipt";

test("refuses to export an empty workspace", () => {
  expect(() => serializeReceipt(createAppStore())).toThrow(
    "No workspace loaded",
  );
});

test("serializes a deterministic secret-free review receipt", () => {
  const store = createAppStore();
  store.propose("adapt");
  store.reject();
  const receipt = serializeReceipt(store);
  expect(JSON.parse(receipt)).toEqual({
    product: "FrameGuard",
    revision: 1,
    document: createInitialDocument(),
    audit: auditDocument(createInitialDocument()),
  });
  expect(receipt).toBe(serializeReceipt(store));
  expect(receipt).toContain('"product": "FrameGuard"');
  expect(receipt).not.toMatch(/secret|token|process|environment|password/i);
});

test("excludes unapproved proposal data from the committed-state receipt", () => {
  const store = createAppStore();
  store.propose("private draft objective");
  const receipt = serializeReceipt(store);
  expect(receipt).not.toContain("private draft objective");
  expect(receipt).not.toContain("activeProposal");
});
