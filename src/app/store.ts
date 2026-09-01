import {
  createReviewAuthority,
  type ChangeId,
  type ProposalInput,
  type ReviewAuthority,
  type ReviewState,
} from "../review/review";
import type { DraftRecovery, RecoveryStatus } from "../recovery/recovery";
import {
  parseImportedDocument,
  type EditorDocument,
  type ElementId,
} from "../editor/document";
import { resolveRelatedChangeId } from "./layers";
import type { ApplicationAuthorization } from "../review/models";
export interface Activity {
  tool: string;
  result: string;
}
export interface AppSnapshot extends ReviewState {
  activity: Activity | null;
  webMcpAvailable: boolean;
  agentApplyAuthorized: boolean;
  applicationAuthorization: ApplicationAuthorization | null;
  selectedLayer: ElementId | null;
  selectedChange: ChangeId | null;
  previewDocument: EditorDocument | null;
  recovery: RecoveryStatus;
}

function freezeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  Object.freeze(snapshot.recovery);
  if (snapshot.applicationAuthorization) {
    Object.freeze(snapshot.applicationAuthorization.approvedChangeIds);
    Object.freeze(snapshot.applicationAuthorization);
  }
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
    if (entry.authorization) {
      Object.freeze(entry.authorization.approvedChangeIds);
      Object.freeze(entry.authorization);
    }
    Object.freeze(entry);
  });
  Object.freeze(snapshot.reviewHistory);
  return Object.freeze(snapshot);
}
export function createAppStore(options: { recovery?: DraftRecovery } = {}) {
  const recovery = options.recovery;
  const boot = recovery?.bootstrap();
  const review: ReviewAuthority = boot?.authority ?? createReviewAuthority();
  let activity: Activity | null = null;
  let webMcpAvailable = false;
  let applicationAuthorization: ApplicationAuthorization | null = null;
  let selectedLayer: ElementId | null = null;
  let selectedChange: ChangeId | null = null;
  let recoveryStatus: RecoveryStatus = boot?.status ?? {
    enabled: false,
    tone: "off",
    message: "Draft recovery is off.",
  };
  const currentPreview = () =>
    review.getState().proposal
      ? review.preview(selectedChange ?? undefined)
      : null;
  let snapshot: AppSnapshot = freezeSnapshot({
    ...review.getState(),
    activity,
    webMcpAvailable,
    agentApplyAuthorized: applicationAuthorization !== null,
    applicationAuthorization: applicationAuthorization
      ? structuredClone(applicationAuthorization)
      : null,
    selectedLayer,
    selectedChange,
    previewDocument: currentPreview(),
    recovery: recoveryStatus,
  });
  const listeners = new Set<() => void>();
  const emit = (persist = false) => {
    if (persist && recovery) recoveryStatus = recovery.sync(review);
    snapshot = freezeSnapshot({
      ...review.getState(),
      activity,
      webMcpAvailable,
      agentApplyAuthorized: applicationAuthorization !== null,
      applicationAuthorization: applicationAuthorization
        ? structuredClone(applicationAuthorization)
        : null,
      selectedLayer,
      selectedChange,
      previewDocument: currentPreview(),
      recovery: recoveryStatus,
    });
    listeners.forEach((listener) => listener());
  };
  const run = <T>(
    tool: string,
    action: () => T,
    beforeEmit?: (result: T) => void,
    shouldPersist: (result: T) => boolean = () => true,
  ): T => {
    try {
      const result = action();
      beforeEmit?.(result);
      activity = { tool, result: "Completed" };
      emit(shouldPersist(result));
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
          applicationAuthorization = null;
        },
      );
    },
    resetWorkspace() {
      review.reset();
      selectedLayer = null;
      selectedChange = null;
      applicationAuthorization = null;
      activity = null;
      emit(true);
    },
    createProposal(input: ProposalInput) {
      applicationAuthorization = null;
      return run(
        "create_proposal",
        () => review.createProposal(input),
        (result) => {
          selectedChange = result.changes[0]?.id ?? null;
          selectedLayer = result.changes[0]?.target ?? null;
        },
      );
    },
    reviseProposal(proposalId: string, input: ProposalInput) {
      applicationAuthorization = null;
      return run(
        "revise_proposal",
        () => review.reviseProposal(proposalId, input),
        (result) => {
          selectedChange = result.changes[0]?.id ?? null;
          selectedLayer = result.changes[0]?.target ?? null;
        },
      );
    },
    setApproval(id: ChangeId, approved: boolean) {
      applicationAuthorization = null;
      return run("set_change_approval", () => review.setApproval(id, approved));
    },
    rejectChange(id: ChangeId) {
      applicationAuthorization = null;
      return run("reject_change", () => review.rejectChange(id));
    },
    selectLayer(id: ElementId) {
      selectedLayer = id;
      selectedChange = resolveRelatedChangeId(review.getState().proposal, id);
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
      applicationAuthorization = {
        id: `authorization-${crypto.randomUUID()}`,
        proposalId: active.id,
        baseRevision: active.baseRevision,
        approvedChangeIds: active.changes
          .filter(
            (change) => change.applicable && change.decision === "approved",
          )
          .map((change) => change.id),
        status: "valid",
      };
      activity = {
        tool: "human_authorization",
        result: "Agent apply authorized",
      };
      emit();
    },
    applyFromAgent() {
      if (!applicationAuthorization) {
        throw new Error(
          "AUTHORIZATION_REQUIRED: grant one-use authorization in the FrameGuard UI",
        );
      }
      const authorization = structuredClone(applicationAuthorization);
      return run(
        "apply_approved_changes",
        () => review.apply(authorization),
        () => {
          applicationAuthorization = null;
          selectedChange = null;
        },
      );
    },
    applyFromUi() {
      applicationAuthorization = null;
      return run(
        "apply_approved_changes",
        () => review.apply(),
        () => {
          selectedChange = null;
        },
      );
    },
    reject() {
      applicationAuthorization = null;
      selectedChange = null;
      return run(
        "reject_change_set",
        () => review.reject(),
        (result) => {
          if (!result.document) selectedLayer = null;
        },
      );
    },
    withdrawProposal() {
      applicationAuthorization = null;
      selectedChange = null;
      return run(
        "withdraw_proposal",
        () => review.withdraw(),
        (result) => {
          if (!result.document) selectedLayer = null;
        },
      );
    },
    undo() {
      applicationAuthorization = null;
      return run(
        "undo_last_change_set",
        () => {
          const result = review.undo();
          if (result.changed) selectedChange = null;
          return result;
        },
        undefined,
        (result) => result.changed,
      );
    },
    record(tool: string, result: string) {
      activity = { tool, result };
      emit();
    },
    setRecoveryEnabled(enabled: boolean) {
      if (!recovery) return;
      recoveryStatus = enabled
        ? recovery.enable(review)
        : recovery.disableAndClear();
      emit();
    },
    clearSavedDraft() {
      if (!recovery) return;
      recoveryStatus = recovery.clearSavedDraft(review);
      emit();
    },
  };
}
export type AppStore = ReturnType<typeof createAppStore>;
