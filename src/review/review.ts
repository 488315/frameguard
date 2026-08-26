import {
  cloneDocument,
  createInitialDocument,
  type ElementId,
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
  rejected: boolean;
  target: ElementId;
  kind: "reflow" | "crop" | "move";
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
  modifiedElements: ElementId[];
}

export interface ReviewAuthority {
  getState(): ReviewState;
  propose(objective: string): ChangeSet;
  setApproval(id: ChangeId, approved: boolean): ChangeSet;
  rejectChange(id: ChangeId): ChangeSet;
  apply(): ReviewState;
  reject(): ReviewState;
  undo(): { changed: boolean; document: EditorDocument };
  __testOnlyAdvanceRevision(): void;
}

export function createReviewAuthority(): ReviewAuthority {
  let document = createInitialDocument();
  let proposal: ChangeSet | null = null;
  let modifiedElements: ElementId[] = [];
  let history: Array<{
    document: EditorDocument;
    modifiedElements: ElementId[];
  }> = [];
  const state = (): ReviewState => ({
    document: cloneDocument(document),
    proposal: proposal ? structuredClone(proposal) : null,
    canUndo: history.length > 0,
    modifiedElements: [...modifiedElements],
  });
  const updateChange = (
    id: ChangeId,
    action: (change: ReviewChange) => void,
  ) => {
    if (!proposal) throw new Error("No active proposal");
    const change = proposal.changes.find((item) => item.id === id);
    if (!change) throw new Error(`Unknown change ID: ${id}`);
    if (!change.applicable)
      throw new Error(`${change.label} is protected and cannot be changed`);
    action(change);
    return structuredClone(proposal);
  };
  const candidate = (
    change: Omit<
      ReviewChange,
      "applicable" | "approved" | "rejected" | "blockedReason"
    >,
  ): ReviewChange => {
    const protectedTarget = document.elements[change.target].protected;
    return {
      ...change,
      applicable: !protectedTarget,
      approved: false,
      rejected: false,
      ...(protectedTarget
        ? {
            blockedReason: `${document.elements[change.target].label} is protected`,
          }
        : {}),
    };
  };
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
          candidate({
            id: "headline-reflow",
            label: "Headline reflow",
            description: "Break the mobile headline after ‘for’.",
            target: "headline",
            kind: "reflow",
          }),
          candidate({
            id: "image-crop",
            label: "Image crop",
            description: "Shift the mobile image focal point right.",
            target: "image",
            kind: "crop",
          }),
          candidate({
            id: "logo-move",
            label: "Logo move",
            description: "Move logo into the image field.",
            target: "logo",
            kind: "move",
          }),
        ],
      };
      return structuredClone(proposal);
    },
    setApproval(id, approved) {
      return updateChange(id, (change) => {
        change.approved = approved;
        change.rejected = false;
      });
    },
    rejectChange(id) {
      return updateChange(id, (change) => {
        change.approved = false;
        change.rejected = true;
      });
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
        if (next.elements[change.target].protected)
          throw new Error(`${next.elements[change.target].label} is protected`);
        if (change.id === "headline-reflow")
          next.layouts.mobile.headline = "Make room for\nwhat comes next.";
        if (change.id === "image-crop")
          next.layouts.mobile.imagePosition = "68% center";
      }
      next.revision += 1;
      history = [
        {
          document: cloneDocument(document),
          modifiedElements: [...modifiedElements],
        },
      ];
      document = next;
      modifiedElements = approved.map((change) => change.target);
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
      document = prior.document;
      modifiedElements = prior.modifiedElements;
      proposal = null;
      return { changed: true, document: cloneDocument(document) };
    },
    __testOnlyAdvanceRevision() {
      document = { ...document, revision: document.revision + 1 };
    },
  };
}
