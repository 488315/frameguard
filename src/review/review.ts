import {
  cloneDocument,
  createInitialDocument,
  type EditorDocument,
} from "../editor/document";

export type ChangeId = "headline-reflow" | "image-crop" | "logo-move";
export interface ReviewChange {
  id: ChangeId;
  label: string;
  description: string;
  applicable: boolean;
  blockedReason?: string;
  approved: boolean;
}
export interface ChangeSet {
  id: "mobile-adaptation-1";
  objective: string;
  baseRevision: number;
  changes: ReviewChange[];
}
export interface ReviewState {
  document: EditorDocument;
  proposal: ChangeSet | null;
  canUndo: boolean;
}

export interface ReviewAuthority {
  getState(): ReviewState;
  propose(objective: string): ChangeSet;
  setApproval(id: ChangeId, approved: boolean): ChangeSet;
  apply(): ReviewState;
  reject(): ReviewState;
  undo(): { changed: boolean; document: EditorDocument };
  __testOnlyAdvanceRevision(): void;
}

export function createReviewAuthority(): ReviewAuthority {
  let document = createInitialDocument();
  let proposal: ChangeSet | null = null;
  let history: EditorDocument[] = [];
  const state = (): ReviewState => ({
    document: cloneDocument(document),
    proposal: proposal ? structuredClone(proposal) : null,
    canUndo: history.length > 0,
  });
  return {
    getState: state,
    propose(objective) {
      if (!objective.trim()) throw new Error("Objective must not be empty");
      if (proposal) throw new Error("An active proposal already exists");
      proposal = {
        id: "mobile-adaptation-1",
        objective,
        baseRevision: document.revision,
        changes: [
          {
            id: "headline-reflow",
            label: "Headline reflow",
            description: "Break the mobile headline after ‘for’. ",
            applicable: true,
            approved: false,
          },
          {
            id: "image-crop",
            label: "Image crop",
            description: "Shift the mobile image focal point right.",
            applicable: true,
            approved: false,
          },
          {
            id: "logo-move",
            label: "Logo move blocked",
            description: "Move logo into the image field.",
            applicable: false,
            blockedReason: "Logo is protected",
            approved: false,
          },
        ],
      };
      return structuredClone(proposal);
    },
    setApproval(id, approved) {
      if (!proposal) throw new Error("No active proposal");
      const change = proposal.changes.find((item) => item.id === id);
      if (!change) throw new Error(`Unknown change ID: ${id}`);
      if (!change.applicable)
        throw new Error(`${change.label} is protected and cannot be approved`);
      change.approved = approved;
      return structuredClone(proposal);
    },
    apply() {
      if (!proposal) throw new Error("No active proposal");
      if (proposal.baseRevision !== document.revision)
        throw new Error("Proposal is stale; inspect and propose again");
      const approved = proposal.changes.filter(
        (change) => change.approved && change.applicable,
      );
      if (approved.length === 0)
        throw new Error("Select at least one applicable change");
      const next = cloneDocument(document);
      for (const change of approved) {
        if (change.id === "headline-reflow")
          next.layouts.mobile.headline = "Make room for\nwhat comes next.";
        if (change.id === "image-crop")
          next.layouts.mobile.imagePosition = "68% center";
      }
      next.revision += 1;
      history = [cloneDocument(document)];
      document = next;
      proposal = null;
      return state();
    },
    reject() {
      proposal = null;
      return state();
    },
    undo() {
      const prior = history.pop();
      if (!prior) return { changed: false, document: cloneDocument(document) };
      document = prior;
      proposal = null;
      return { changed: true, document: cloneDocument(document) };
    },
    __testOnlyAdvanceRevision() {
      document = { ...document, revision: document.revision + 1 };
    },
  };
}
