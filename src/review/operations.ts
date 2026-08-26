import {
  cloneDocument,
  type Canvas,
  type EditorDocument,
  type ElementId,
} from "../editor/document";
import type {
  ChangeOperation,
  ProposalChange,
  ProposalChangeInput,
  ProposalChangeId,
} from "./models";

export interface OperationMetadata {
  kind: ChangeOperation["kind"];
  label: string;
  targets: ElementId[];
  canvases: Canvas[];
  valueLabel: string;
  multiline: boolean;
}

export const operationMetadata: OperationMetadata[] = [
  {
    kind: "set_text",
    label: "Replace text",
    targets: ["headline", "logo", "legal"],
    canvases: ["desktop", "mobile"],
    valueLabel: "Proposed text",
    multiline: true,
  },
  {
    kind: "set_image_position",
    label: "Adjust crop",
    targets: ["image"],
    canvases: ["desktop", "mobile"],
    valueLabel: "Proposed position",
    multiline: false,
  },
];

export function operationsForTarget(target: ElementId): OperationMetadata[] {
  return operationMetadata.filter((operation) =>
    operation.targets.includes(target),
  );
}

function definitionFor(input: ProposalChangeInput): OperationMetadata {
  const definition = operationMetadata.find(
    (candidate) => candidate.kind === input.operation.kind,
  );
  if (!definition) throw new Error("Unsupported proposal operation");
  if (!definition.targets.includes(input.target)) {
    throw new Error(`${definition.label} is not supported for ${input.target}`);
  }
  if (!definition.canvases.includes(input.operation.canvas)) {
    throw new Error(`${definition.label} is not supported on that canvas`);
  }
  return definition;
}

function currentValue(
  document: EditorDocument,
  input: ProposalChangeInput,
): string {
  if (input.operation.kind === "set_text") {
    if (input.target === "headline") {
      return document.layouts[input.operation.canvas].headline;
    }
    return document.elements[input.target].label;
  }
  return document.layouts[input.operation.canvas].imagePosition;
}

function validateImagePosition(value: string) {
  if (
    !/^(?:center|left center|right center|(?:100|[1-9]?\d)% center)$/.test(
      value,
    )
  ) {
    throw new Error(
      "Image position must be center, left center, right center, or 0%-100% center",
    );
  }
}

export function materializeChange(
  document: EditorDocument,
  id: ProposalChangeId,
  input: ProposalChangeInput,
): ProposalChange {
  const definition = definitionFor(input);
  const value = input.operation.value;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${definition.valueLabel} must not be empty`);
  }
  if (value.length > 1_000) {
    throw new Error(`${definition.valueLabel} must be 1000 characters or less`);
  }
  if (input.operation.kind === "set_image_position") {
    validateImagePosition(value);
  }
  const before = currentValue(document, input);
  const protectedTarget = document.elements[input.target].protected;
  const noOp = before === value;
  return {
    id,
    target: input.target,
    operation: structuredClone(input.operation),
    canvas: input.operation.canvas,
    before,
    proposed: value,
    rationale: input.rationale.trim(),
    summary: `${definition.label} · ${document.elements[input.target].label}`,
    applicable: !protectedTarget && !noOp,
    decision: "pending",
    ...(protectedTarget
      ? {
          blockedReason: `${document.elements[input.target].label} is protected`,
        }
      : noOp
        ? { blockedReason: "Proposed value matches the current value" }
        : {}),
  };
}

export function applyChange(
  document: EditorDocument,
  change: ProposalChange,
): void {
  if (!change.applicable) {
    throw new Error(change.blockedReason ?? "Change is not applicable");
  }
  if (document.elements[change.target].protected) {
    throw new Error(`${document.elements[change.target].label} is protected`);
  }
  if (change.operation.kind === "set_text") {
    if (change.target !== "headline") {
      throw new Error("Text operation target is not editable");
    }
    document.layouts[change.canvas].headline = change.proposed;
    return;
  }
  if (change.target !== "image") {
    throw new Error("Image position operation target is invalid");
  }
  validateImagePosition(change.proposed);
  document.layouts[change.canvas].imagePosition = change.proposed;
}

export function deriveProposalPreview(
  committed: EditorDocument,
  changes: ProposalChange[],
): EditorDocument {
  const preview = cloneDocument(committed);
  for (const change of changes) {
    if (!change.applicable) continue;
    applyChange(preview, change);
  }
  return preview;
}
