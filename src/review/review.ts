import {
  cloneDocument,
  createInitialDocument,
  type EditorDocument,
  type ElementId,
} from "../editor/document";
import {
  applyChange as applyRegisteredChange,
  deriveProposalPreview,
  materializeChange,
  operationMetadata,
  operationsForTarget,
} from "./operations";
import {
  ProposalValidationError,
  type FinalizedReview,
  type IdFactory,
  type Proposal,
  type ProposalChange,
  type ProposalChangeId,
  type ProposalInput,
  type ReviewState,
} from "./models";

export type ChangeId = ProposalChangeId;
export type ReviewChange = ProposalChange;
export type ChangeSet = Proposal;
export type { ProposalInput, ReviewState } from "./models";
export { ProposalValidationError } from "./models";

export interface ReviewAuthority {
  getState(): ReviewState;
  loadDocument(nextDocument: EditorDocument): ReviewState;
  reset(): ReviewState;
  createProposal(input: ProposalInput): Proposal;
  propose(objective: string): Proposal;
  preview(changeId?: ProposalChangeId): EditorDocument | null;
  setApproval(id: ProposalChangeId, approved: boolean): Proposal;
  rejectChange(id: ProposalChangeId): Proposal;
  apply(): ReviewState;
  reject(): ReviewState;
  undo(): { changed: boolean; document: EditorDocument | null };
  __testOnlyAdvanceRevision(): void;
}

interface ReviewAuthorityOptions {
  idFactory?: IdFactory;
  starterDocument?: () => EditorDocument;
  applyOperation?: (document: EditorDocument, change: ProposalChange) => void;
}

