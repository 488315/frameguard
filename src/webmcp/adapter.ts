import { auditDocument } from "../editor/document";
import { serializeReceipt } from "../export/receipt";
import type { AppStore } from "../app/store";
import type { ToolResult, WebMcpTool } from "./types";

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const textResult = (value: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

function assertObject(
  input: unknown,
): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Input must be a JSON object");
  }
}

export function createStaticTools(store: AppStore): WebMcpTool[] {
  return [
    {
      name: "inspect_document",
      title: "Inspect document",
      description:
        "Reads the committed layouts, protection flags, active proposal, and deterministic audit. Optionally narrows layouts to one canvas.",
      inputSchema: {
        type: "object",
        properties: { canvas: { type: "string", enum: ["desktop", "mobile"] } },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      async execute(input) {
        assertObject(input);
        const canvas = input.canvas;
        if (
          canvas !== undefined &&
          canvas !== "desktop" &&
          canvas !== "mobile"
        ) {
          throw new Error("canvas must be desktop or mobile");
        }
        const state = store.inspect();
        const layouts = canvas
          ? { [canvas]: state.document.layouts[canvas] }
          : state.document.layouts;
        store.record(
          "inspect_document",
          `Inspected ${canvas ?? "both canvases"}`,
        );
        return textResult({
          revision: state.document.revision,
          layouts,
          protection: Object.fromEntries(
            Object.entries(state.document.elements).map(([id, element]) => [
              id,
              element.protected,
            ]),
          ),
          activeProposal: state.proposal,
          audit: auditDocument(state.document),
        });
      },
    },
    {
      name: "propose_adaptation",
      title: "Propose adaptation",
      description:
        "Creates the visible FrameGuard demo proposal from a raw adaptation objective when no proposal is active.",
      inputSchema: {
        type: "object",
        properties: {
          objective: { type: "string", minLength: 1 },
        },
        required: ["objective"],
        additionalProperties: false,
      },
      async execute(input) {
        assertObject(input);
        if (typeof input.objective !== "string" || !input.objective.trim()) {
          throw new Error("objective must be a non-empty string");
        }
        return textResult(store.propose(input.objective));
      },
    },
    {
      name: "undo_last_change_set",
      title: "Undo last change set",
      description:
        "Restores the exact committed document before the last applied change set when undo history exists.",
      inputSchema: emptySchema,
      async execute(input) {
        assertObject(input);
        return textResult(store.undo());
      },
    },
    {
      name: "export_review_receipt",
      title: "Export review receipt",
      description:
        "Returns a deterministic, secret-free JSON receipt for the current local review state without external transmission.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      async execute(input) {
        assertObject(input);
        const receipt = serializeReceipt(store);
        store.record("export_review_receipt", "Receipt returned locally");
        return { content: [{ type: "text", text: receipt }] };
      },
    },
  ];
}

export function createReviewTools(store: AppStore): WebMcpTool[] {
  return [
    {
      name: "set_change_approval",
      title: "Set change approval",
      description:
        "Selects or deselects one applicable change in the active proposal by its change ID.",
      inputSchema: {
        type: "object",
        properties: {
          changeId: {
            type: "string",
            enum: ["headline-reflow", "image-crop"],
          },
          approved: { type: "boolean" },
        },
        required: ["changeId", "approved"],
        additionalProperties: false,
      },
      async execute(input) {
        assertObject(input);
        if (
          input.changeId !== "headline-reflow" &&
          input.changeId !== "image-crop"
        ) {
          throw new Error("changeId must identify an applicable change");
        }
        if (typeof input.approved !== "boolean") {
          throw new Error("approved must be a boolean");
        }
        return textResult(store.setApproval(input.changeId, input.approved));
      },
    },
    {
      name: "apply_approved_changes",
      title: "Apply approved changes",
      description:
        "Atomically applies selected allowed changes after validating the active proposal base revision.",
      inputSchema: emptySchema,
      async execute(input) {
        assertObject(input);
        return textResult(store.apply());
      },
    },
    {
      name: "reject_change_set",
      title: "Reject change set",
      description:
        "Discards the active proposal without mutating the committed document.",
      inputSchema: emptySchema,
      async execute(input) {
        assertObject(input);
        return textResult(store.reject());
      },
    },
  ];
}

export function installWebMcp(store: AppStore): () => void {
  const context = document.modelContext;
  if (!context) {
    store.setWebMcpAvailable(false);
    return () => undefined;
  }
  const permanent = new AbortController();
  let reviewController: AbortController | null = null;
  let hadProposal = false;
  const register = (tool: WebMcpTool, signal: AbortSignal) =>
    context.registerTool(tool, { signal });
  Promise.all(
    createStaticTools(store).map((tool) => register(tool, permanent.signal)),
  )
    .then(() => store.setWebMcpAvailable(true))
    .catch((error: unknown) => {
      store.setWebMcpAvailable(false);
      store.record(
        "WebMCP registration",
        error instanceof Error ? error.message : "Registration failed",
      );
    });
  const syncReviewTools = () => {
    const hasProposal = Boolean(store.getSnapshot().proposal);
    if (hasProposal === hadProposal) return;
    hadProposal = hasProposal;
    reviewController?.abort();
    reviewController = null;
    if (hasProposal) {
      reviewController = new AbortController();
      const signal = reviewController.signal;
      void Promise.all(
        createReviewTools(store).map((tool) => register(tool, signal)),
      ).catch((error: unknown) =>
        store.record(
          "WebMCP registration",
          error instanceof Error
            ? error.message
            : "Review tool registration failed",
        ),
      );
    }
  };
  const unsubscribe = store.subscribe(syncReviewTools);
  syncReviewTools();
  return () => {
    unsubscribe();
    permanent.abort();
    reviewController?.abort();
  };
}
