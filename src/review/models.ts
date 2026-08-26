import type { Canvas, EditorDocument, ElementId } from "../editor/document";

export type ProposalId = string;
export type ProposalChangeId = string;
export type ProposalStatus = "active";
export type ProposalDecision = "pending" | "approved" | "rejected";

export type ChangeOperation =
  | { kind: "set_text"; canvas: Canvas; value: string }
  | { kind: "set_image_position"; canvas: Canvas; value: string };

export interface ProposalChangeInput {
  target: ElementId;
  operation: ChangeOperation;
  rationale: string;
}

export interface ProposalInput {
  expectedRevision: number;
  title: string;
  objective: string;
  changes: ProposalChangeInput[];
}

export interface ProposalChange {
  id: ProposalChangeId;
  target: ElementId;
  operation: ChangeOperation;
  canvas: Canvas;
  before: string;
  proposed: string;
  rationale: string;
  summary: string;
  applicable: boolean;
  blockedReason?: string;
  decision: ProposalDecision;
}

export interface Proposal {
  id: ProposalId;
  title: string;
  objective: string;
  baseRevision: number;
  status: ProposalStatus;
  changes: ProposalChange[];
}

export interface FinalizedReview {
  proposalId: ProposalId;
  title: string;
  objective: string;
  baseRevision: number;
  resultingRevision: number | null;
  outcome: "applied" | "rejected";
  changes: Array<{
    id: ProposalChangeId;
    summary: string;
    target: ElementId;
    canvas: Canvas;
    before: string;
    proposed: string;
    applicable: boolean;
    blockedReason?: string;
    decision: ProposalDecision;
  }>;
  approvedChangeIds: ProposalChangeId[];
  rejectedChangeIds: ProposalChangeId[];
  blockedChangeIds: ProposalChangeId[];
}

export interface ReviewState {
  document: EditorDocument | null;
  proposal: Proposal | null;
  canUndo: boolean;
  modifiedElements: ElementId[];
  reviewHistory: FinalizedReview[];
}

export interface IdFactory {
  proposalId(): ProposalId;
  changeId(): ProposalChangeId;
}

export interface ProposalValidationIssue {
  path: string;
  message: string;
}

export class ProposalValidationError extends Error {
  readonly issues: ProposalValidationIssue[];

  constructor(issues: ProposalValidationIssue[]) {
    super(issues[0]?.message ?? "Proposal is invalid");
    this.name = "ProposalValidationError";
    this.issues = issues;
  }
}