const elementIds = [
  "logo",
  "headline",
  "image",
  "body",
  "cta",
  "legal",
] as const;
const canvases = ["desktop", "mobile"] as const;
const operationKinds = ["set_text", "set_image_position"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validateProposalInput(input: unknown): asserts input is ProposalInput {
  const issues: Array<{ path: string; message: string }> = [];
  if (!isRecord(input)) {
    throw new ProposalValidationError([
      { path: "proposal", message: "Proposal must be an object" },
    ]);
  }
  if (
    !exactKeys(input, ["expectedRevision", "title", "objective", "changes"])
  ) {
    issues.push({
      path: "proposal",
      message: "Proposal contains unexpected or missing fields",
    });
  }
  if (
    !Number.isInteger(input.expectedRevision) ||
    Number(input.expectedRevision) < 1
  ) {
    issues.push({
      path: "expectedRevision",
      message: "Expected revision must be a positive integer",
    });
  }
  if (typeof input.title !== "string" || !input.title.trim()) {
    issues.push({ path: "title", message: "Title is required" });
  } else if (input.title.length > 120) {
    issues.push({
      path: "title",
      message: "Title must be 120 characters or less",
    });
  }
  if (typeof input.objective !== "string" || !input.objective.trim()) {
    issues.push({ path: "objective", message: "Objective is required" });
  } else if (input.objective.length > 500) {
    issues.push({
      path: "objective",
      message: "Objective must be 500 characters or less",
    });
  }
  if (!Array.isArray(input.changes) || input.changes.length === 0) {
    issues.push({
      path: "changes",
      message: "Add at least one proposed change",
    });
  } else if (input.changes.length > 20) {
    issues.push({
      path: "changes",
      message: "A proposal can contain at most 20 changes",
    });
  } else {
    const identities = new Set<string>();
    input.changes.forEach((rawChange, index) => {
      const path = `changes.${index}`;
      if (
        !isRecord(rawChange) ||
        !exactKeys(rawChange, ["target", "operation", "rationale"])
      ) {
        issues.push({
          path,
          message: "Change contains unexpected or missing fields",
        });
        return;
      }
      const targetSupported = elementIds.includes(
        rawChange.target as (typeof elementIds)[number],
      );
      if (!targetSupported) {
        issues.push({
          path: `${path}.target`,
          message: "Target is not supported",
        });
      }
      if (
        typeof rawChange.rationale !== "string" ||
        !rawChange.rationale.trim()
      ) {
        issues.push({
          path: `${path}.rationale`,
          message: "Rationale is required",
        });
      } else if (rawChange.rationale.length > 300) {
        issues.push({
          path: `${path}.rationale`,
          message: "Rationale must be 300 characters or less",
        });
      }
      if (
        !isRecord(rawChange.operation) ||
        !exactKeys(rawChange.operation, ["kind", "canvas", "value"])
      ) {
        issues.push({
          path: `${path}.operation`,
          message: "Operation is malformed",
        });
        return;
      }
      const rawOperation = rawChange.operation;
      const operationSupported = operationKinds.includes(
        rawOperation.kind as (typeof operationKinds)[number],
      );
      if (!operationSupported) {
        issues.push({
          path: `${path}.operation.kind`,
          message: "Operation is not supported",
        });
      }
      if (
        targetSupported &&
        operationSupported &&
        !operationsForTarget(
          rawChange.target as (typeof elementIds)[number],
        ).some((operation) => operation.kind === rawOperation.kind)
      ) {
        const operation = operationMetadata.find(
          (candidate) => candidate.kind === rawOperation.kind,
        );
        issues.push({
          path: `${path}.operation.kind`,
          message: `${operation?.label ?? "Operation"} is not supported for ${String(rawChange.target)}`,
        });
      }
      if (
        !canvases.includes(rawOperation.canvas as (typeof canvases)[number])
      ) {
        issues.push({
          path: `${path}.operation.canvas`,
          message: "Canvas is not supported",
        });
      }
      if (typeof rawOperation.value !== "string") {
        issues.push({
          path: `${path}.operation.value`,
          message: "Proposed value must be text",
        });
      }
      const identity = `${String(rawChange.target)}:${String(rawOperation.kind)}:${String(rawOperation.canvas)}`;
      if (identities.has(identity)) {
        issues.push({ path, message: "Duplicate target operation and canvas" });
      }
      identities.add(identity);
    });
  }
  if (issues.length) throw new ProposalValidationError(issues);
}

function defaultIdFactory(): IdFactory {
  return {
    proposalId: () => `proposal-${crypto.randomUUID()}`,
    changeId: () => `change-${crypto.randomUUID()}`,
  };
}

function finalized(
  proposal: Proposal,
  outcome: FinalizedReview["outcome"],
  resultingRevision: number | null,
): FinalizedReview {
  return {
    proposalId: proposal.id,
    title: proposal.title,
    objective: proposal.objective,
    baseRevision: proposal.baseRevision,
    resultingRevision,
    outcome,
    changes: proposal.changes.map((change) => ({
      id: change.id,
      summary: change.summary,
      target: change.target,
      canvas: change.canvas,
      before: change.before,
      proposed: change.proposed,
      applicable: change.applicable,
      ...(change.blockedReason ? { blockedReason: change.blockedReason } : {}),
      decision: change.decision,
    })),
    approvedChangeIds: proposal.changes
      .filter((change) => change.decision === "approved" && change.applicable)
      .map((change) => change.id),
    rejectedChangeIds: proposal.changes
      .filter((change) => change.decision === "rejected")
      .map((change) => change.id),
    blockedChangeIds: proposal.changes
      .filter((change) => !change.applicable)
      .map((change) => change.id),
  };
}

export function createReviewAuthority(
  options: ReviewAuthorityOptions = {},
): ReviewAuthority {
  const ids = options.idFactory ?? defaultIdFactory();
  const starterDocument = options.starterDocument ?? createInitialDocument;
  const executeOperation = options.applyOperation ?? applyRegisteredChange;
  let document: EditorDocument | null = null;
  let proposal: Proposal | null = null;
  let proposalOwnsDocument = false;
  let modifiedElements: ElementId[] = [];
  let reviewHistory: FinalizedReview[] = [];
  let history: Array<{
    document: EditorDocument;
    modifiedElements: ElementId[];
  }> = [];

  const state = (): ReviewState => ({
    document: document ? cloneDocument(document) : null,
    proposal: proposal ? structuredClone(proposal) : null,
    canUndo: history.length > 0,
    modifiedElements: [...modifiedElements],
    reviewHistory: structuredClone(reviewHistory),
  });

  const updateChange = (
    id: ProposalChangeId,
    action: (change: ProposalChange) => void,
  ) => {
    if (!proposal) throw new Error("No active proposal");
    const change = proposal.changes.find((item) => item.id === id);
    if (!change) throw new Error(`Unknown change ID: ${id}`);
    if (!change.applicable) {
      throw new Error(change.blockedReason ?? "Change is not applicable");
    }
    action(change);
    return structuredClone(proposal);
  };

  const createProposal = (input: ProposalInput): Proposal => {
    validateProposalInput(input);
    if (proposal) throw new Error("An active proposal already exists");
    const provisioned = document === null;
    if (provisioned) document = starterDocument();
    try {
      const current = document;
      if (!current) throw new Error("No workspace loaded");
      if (current.revision !== input.expectedRevision) {
        throw new Error(
          `Expected revision ${input.expectedRevision}, but current revision is ${current.revision}`,
        );
      }
      const changeIds = new Set<ProposalChangeId>();
      const changes = input.changes.map((changeInput, index) => {
        const id = ids.changeId();
        if (!id || changeIds.has(id)) {
          throw new Error("ID factory returned a duplicate change ID");
        }
        changeIds.add(id);
        try {
          return materializeChange(current, id, changeInput);
        } catch (error) {
          throw new ProposalValidationError([
            {
              path: `changes.${index}.operation.value`,
              message:
                error instanceof Error
                  ? error.message
                  : "Proposed value is invalid",
            },
          ]);
        }
      });
      if (
        !changes.some((change) => change.applicable) &&
        changes.some((change) => change.blockedReason?.includes("matches"))
      ) {
        throw new Error("Proposal contains no actionable changes");
      }
      const proposalId = ids.proposalId();
      if (!proposalId)
        throw new Error("ID factory returned an empty proposal ID");
      proposal = {
        id: proposalId,
        title: input.title.trim(),
        objective: input.objective.trim(),
        baseRevision: current.revision,
        status: "active",
        changes,
      };
      proposalOwnsDocument = provisioned;
      return structuredClone(proposal);
    } catch (error) {
      if (provisioned) document = null;
      throw error;
    }
  };

  return {
    getState: state,
    loadDocument(nextDocument) {
      document = cloneDocument(nextDocument);
      proposal = null;
      proposalOwnsDocument = false;
      modifiedElements = [];
      history = [];
      reviewHistory = [];
      return state();
    },
    reset() {
      document = null;
      proposal = null;
      proposalOwnsDocument = false;
      modifiedElements = [];
      history = [];
      reviewHistory = [];
      return state();
    },
    createProposal,
    propose(objective) {
      const revision = document?.revision ?? starterDocument().revision;
      return createProposal({
        expectedRevision: revision,
        title: "Mobile adaptation",
        objective,
        changes: [
          {
            target: "headline",
            operation: {
              kind: "set_text",
              canvas: "mobile",
              value: "Make room for\nwhat comes next.",
            },
            rationale: "Improve narrow-screen line balance.",
          },
          {
            target: "image",
            operation: {
              kind: "set_image_position",
              canvas: "mobile",
              value: "68% center",
            },
            rationale: "Keep the subject visible in the narrow crop.",
          },
          {
            target: "logo",
            operation: {
              kind: "set_text",
              canvas: "mobile",
              value: "Move logo into the image field",
            },
            rationale: "Test the protected brand boundary.",
          },
        ],
      });
    },
    preview(changeId) {
      if (!document) return null;
      if (!proposal) return cloneDocument(document);
      const changes = changeId
        ? proposal.changes.filter((change) => change.id === changeId)
        : proposal.changes;
      if (changeId && changes.length === 0) {
        throw new Error(`Unknown change ID: ${changeId}`);
      }
      return deriveProposalPreview(document, changes);
    },
    setApproval(id, approved) {
      return updateChange(id, (change) => {
        change.decision = approved ? "approved" : "pending";
      });
    },
    rejectChange(id) {
      return updateChange(id, (change) => {
        change.decision = "rejected";
      });
    },
    apply() {
      if (!proposal) throw new Error("No active proposal");
      if (!document) throw new Error("No workspace loaded");
      if (proposal.baseRevision !== document.revision) {
        throw new Error("Proposal is stale; inspect and propose again");
      }
      const approved = proposal.changes.filter(
        (change) => change.decision === "approved" && change.applicable,
      );
      if (approved.length === 0) {
        throw new Error("Select at least one applicable change");
      }
      const next = cloneDocument(document);
      const changedTargets: ElementId[] = [];
      for (const change of approved) {
        executeOperation(next, change);
        if (!changedTargets.includes(change.target)) {
          changedTargets.push(change.target);
        }
      }
      if (!next.elements.logo.protected || !next.elements.legal.protected) {
        throw new Error("Resulting document violates protection policy");
      }
      next.revision += 1;
      const completedProposal = structuredClone(proposal);
      history = [
        {
          document: cloneDocument(document),
          modifiedElements: [...modifiedElements],
        },
      ];
      document = next;
      modifiedElements = changedTargets;
      reviewHistory.push(
        finalized(completedProposal, "applied", next.revision),
      );
      proposal = null;
      proposalOwnsDocument = false;
      return state();
    },
    reject() {
      if (!proposal) throw new Error("No active proposal");
      reviewHistory.push(finalized(proposal, "rejected", null));
      proposal = null;
      if (proposalOwnsDocument) {
        document = null;
        modifiedElements = [];
        history = [];
      }
      proposalOwnsDocument = false;
      return state();
    },
    undo() {
      const prior = history.pop();
      if (!prior) {
        return {
          changed: false,
          document: document ? cloneDocument(document) : null,
        };
      }
      document = prior.document;
      modifiedElements = prior.modifiedElements;
      proposal = null;
      proposalOwnsDocument = false;
      return { changed: true, document: cloneDocument(document) };
    },
    __testOnlyAdvanceRevision() {
      if (!document) throw new Error("No workspace loaded");
      document = { ...document, revision: document.revision + 1 };
    },
  };
}
