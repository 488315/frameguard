import { auditDocument } from "../editor/document";
import { serializeReceipt } from "../export/receipt";
import type { AppStore } from "../app/store";
import type { ProposalInput } from "../review/review";
import type { ToolResult, WebMcpTool } from "./types";

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const textResult = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

const untrustedOutput = { untrustedContentHint: true } as const;

function assertObject(
  input: unknown,
): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Input must be a JSON object");
  }
}

function assertExactKeys(input: Record<string, unknown>, allowed: string[]) {
  const unexpected = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unexpected.length)
    throw new Error(`Unexpected input field: ${unexpected[0]}`);
}

const proposalInputSchema = {
  type: "object",
  properties: {
    expectedRevision: {
      type: "integer",
      minimum: 1,
      description: "Exact committed revision returned by inspect_document.",
    },
    title: {
      type: "string",
      minLength: 1,
      maxLength: 120,
      description: "Short human-readable name for this review.",
    },
    objective: {
      type: "string",
      minLength: 1,
      maxLength: 500,
      description: "The visual outcome the bounded changes should achieve.",
    },
    changes: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      description: "Exact visual edits to preview for human review.",
      items: {
        type: "object",
        properties: {
          target: {
            type: "string",
            enum: ["logo", "headline", "image", "body", "cta", "legal"],
            description: "Existing FrameGuard element to review.",
          },
          operation: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["set_text", "set_image_position"],
                description: "Typed operation supported by the target element.",
              },
              canvas: {
                type: "string",
                enum: ["desktop", "mobile"],
                description: "Responsive canvas where the edit is previewed.",
              },
              value: {
                type: "string",
                minLength: 1,
                maxLength: 1000,
                description: "Replacement text or CSS image-position value.",
              },
            },
            required: ["kind", "canvas", "value"],
            additionalProperties: false,
          },
          rationale: {
            type: "string",
            minLength: 1,
            maxLength: 300,
            description: "Reason the reviewer should consider this edit.",
          },
        },
        required: ["target", "operation", "rationale"],
        additionalProperties: false,
      },
    },
  },
  required: ["expectedRevision", "title", "objective", "changes"],
  additionalProperties: false,
} as const;

function assertProposalInput(input: Record<string, unknown>): ProposalInput {
  assertExactKeys(input, ["expectedRevision", "title", "objective", "changes"]);
  if (!Array.isArray(input.changes)) {
    throw new Error("changes must be an array");
  }
  input.changes.forEach((rawChange, index) => {
    assertObject(rawChange);
    try {
      assertExactKeys(rawChange, ["target", "operation", "rationale"]);
      assertObject(rawChange.operation);
      assertExactKeys(rawChange.operation, ["kind", "canvas", "value"]);
    } catch (error) {
      throw new Error(
        `Change ${index + 1}: ${error instanceof Error ? error.message : "invalid change"}`,
      );
    }
  });
  return input as unknown as ProposalInput;
}

const afterPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

export function createStaticTools(store: AppStore): WebMcpTool[] {
  return [
    {
      name: "inspect_document",
      title: "Inspect document",
      description:
        "Reads the committed layouts, protection flags, active proposal, and deterministic audit. Optionally narrows layouts to one canvas.",
      inputSchema: {
        type: "object",
        properties: {
          canvas: {
            type: "string",
            enum: ["desktop", "mobile"],
            description:
              "Optional responsive canvas; omit to inspect both canvases.",
          },
        },
        additionalProperties: false,
      },
      annotations: untrustedOutput,
      async execute(input) {
        assertObject(input);
        assertExactKeys(input, ["canvas"]);
        const canvas = input.canvas;
        if (
          canvas !== undefined &&
          canvas !== "desktop" &&
          canvas !== "mobile"
        ) {
          throw new Error("canvas must be desktop or mobile");
        }
        const state = store.inspect();
        const snapshot = store.getSnapshot();
        if (!state.document) {
          store.record("inspect_document", "No workspace loaded");
          await afterPaint();
          return textResult({
            workspaceLoaded: false,
            revision: null,
            starterRevision: 1,
            layouts: {},
            protection: {},
            activeProposal: null,
            agentApply: {
              authorized: false,
              hasApprovedChanges: false,
              canApply: false,
            },
            audit: [],
          });
        }
        const layouts = canvas
          ? { [canvas]: state.document.layouts[canvas] }
          : state.document.layouts;
        store.record(
          "inspect_document",
          `Inspected ${canvas ?? "both canvases"}`,
        );
        await afterPaint();
        const hasApprovedChanges = Boolean(
          state.proposal?.changes.some(
            (change) => change.applicable && change.decision === "approved",
          ),
        );
        return textResult({
          workspaceLoaded: true,
          revision: state.document.revision,
          layouts,
          protection: Object.fromEntries(
            Object.entries(state.document.elements).map(([id, element]) => [
              id,
              element.protected,
            ]),
          ),
          activeProposal: state.proposal,
          agentApply: {
            authorized: snapshot.agentApplyAuthorized,
            hasApprovedChanges,
            canApply: snapshot.agentApplyAuthorized && hasApprovedChanges,
          },
          audit: auditDocument(state.document),
        });
      },
    },
  ];
}

