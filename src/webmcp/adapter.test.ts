import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "../app/store";
import type { ProposalInput } from "../review/review";
import { createReviewTools, createStaticTools, installWebMcp } from "./adapter";

const structuredInput = {
  expectedRevision: 1,
  title: "Agent mobile pass",
  objective: "Improve mobile balance without changing protected branding.",
  changes: [
    {
      target: "headline",
      operation: {
        kind: "set_text",
        canvas: "mobile",
        value: "Agent supplied\nheadline",
      },
      rationale: "Improve the line break.",
    },
    {
      target: "logo",
      operation: {
        kind: "set_text",
        canvas: "mobile",
        value: "Move logo",
      },
      rationale: "Attempt a protected change.",
    },
  ],
} satisfies ProposalInput;

const tool = (tools: ReturnType<typeof createStaticTools>, name: string) =>
  tools.find((candidate) => candidate.name === name)!;

describe("WebMCP adapter", () => {
  it("exposes structured proposal creation and compatibility through one store", () => {
    const names = createStaticTools(createAppStore()).map((item) => item.name);
    expect(names).toEqual([
      "inspect_document",
      "create_proposal",
      "propose_adaptation",
      "undo_last_change_set",
      "export_review_receipt",
    ]);
  });

  it("declares an exact bounded structured proposal schema", () => {
    const schema = tool(createStaticTools(createAppStore()), "create_proposal")
      .inputSchema as Record<string, unknown>;
    expect(schema).toMatchObject({
      type: "object",
      required: ["expectedRevision", "title", "objective", "changes"],
      additionalProperties: false,
      properties: {
        expectedRevision: { type: "integer", minimum: 1 },
        title: { type: "string", minLength: 1, maxLength: 120 },
        objective: { type: "string", minLength: 1, maxLength: 500 },
        changes: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: {
            type: "object",
            required: ["target", "operation", "rationale"],
            additionalProperties: false,
          },
        },
      },
    });
  });

  it("creates arbitrary visible proposals through the production store", async () => {
    const store = createAppStore();
    await tool(createStaticTools(store), "create_proposal").execute(
      structuredInput,
    );
    expect(store.getSnapshot()).toMatchObject({
      proposal: {
        title: "Agent mobile pass",
        changes: [
          { proposed: "Agent supplied\nheadline", applicable: true },
          {
            target: "logo",
            applicable: false,
            blockedReason: "Logo is protected",
          },
        ],
      },
      activity: { tool: "create_proposal" },
    });
  });

  it.each([
    [{ ...structuredInput, extra: true }, "Unexpected input field"],
    [{ ...structuredInput, expectedRevision: 9 }, "current revision is 1"],
    [{ ...structuredInput, title: "" }, "Title is required"],
    [{ ...structuredInput, objective: "" }, "Objective is required"],
    [{ ...structuredInput, changes: [] }, "Add at least one"],
    [
      {
        ...structuredInput,
        changes: [{ ...structuredInput.changes[0], extra: true }],
      },
      "Unexpected input field",
    ],
  ])("rejects malformed structured proposal input", async (input, message) => {
    const store = createAppStore();
    await expect(
      tool(createStaticTools(store), "create_proposal").execute(input),
    ).rejects.toThrow(message);
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
    });
  });

  it("builds approval guidance from the current applicable change IDs", async () => {
    const store = createAppStore();
    await tool(createStaticTools(store), "create_proposal").execute(
      structuredInput,
    );
    const applicable = store
      .getSnapshot()
      .proposal!.changes.filter((change) => change.applicable);
    const approval = createReviewTools(store).find(
      (item) => item.name === "set_change_approval",
    )!;
    expect(approval.inputSchema).toMatchObject({
      properties: { changeId: { enum: applicable.map((change) => change.id) } },
    });
    await expect(
      approval.execute({ changeId: "old-change-id", approved: true }),
    ).rejects.toThrow("applicable change");
    await approval.execute({ changeId: applicable[0].id, approved: true });
    expect(store.getSnapshot().proposal?.changes[0].decision).toBe("approved");
  });

  it("requires and consumes one human authorization for agent apply", async () => {
    const store = createAppStore();
    const proposal = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    store.setApproval(proposal.changes[0].id, true);
    const apply = createReviewTools(store).find(
      (item) => item.name === "apply_approved_changes",
    )!;
    await expect(apply.execute({})).rejects.toThrow("Human authorization");
    store.authorizeAgentApply();
    await expect(apply.execute({})).resolves.toBeDefined();
    await expect(apply.execute({})).rejects.toThrow("Human authorization");
  });

  it("aborts old review registrations and registers new dynamic IDs", async () => {
    const registered: Array<{
      name: string;
      schema: Record<string, unknown>;
      signal?: AbortSignal;
    }> = [];
    document.modelContext = {
      registerTool: vi.fn(async (registeredTool, options) => {
        registered.push({
          name: registeredTool.name,
          schema: registeredTool.inputSchema,
          signal: options?.signal,
        });
      }),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    await vi.waitFor(() =>
      expect(store.getSnapshot().webMcpAvailable).toBe(true),
    );
    const first = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    await vi.waitFor(() =>
      expect(
        registered.filter((item) => item.name === "set_change_approval"),
      ).toHaveLength(1),
    );
    const firstApproval = registered.find(
      (item) => item.name === "set_change_approval",
    )!;
    store.reject();
    const second = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    await vi.waitFor(() =>
      expect(
        registered.filter((item) => item.name === "set_change_approval"),
      ).toHaveLength(2),
    );
    const approvals = registered.filter(
      (item) => item.name === "set_change_approval",
    );
    expect(firstApproval.signal?.aborted).toBe(true);
    expect(approvals[0].schema).not.toEqual(approvals[1].schema);
    expect(first.id).not.toBe(second.id);
    cleanup();
    delete document.modelContext;
  });

  it("keeps the UI usable when WebMCP registration fails", async () => {
    document.modelContext = {
      registerTool: vi.fn(async () => {
        throw new Error("registration failed");
      }),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    await vi.waitFor(() =>
      expect(store.getSnapshot().activity?.result).toBe("registration failed"),
    );
    expect(store.getSnapshot().webMcpAvailable).toBe(false);
    expect(() => store.propose("UI remains usable")).not.toThrow();
    cleanup();
    delete document.modelContext;
  });
});
