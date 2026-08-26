import {
  createReviewAuthority,
  type ChangeId,
  type ReviewState,
} from "../review/review";
export interface Activity {
  tool: string;
  result: string;
}
export interface AppSnapshot extends ReviewState {
  activity: Activity | null;
  webMcpAvailable: boolean;
}
export function createAppStore() {
  const review = createReviewAuthority();
  let activity: Activity | null = null;
  let webMcpAvailable = false;
  let snapshot: AppSnapshot = {
    ...review.getState(),
    activity,
    webMcpAvailable,
  };
  const listeners = new Set<() => void>();
  const emit = () => {
    snapshot = { ...review.getState(), activity, webMcpAvailable };
    listeners.forEach((listener) => listener());
  };
  const run = <T>(tool: string, action: () => T): T => {
    try {
      const result = action();
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
      return run("propose_adaptation", () => review.propose(objective));
    },
    setApproval(id: ChangeId, approved: boolean) {
      return run("set_change_approval", () => review.setApproval(id, approved));
    },
    apply() {
      return run("apply_approved_changes", () => review.apply());
    },
    reject() {
      return run("reject_change_set", () => review.reject());
    },
    undo() {
      return run("undo_last_change_set", () => review.undo());
    },
    record(tool: string, result: string) {
      activity = { tool, result };
      emit();
    },
  };
}
export type AppStore = ReturnType<typeof createAppStore>;
