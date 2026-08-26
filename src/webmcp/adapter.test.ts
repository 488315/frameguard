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

  it("does not let a stale review failure abort a newer proposal generation", async () => {
    const pending: Array<{
      name: string;
      signal?: AbortSignal;
      reject: (error: Error) => void;
    }> = [];
    document.modelContext = {
      registerTool: vi.fn((tool, options) => {
        if (
          !options?.signal ||
          tool.name === "inspect_document" ||
          tool.name === "propose_adaptation" ||
          tool.name === "undo_last_change_set" ||
          tool.name === "export_review_receipt"
        )
          return Promise.resolve();
        return new Promise<void>((_resolve, reject) => {
          pending.push({ name: tool.name, signal: options.signal, reject });
        });
      }),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    store.propose("Proposal A");
    const firstSignal = pending[0].signal!;
    store.reject();
    store.propose("Proposal B");
    const secondSignal = pending[3].signal!;
    pending[0].reject(new Error("stale registration failed"));
    await Promise.resolve();
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
    cleanup();
    delete document.modelContext;
  });

  it("does not let late static success mask an active review failure", async () => {
    let resolveStatic!: () => void;
    const staticGate = new Promise<void>((resolve) => {
      resolveStatic = resolve;
    });
    document.modelContext = {
      registerTool: vi.fn((tool) =>
        tool.name === "set_change_approval"
          ? Promise.reject(new Error("review registration failed"))
          : staticGate,
      ),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    store.propose("Adapt");
    await vi.waitFor(() =>
      expect(store.getSnapshot().activity?.result).toBe(
        "review registration failed",
      ),
    );
    resolveStatic();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.getSnapshot().webMcpAvailable).toBe(false);
    cleanup();
    delete document.modelContext;
  });
});
