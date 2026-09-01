import { describe, expect, it } from "vitest";
import { createAppStore } from "../app/store";
import type { ProposalInput } from "../review/review";
import { createContextualTools, createStaticTools } from "./adapter";
import type { WebMcpTool } from "./types";

const findTool = (tools: WebMcpTool[], name: string) => {
  const result = tools.find((candidate) => candidate.name === name);
  if (!result) throw new Error(`Expected available tool: ${name}`);
  return result;
};

const parseToolResult = (result: Awaited<ReturnType<WebMcpTool["execute"]>>) =>
  JSON.parse(result.content[0].text) as Record<string, unknown>;

const proposalInput = {
  expectedRevision: 1,
  title: "Mobile launch review",
  objective:
    "Improve the narrow composition without changing protected branding.",
  changes: [
    {
      target: "headline",
      operation: {
        kind: "set_text",
        canvas: "mobile",
        value: "Make room for the next chapter.",
      },
      rationale: "Use a deliberate mobile line break.",
    },
    {
      target: "image",
      operation: {
        kind: "set_image_position",
        canvas: "mobile",
        value: "72% center",
      },
      rationale: "Keep the subject visible in the narrow crop.",
    },
    {
      target: "logo",
      operation: {
        kind: "set_text",
        canvas: "mobile",
        value: "Move logo",
      },
      rationale: "Verify protected branding remains blocked.",
    },
  ],
} satisfies ProposalInput;

describe("executable WebMCP evaluation cases", () => {
  it("completes the documented inspect, propose, approve, authorize, apply, undo, and export sequence", async () => {
    const store = createAppStore();
    const empty = parseToolResult(
      await findTool(createStaticTools(store), "inspect_document").execute({}),
    );
    expect(empty).toMatchObject({
      workspaceLoaded: false,
      agentApply: { authorized: false, canApply: false },
    });

    await findTool(createContextualTools(store), "create_proposal").execute(
      proposalInput,
    );
    const proposal = store.getSnapshot().proposal!;
    expect(proposal.changes).toMatchObject([
      { target: "headline", applicable: true },
      { target: "image", applicable: true },
      { target: "logo", applicable: false },
    ]);

    for (const change of proposal.changes.filter((item) => item.applicable)) {
      await findTool(
        createContextualTools(store),
        "set_change_approval",
      ).execute({ changeId: change.id, approved: true });
    }
    expect(
      createContextualTools(store).map((candidate) => candidate.name),
    ).not.toContain("apply_approved_changes");

    store.authorizeAgentApply();
    const authorized = parseToolResult(
      await findTool(createStaticTools(store), "inspect_document").execute({}),
    );
    expect(authorized).toMatchObject({
      agentApply: {
        authorized: true,
        hasApprovedChanges: true,
        canApply: true,
      },
    });
    await findTool(
      createContextualTools(store),
      "apply_approved_changes",
    ).execute({});
    expect(store.getSnapshot()).toMatchObject({
      document: {
        revision: 2,
        layouts: {
          mobile: {
            headline: "Make room for the next chapter.",
            imagePosition: "72% center",
          },
        },
        elements: { logo: { label: "Logo", protected: true } },
      },
      proposal: null,
    });

    await findTool(
      createContextualTools(store),
      "undo_last_change_set",
    ).execute({});
    expect(store.getSnapshot().document?.revision).toBe(1);

    const receipt = parseToolResult(
      await findTool(
        createContextualTools(store),
        "export_review_receipt",
      ).execute({}),
    );
    expect(receipt).toMatchObject({
      product: "FrameGuard",
      revision: 1,
      reviewHistory: [{ outcome: "applied" }],
    });
  });

  it("keeps the exact proposal and compatibility tools distinguishable", () => {
    const tools = createContextualTools(createAppStore());
    expect(findTool(tools, "create_proposal").description).toContain(
      "caller-specified edits",
    );
    expect(findTool(tools, "propose_adaptation").description).toContain(
      "predefined three-change demo",
    );
  });
});
