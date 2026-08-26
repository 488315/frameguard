import { expect, test } from "vitest";
import { createAppStore } from "../app/store";
import { serializeReceipt } from "./receipt";

test("serializes a deterministic secret-free review receipt", () => {
  const store = createAppStore();
  expect(serializeReceipt(store)).toBe(serializeReceipt(store));
  const receipt = serializeReceipt(store);
  expect(receipt).toContain('"product": "FrameGuard"');
  expect(receipt).not.toMatch(/secret|token|process|environment|password/i);
});