export function createContextualTools(store: AppStore): WebMcpTool[] {
  const state = store.getSnapshot();
  const tools: WebMcpTool[] = [];
  if (!state.proposal) {
    tools.push(
      {
        name: "create_proposal",
        title: "Create proposal",
        description:
          "Creates an exact revision-bound proposal when no review is active. Use this for caller-specified edits; FrameGuard derives before-values, protection, and applicability.",
        inputSchema: proposalInputSchema,
        annotations: untrustedOutput,
        async execute(input) {
          assertObject(input);
          const result = store.createProposal(assertProposalInput(input));
          await afterPaint();
          return textResult(result);
        },
      },
      {
        name: "propose_adaptation",
        title: "Propose adaptation",
        description:
          "Creates FrameGuard's predefined three-change demo proposal from one adaptation objective when no review is active. Use create_proposal for caller-specified edits.",
        inputSchema: {
          type: "object",
          properties: {
            objective: {
              type: "string",
              minLength: 1,
              description:
                "Goal used to label the predefined mobile adaptation demo.",
            },
          },
          required: ["objective"],
          additionalProperties: false,
        },
        annotations: untrustedOutput,
        async execute(input) {
          assertObject(input);
          assertExactKeys(input, ["objective"]);
          if (typeof input.objective !== "string" || !input.objective.trim()) {
            throw new Error("objective must be a non-empty string");
          }
          const result = store.propose(input.objective);
          await afterPaint();
          return textResult(result);
        },
      },
    );
  }
  if (state.canUndo && !state.proposal) {
    tools.push({
      name: "undo_last_change_set",
      title: "Undo last change set",
      description:
        "Restores the exact committed document before the last applied change set when undo history exists.",
      inputSchema: emptySchema,
      annotations: untrustedOutput,
      async execute(input) {
        assertObject(input);
        assertExactKeys(input, []);
        const result = store.undo();
        await afterPaint();
        return textResult(result);
      },
    });
  }
  if (state.document) {
    tools.push({
      name: "export_review_receipt",
      title: "Export review receipt",
      description:
        "Returns a deterministic, secret-free JSON receipt for the current local review state without external transmission.",
      inputSchema: emptySchema,
      annotations: untrustedOutput,
      async execute(input) {
        assertObject(input);
        assertExactKeys(input, []);
        const receipt = serializeReceipt(store);
        store.record("export_review_receipt", "Receipt returned locally");
        await afterPaint();
        return { content: [{ type: "text", text: receipt }] };
      },
    });
  }
  tools.push(...createReviewTools(store));
  return tools;
}

