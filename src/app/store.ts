import {
  createReviewAuthority,
  type ChangeId,
  type ProposalInput,
  type ReviewState,
} from "../review/review";
import {
  parseImportedDocument,
  type EditorDocument,
  type ElementId,
} from "../editor/document";
export interface Activity {
  tool: string;
  result: string;
}
export interface AppSnapshot extends ReviewState {
  activity: Activity | null;
  webMcpAvailable: boolean;
  agentApplyAuthorized: boolean;
  selectedLayer: ElementId | null;
  selectedChange: ChangeId | null;
  previewDocument: EditorDocument | null;
}

function freezeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  Object.freeze(snapshot.modifiedElements);
  if (snapshot.document) {
    Object.values(snapshot.document.elements).forEach(Object.freeze);
    Object.freeze(snapshot.document.elements);
    Object.values(snapshot.document.layouts).forEach(Object.freeze);
    Object.freeze(snapshot.document.layouts);
    Object.freeze(snapshot.document);
  }
  if (snapshot.previewDocument) {
    Object.values(snapshot.previewDocument.elements).forEach(Object.freeze);
    Object.freeze(snapshot.previewDocument.elements);
    Object.values(snapshot.previewDocument.layouts).forEach(Object.freeze);
    Object.freeze(snapshot.previewDocument.layouts);
    Object.freeze(snapshot.previewDocument);
  }
  snapshot.proposal?.changes.forEach((change) => {
    Object.freeze(change.operation);
    Object.freeze(change);
  });
  if (snapshot.proposal) {
    Object.freeze(snapshot.proposal.changes);
    Object.freeze(snapshot.proposal);
  }
  snapshot.reviewHistory.forEach((entry) => {
    entry.changes.forEach(Object.freeze);
    Object.freeze(entry.changes);
    Object.freeze(entry.approvedChangeIds);
    Object.freeze(entry.rejectedChangeIds);
    Object.freeze(entry.blockedChangeIds);
    Object.freeze(entry);
  });
  Object.freeze(snapshot.reviewHistory);
  return Object.freeze(snapshot);
}
export function createAppStore() {
  const review = createReviewAuthority();
  let activity: Activity | null = null;
  let webMcpAvailable = false;
  let agentApplyAuthorized = false;
  let selectedLayer: ElementId | null = null;
  let selectedChange: ChangeId | null = null;
  const currentPreview = () =>
    review.getState().proposal
      ? review.preview(selectedChange ?? undefined)
      : null;
  let snapshot: AppSnapshot = freezeSnapshot({
    ...review.getState(),
    activity,
    webMcpAvailable,
    agentApplyAuthorized,
    selectedLayer,
    selectedChange,
    previewDocument: currentPreview(),
  });
  const listeners = new Set<() => void>();
  const emit = () => {
    snapshot = freezeSnapshot({
      ...review.getState(),
      activity,
      webMcpAvailable,
      agentApplyAuthorized,
      selectedLayer,
      selectedChange,
      previewDocument: currentPreview(),
    });
    listeners.forEach((listener) => listener());
  };
  const run = <T>(
    tool: string,
    action: () => T,
    beforeEmit?: (result: T) => void,
  ): T => {
    try {
      const result = action();
      beforeEmit?.(result);
      activity = { tool, result: "Completed" };
      emit();
      return result;
    } catch (error) {
      activity = {
        tool,
        result: error instanceof Error ? error.message : "Failed",
      };
      emit();
      throw error;
    }
  };
  return {
    getSnapshot: (): AppSnapshot => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setWebMcpAvailable(value: boolean) {
      webMcpAvailable = value;
      emit();
    },
    inspect() {
      return review.getState();
    },
    importLayout(source: string) {
      return run(
        "import_layout",
        () => review.loadDocument(parseImportedDocument(source)),
        () => {
          selectedLayer = null;
          selectedChange = null;
          agentApplyAuthorized = false;
        },
      );
    },
    resetWorkspace() {
      review.reset();
      selectedLayer = null;
      selectedChange = null;
      agentApplyAuthorized = false;
      activity = null;
      emit();
    },
    propose(objective: string) {
      return run(
        "propose_adaptation",
        () => review.propose(objective),
        (result) => {
          selectedChange = result.changes[0].id;
          selectedLayer = result.changes[0].target;
        },
      );
    },
    createProposal(input: ProposalInput) {
      agentApplyAuthorized = false;
      return run(
        "create_proposal",
        () => review.createProposal(input),
        (result) => {
          selectedChange = result.changes[0]?.id ?? null;
          selectedLayer = result.changes[0]?.target ?? null;
        },
      );
    },
    setApproval(id: ChangeId, approved: boolean) {
      agentApplyAuthorized = false;
      return run("set_change_approval", () => review.setApproval(id, approved));
    },
    rejectChange(id: ChangeId) {
      agentApplyAuthorized = false;
      return run("reject_change", () => review.rejectChange(id));
    },
    selectLayer(id: ElementId) {
      selectedLayer = id;
      const related = review
        .getState()
        .proposal?.changes.find((change) => change.target === id);
      selectedChange = related?.id ?? null;
      emit();
    },
    selectChange(id: ChangeId) {
      const change = review
        .getState()
        .proposal?.changes.find((item) => item.id === id);
      if (!change) throw new Error(`Unknown change ID: ${id}`);
      selectedChange = id;
      selectedLayer = change.target;
      emit();
    },
    authorizeAgentApply() {
      const active = review.getState().proposal;
      if (!active) throw new Error("No active proposal");
      if (
        !active.changes.some(
          (change) => change.applicable && change.decision === "approved",
        )
      ) {
        throw new Error("Approve at least one applicable change first");
      }
      agentApplyAuthorized = true;
      activity = {
        tool: "human_authorization",
        result: "Agent apply authorized",
      };
      emit();
    },
    applyFromAgent() {
      if (!agentApplyAuthorized) {
        throw new Error("Human authorization required in the FrameGuard UI");
      }
      agentApplyAuthorized = false;
      return run(
        "apply_approved_changes",
        () => review.apply(),
        () => {
          selectedChange = null;
        },
      );
    },
    applyFromUi() {
      agentApplyAuthorized = false;
      return run(
        "apply_approved_changes",
        () => review.apply(),
        () => {
          selectedChange = null;
        },
      );
    },
    reject() {
      agentApplyAuthorized = false;
      selectedChange = null;
      return run(
        "reject_change_set",
        () => review.reject(),
        (result) => {
          if (!result.document) selectedLayer = null;
        },
      );
    },
    undo() {
      agentApplyAuthorized = false;
      return run("undo_last_change_set", () => {
        const result = review.undo();
        if (result.changed) selectedChange = null;
        return result;
      });
    },
    record(tool: string, result: string) {
      activity = { tool, result };
      emit();
    },
  };
}
export type AppStore = ReturnType<typeof createAppStore>;
