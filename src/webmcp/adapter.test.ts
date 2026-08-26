import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "../app/store";
import { createReviewTools, createStaticTools, installWebMcp } from "./adapter";

describe("WebMCP adapter", () => {
  it("defines the exact static and proposal-only tool surfaces", () => {
    const store = createAppStore();
    expect(createStaticTools(store).map((tool) => tool.name)).toEqual([
      "inspect_document",
      "propose_adaptation",
      "undo_last_change_set",
      "export_review_receipt",
    ]);
    expect(createReviewTools(store).map((tool) => tool.name)).toEqual([
      "set_change_approval",
      "apply_approved_changes",
      "reject_change_set",
    ]);
    expect(createReviewTools(store)[0].inputSchema).toEqual({
      type: "object",
      properties: {
        changeId: { type: "string", enum: ["headline-reflow", "image-crop"] },
        approved: { type: "boolean" },
      },
      required: ["changeId", "approved"],
      additionalProperties: false,
    });
  });

  it("routes calls through the production store and updates visible activity", async () => {
    const store = createAppStore();
    const proposal = createStaticTools(store).find(
      (tool) => tool.name === "propose_adaptation",
    )!;
    await proposal.execute({ objective: "Adapt this for mobile" });
    expect(store.getSnapshot().proposal).not.toBeNull();
    expect(store.getSnapshot().activity?.tool).toBe("propose_adaptation");
  });

  it("rejects undeclared fields and requires a human authorization before agent apply", async () => {
    const store = createAppStore();
    const staticTools = createStaticTools(store);
    await expect(
      staticTools
        .find((tool) => tool.name === "inspect_document")!
        .execute({ extra: true }),
    ).rejects.toThrow("Unexpected input field");
    await staticTools
      .find((tool) => tool.name === "propose_adaptation")!
      .execute({ objective: "Adapt" });
    store.setApproval("headline-reflow", true);
    const apply = createReviewTools(store).find(
      (tool) => tool.name === "apply_approved_changes",
    )!;
    await expect(apply.execute({})).rejects.toThrow(
      "Human authorization required",
    );
    store.authorizeAgentApply();
    await expect(apply.execute({})).resolves.toBeDefined();
  });

  it("registers static tools and lifecycle-removes review tools", async () => {
    const registered: Array<{ name: string; signal?: AbortSignal }> = [];
    document.modelContext = {
      registerTool: vi.fn(async (tool, options) => {
        registered.push({ name: tool.name, signal: options?.signal });
      }),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    await vi.waitFor(() =>
      expect(store.getSnapshot().webMcpAvailable).toBe(true),
    );
    store.propose("Adapt");
    await vi.waitFor(() => expect(registered).toHaveLength(7));
    const reviewSignal = registered[4].signal!;
    store.reject();
    expect(reviewSignal.aborted).toBe(true);
    cleanup();
    delete document.modelContext;
  });
});