export function createReviewTools(store: AppStore): WebMcpTool[] {
  const snapshot = store.getSnapshot();
  const proposal = snapshot.proposal;
  if (!proposal) return [];
  const applicableIds = proposal.changes
    .filter((change) => change.applicable)
    .map((change) => change.id);
  const tools: WebMcpTool[] = [];
  if (applicableIds.length) {
    tools.push({
      name: "set_change_approval",
      title: "Set change approval",
      description:
        "Selects or deselects one applicable change in the active proposal by its change ID.",
      inputSchema: {
        type: "object",
        properties: {
          changeId: {
            type: "string",
            enum: applicableIds,
            description:
              "Current applicable change ID returned by inspect_document.",
          },
          approved: {
            type: "boolean",
            description:
              "True selects the change; false returns it to pending.",
          },
        },
        required: ["changeId", "approved"],
        additionalProperties: false,
      },
      annotations: untrustedOutput,
      async execute(input) {
        assertObject(input);
        assertExactKeys(input, ["changeId", "approved"]);
        if (
          typeof input.changeId !== "string" ||
          !applicableIds.includes(input.changeId)
        ) {
          throw new Error("changeId must identify an applicable change");
        }
        if (typeof input.approved !== "boolean") {
          throw new Error("approved must be a boolean");
        }
        const result = store.setApproval(input.changeId, input.approved);
        await afterPaint();
        return textResult(result);
      },
    });
  }
  const hasApprovedChanges = proposal.changes.some(
    (change) => change.applicable && change.decision === "approved",
  );
  if (snapshot.agentApplyAuthorized && hasApprovedChanges) {
    tools.push({
      name: "apply_approved_changes",
      title: "Apply approved changes",
      description:
        "Atomically applies selected allowed changes after the user grants one-use authorization in the FrameGuard UI. This tool is available only while that authorization is valid.",
      inputSchema: emptySchema,
      annotations: untrustedOutput,
      async execute(input) {
        assertObject(input);
        assertExactKeys(input, []);
        const result = store.applyFromAgent();
        await afterPaint();
        return textResult(result);
      },
    });
  }
  tools.push({
    name: "reject_change_set",
    title: "Reject change set",
    description:
      "Discards the active proposal without mutating the committed document.",
    inputSchema: emptySchema,
    annotations: untrustedOutput,
    async execute(input) {
      assertObject(input);
      assertExactKeys(input, []);
      const result = store.reject();
      await afterPaint();
      return textResult(result);
    },
  });
  return tools;
}

export function installWebMcp(store: AppStore): () => void {
  const context = document.modelContext;
  if (!context) {
    store.setWebMcpAvailable(false);
    return () => undefined;
  }
  const permanent = new AbortController();
  let contextualController: AbortController | null = null;
  let registeredContext: string | null = null;
  let disposed = false;
  let staticReady = false;
  let contextualReady = false;
  const publishAvailability = () => {
    if (disposed) return;
    store.setWebMcpAvailable(staticReady && contextualReady);
  };
  const register = (tool: WebMcpTool, signal: AbortSignal) =>
    context.registerTool(tool, { signal });
  Promise.all(
    createStaticTools(store).map((tool) => register(tool, permanent.signal)),
  )
    .then(() => {
      staticReady = true;
      syncContextualTools();
    })
    .catch((error: unknown) => {
      permanent.abort();
      if (disposed) return;
      store.setWebMcpAvailable(false);
      store.record(
        "WebMCP registration",
        error instanceof Error ? error.message : "Registration failed",
      );
    });
  const syncContextualTools = () => {
    if (!staticReady) return;
    const state = store.getSnapshot();
    const contextKey = JSON.stringify({
      documentRevision: state.document?.revision ?? null,
      proposalId: state.proposal?.id ?? null,
      decisions:
        state.proposal?.changes.map((change) => change.decision) ?? null,
      agentApplyAuthorized: state.agentApplyAuthorized,
      canUndo: state.canUndo,
    });
    if (contextKey === registeredContext) return;
    registeredContext = contextKey;
    contextualController?.abort();
    contextualController = null;
    contextualReady = false;
    publishAvailability();
    const tools = createContextualTools(store);
    if (tools.length) {
      const controller = new AbortController();
      contextualController = controller;
      const signal = controller.signal;
      void Promise.all(tools.map((tool) => register(tool, signal)))
        .then(() => {
          if (disposed || contextualController !== controller) return;
          contextualReady = true;
          publishAvailability();
        })
        .catch((error: unknown) => {
          controller.abort();
          if (disposed || contextualController !== controller) return;
          contextualReady = false;
          permanent.abort();
          staticReady = false;
          publishAvailability();
          store.record(
            "WebMCP registration",
            error instanceof Error
              ? error.message
              : "Contextual tool registration failed",
          );
        });
    } else {
      contextualReady = true;
      publishAvailability();
    }
  };
  const unsubscribe = store.subscribe(syncContextualTools);
  syncContextualTools();
  return () => {
    disposed = true;
    unsubscribe();
    permanent.abort();
    contextualController?.abort();
  };
}
