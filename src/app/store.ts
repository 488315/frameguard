import {
  createReviewAuthority,
  type ChangeId,
  type ReviewState,
} from "../review/review";
import type { ElementId } from "../editor/document";
export interface Activity {
  tool: string;
  result: string;
}
export interface AppSnapshot extends ReviewState {
  activity: Activity | null;
  webMcpAvailable: boolean;
  agentApplyAuthorized: boolean;
  selectedLayer: ElementId;
  selectedChange: ChangeId | null;
}

function freezeSnapshot(snapshot: AppSnapshot): AppSnapshot {
  Object.freeze(snapshot.modifiedElements);
  Object.freeze(snapshot.document.elements);
  Object.values(snapshot.document.layouts).forEach(Object.freeze);
  Object.freeze(snapshot.document.layouts);
  Object.freeze(snapshot.document);
  snapshot.proposal?.changes.forEach(Object.freeze);
  if (snapshot.proposal) {
    Object.freeze(snapshot.proposal.changes);
    Object.freeze(snapshot.proposal);
  }
  return Object.freeze(snapshot);
}
export function createAppStore() {
  const review = createReviewAuthority();
  let activity: Activity | null = null;
  let webMcpAvailable = false;
  let agentApplyAuthorized = false;
  let selectedLayer: ElementId = "headline";
  let selectedChange: ChangeId | null = null;
  let snapshot: AppSnapshot = freezeSnapshot({
    ...review.getState(),
    activity,
    webMcpAvailable,
    agentApplyAuthorized,
    selectedLayer,
    selectedChange,
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
      if (!review.getState().proposal) throw new Error("No active proposal");
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
      return run("reject_change_set", () => review.reject());
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
