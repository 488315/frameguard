import { describe, expect, it, vi } from "vitest";
import { createAppStore } from "../app/store";
import {
  DRAFT_RECOVERY_KEY,
  DRAFT_RECOVERY_OPT_IN_KEY,
  createDraftRecovery,
} from "../recovery/recovery";
import type { ProposalInput } from "../review/review";
import { createTestProposal } from "../test/proposal";
import {
  createContextualTools,
  createReviewTools,
  createStaticTools,
  installWebMcp,
} from "./adapter";
import type { WebMcpTool } from "./types";

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

const tool = (tools: WebMcpTool[], name: string) =>
  tools.find((candidate) => candidate.name === name)!;

describe("WebMCP adapter", () => {
  it("keeps human review decisions outside the agent tool surface", () => {
    const store = createAppStore();
    store.createProposal(structuredInput);

    const names = createContextualTools(store).map((item) => item.name);
    expect(names).toContain("inspect_proposal");
    expect(names).toContain("revise_proposal");
    expect(names).toContain("withdraw_proposal");
    expect(names).not.toContain("set_change_approval");
  });

  it("revises and withdraws proposals through the production store", async () => {
    const store = createAppStore();
    const original = store.createProposal(structuredInput);
    const revisedResult = await tool(
      createContextualTools(store),
      "revise_proposal",
    ).execute({
      proposalId: original.id,
      ...structuredInput,
      title: "Revised mobile review",
    });
    const revised = JSON.parse(revisedResult.content[0].text);
    expect(revised).toMatchObject({ title: "Revised mobile review" });
    expect(revised.id).not.toBe(original.id);

    await tool(createContextualTools(store), "withdraw_proposal").execute({});
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      reviewHistory: [{ proposalId: revised.id, outcome: "withdrawn" }],
    });
  });

  it("exposes only fresh recovered change IDs through proposal inspection", async () => {
    const values = new Map<string, string>([
      [DRAFT_RECOVERY_OPT_IN_KEY, "true"],
    ]);
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    const first = createAppStore({ recovery: createDraftRecovery(storage) });
    const original = first.createProposal(structuredInput);
    const restored = createAppStore({ recovery: createDraftRecovery(storage) });
    const recovered = restored.getSnapshot().proposal!;
    const inspection = await tool(
      createReviewTools(restored),
      "inspect_proposal",
    ).execute({});
    const result = JSON.parse(inspection.content[0].text);
    expect(result.proposal.changes[0].id).toBe(recovered.changes[0].id);
    expect(recovered.changes[0].id).not.toBe(original.changes[0].id);
    expect(inspection.content[0].text).not.toContain(original.changes[0].id);
  });

  it("registers no review tools for a recovery candidate that fails closed", async () => {
    const values = new Map<string, string>([
      [DRAFT_RECOVERY_OPT_IN_KEY, "true"],
      [DRAFT_RECOVERY_KEY, "{"],
    ]);
    const storage: Storage = {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => {
        values.delete(key);
      },
      setItem: (key, value) => {
        values.set(key, value);
      },
    };
    const registered: string[] = [];
    document.modelContext = {
      registerTool: vi.fn(async (registeredTool) => {
        registered.push(registeredTool.name);
      }),
    };
    const store = createAppStore({ recovery: createDraftRecovery(storage) });

    const cleanup = installWebMcp(store);
    await vi.waitFor(() =>
      expect(store.getSnapshot().webMcpAvailable).toBe(true),
    );

    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { tone: "error" },
    });
    expect(registered).toEqual(["inspect_document", "create_proposal"]);
    cleanup();
    delete document.modelContext;
  });

  it("exposes one structured proposal creation tool", () => {
    const store = createAppStore();
    expect(createStaticTools(store).map((item) => item.name)).toEqual([
      "inspect_document",
    ]);
    expect(createContextualTools(store).map((item) => item.name)).toEqual([
      "create_proposal",
    ]);
  });

  it("declares an exact bounded structured proposal schema", () => {
    const schema = tool(
      createContextualTools(createAppStore()),
      "create_proposal",
    ).inputSchema as Record<string, unknown>;
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
    await tool(createContextualTools(store), "create_proposal").execute(
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
      tool(createContextualTools(store), "create_proposal").execute(input),
    ).rejects.toThrow(message);
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
    });
  });

  it("reports policy and human decisions without exposing approval mutation", async () => {
    const store = createAppStore();
    await tool(createContextualTools(store), "create_proposal").execute(
      structuredInput,
    );
    const result = await tool(
      createReviewTools(store),
      "inspect_proposal",
    ).execute({});
    const inspection = JSON.parse(result.content[0].text);
    expect(inspection.policy.permittedChangeIds).toHaveLength(1);
    expect(inspection.review.pendingChangeIds).toHaveLength(2);
    expect(createReviewTools(store).map((item) => item.name)).not.toContain(
      "set_change_approval",
    );
  });

  it("requires and consumes one human authorization for agent apply", async () => {
    const store = createAppStore();
    const proposal = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    store.setApproval(proposal.changes[0].id, true);
    expect(
      createReviewTools(store).some(
        (item) => item.name === "apply_approved_changes",
      ),
    ).toBe(false);
    store.authorizeAgentApply();
    const apply = createReviewTools(store).find(
      (item) => item.name === "apply_approved_changes",
    )!;
    await expect(apply.execute({})).resolves.toBeDefined();
    await expect(apply.execute({})).rejects.toThrow("AUTHORIZATION_REQUIRED");
  });

  it("exposes authorization state and marks agent-visible content untrusted", async () => {
    const store = createAppStore();
    const proposal = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    store.setApproval(proposal.changes[0].id, true);
    store.authorizeAgentApply();

    const inspect = tool(createStaticTools(store), "inspect_document");
    const result = await inspect.execute({});
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      agentApply: {
        authorized: true,
        hasApprovedChanges: true,
        canApply: true,
      },
    });
    expect(inspect.annotations).toEqual({ untrustedContentHint: true });
    expect(
      createContextualTools(store).every(
        (item) => item.annotations?.untrustedContentHint,
      ),
    ).toBe(true);
  });

  it("registers only tools that can succeed in the current state", () => {
    const store = createAppStore();
    expect(createContextualTools(store).map((item) => item.name)).toEqual([
      "create_proposal",
    ]);
    const proposal = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    expect(createContextualTools(store).map((item) => item.name)).toEqual([
      "export_review_receipt",
      "inspect_proposal",
      "revise_proposal",
      "withdraw_proposal",
    ]);
    store.setApproval(proposal.changes[0].id, true);
    expect(createContextualTools(store).map((item) => item.name)).not.toContain(
      "apply_approved_changes",
    );
    store.authorizeAgentApply();
    expect(createContextualTools(store).map((item) => item.name)).toContain(
      "apply_approved_changes",
    );
    store.applyFromUi();
    expect(createContextualTools(store).map((item) => item.name)).toEqual([
      "create_proposal",
      "undo_last_change_set",
      "export_review_receipt",
    ]);
    store.createProposal({
      ...structuredInput,
      expectedRevision: 2,
      changes: [
        {
          ...structuredInput.changes[0],
          operation: {
            ...structuredInput.changes[0].operation,
            value: "Second review headline",
          },
        },
      ],
    });
    expect(createContextualTools(store).map((item) => item.name)).not.toContain(
      "undo_last_change_set",
    );
  });

  it("aborts old review registrations when proposal identity changes", async () => {
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
        registered.filter((item) => item.name === "inspect_proposal"),
      ).toHaveLength(1),
    );
    const firstInspection = registered.find(
      (item) => item.name === "inspect_proposal",
    )!;
    store.withdrawProposal();
    const second = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    await vi.waitFor(() =>
      expect(
        registered.filter((item) => item.name === "inspect_proposal"),
      ).toHaveLength(2),
    );
    expect(firstInspection.signal?.aborted).toBe(true);
    expect(first.id).not.toBe(second.id);
    cleanup();
    delete document.modelContext;
  });

  it("replaces contextual registrations when agent authorization changes", async () => {
    const registered: Array<{ name: string; signal?: AbortSignal }> = [];
    document.modelContext = {
      registerTool: vi.fn(async (registeredTool, options) => {
        registered.push({
          name: registeredTool.name,
          signal: options?.signal,
        });
      }),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    const proposal = store.createProposal({
      ...structuredInput,
      changes: [structuredInput.changes[0]],
    });
    await vi.waitFor(() =>
      expect(registered.some((item) => item.name === "inspect_proposal")).toBe(
        true,
      ),
    );
    store.setApproval(proposal.changes[0].id, true);
    const proposalRegistration = registered.find(
      (item) => item.name === "inspect_proposal",
    )!;

    store.authorizeAgentApply();
    await vi.waitFor(() =>
      expect(
        registered.some((item) => item.name === "apply_approved_changes"),
      ).toBe(true),
    );

    expect(proposalRegistration.signal?.aborted).toBe(true);
    cleanup();
    delete document.modelContext;
  });

  it("keeps the UI usable when WebMCP registration fails", async () => {
    const attempted: string[] = [];
    document.modelContext = {
      registerTool: vi.fn(async (registeredTool) => {
        attempted.push(registeredTool.name);
        if (registeredTool.name === "inspect_document") {
          throw new Error("registration failed");
        }
      }),
    };
    const store = createAppStore();
    const cleanup = installWebMcp(store);
    await vi.waitFor(() =>
      expect(store.getSnapshot().activity?.result).toBe("registration failed"),
    );
    expect(store.getSnapshot().webMcpAvailable).toBe(false);
    expect(attempted).toEqual(["inspect_document"]);
    expect(() => createTestProposal(store, "UI remains usable")).not.toThrow();
    cleanup();
    delete document.modelContext;
  });
});
