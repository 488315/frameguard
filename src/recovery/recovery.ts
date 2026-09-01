import { parseImportedDocument } from "../editor/document";
import {
  createReviewAuthority,
  type ActiveDraftRecovery,
  type ReviewAuthority,
} from "../review/review";

export const DRAFT_RECOVERY_OPT_IN_KEY = "frameguard.draft-recovery.enabled";
export const DRAFT_RECOVERY_KEY = "frameguard.draft-recovery.v1";
export const MAX_RECOVERY_BYTES = 64 * 1024;

export interface RecoveryStatus {
  enabled: boolean;
  tone: "off" | "saved" | "unsaved" | "error";
  message: string;
}

export interface DraftRecovery {
  bootstrap(): { authority: ReviewAuthority; status: RecoveryStatus };
  sync(authority: ReviewAuthority): RecoveryStatus;
  enable(authority: ReviewAuthority): RecoveryStatus;
  disableAndClear(): RecoveryStatus;
  clearSavedDraft(authority: ReviewAuthority): RecoveryStatus;
}

interface RecoveryPayload extends ActiveDraftRecovery {
  version: 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function parsePayload(source: string): RecoveryPayload {
  if (new TextEncoder().encode(source).byteLength > MAX_RECOVERY_BYTES)
    throw new Error("Saved draft exceeds the recovery size limit");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Saved draft is not valid JSON");
  }
  if (
    !isRecord(parsed) ||
    !hasExactKeys(parsed, [
      "version",
      "origin",
      "document",
      "proposal",
      "decisions",
    ]) ||
    parsed.version !== 1
  )
    throw new Error("Saved draft schema is incompatible");
  if (parsed.origin !== "provisional" && parsed.origin !== "imported")
    throw new Error("Saved draft origin is invalid");
  if (
    (parsed.origin === "provisional" && parsed.document !== null) ||
    (parsed.origin === "imported" && !isRecord(parsed.document))
  )
    throw new Error("Saved draft document does not match its origin");
  if (
    !isRecord(parsed.proposal) ||
    !hasExactKeys(parsed.proposal, [
      "expectedRevision",
      "title",
      "objective",
      "changes",
    ]) ||
    !Array.isArray(parsed.proposal.changes) ||
    !Array.isArray(parsed.decisions)
  )
    throw new Error("Saved draft proposal is malformed");
  for (const change of parsed.proposal.changes) {
    if (
      !isRecord(change) ||
      !hasExactKeys(change, ["target", "operation", "rationale"]) ||
      !isRecord(change.operation) ||
      !hasExactKeys(change.operation, ["kind", "canvas", "value"])
    )
      throw new Error("Saved draft change is malformed");
  }
  if (
    !parsed.decisions.every(
      (decision) =>
        decision === "pending" ||
        decision === "approved" ||
        decision === "rejected",
    )
  )
    throw new Error("Saved draft decision is invalid");
  return parsed as unknown as RecoveryPayload;
}

function restore(payload: RecoveryPayload): ReviewAuthority {
  const candidate = createReviewAuthority();
  if (payload.origin === "imported")
    candidate.loadDocument(
      parseImportedDocument(JSON.stringify(payload.document)),
    );
  const proposal = candidate.createProposal(payload.proposal);
  if (payload.decisions.length !== proposal.changes.length)
    throw new Error("Saved draft decisions are inconsistent");
  payload.decisions.forEach((decision, index) => {
    const change = proposal.changes[index];
    if (decision === "approved") candidate.setApproval(change.id, true);
    if (decision === "rejected") candidate.rejectChange(change.id);
  });
  const exported = candidate.exportActiveDraft();
  const expected = {
    origin: payload.origin,
    document: payload.document,
    proposal: payload.proposal,
    decisions: payload.decisions,
  };
  if (!exported || JSON.stringify(exported) !== JSON.stringify(expected))
    throw new Error("Saved draft did not reproduce consistently");
  return candidate;
}

export function createDraftRecovery(storage: Storage): DraftRecovery {
  let enabled = false;
  const errorStatus = (error: unknown): RecoveryStatus => ({
    enabled,
    tone: "error",
    message:
      error instanceof Error
        ? `Draft recovery unavailable: ${error.message}`
        : "Draft recovery unavailable",
  });
  const failClosedAfterClear = (error: unknown): RecoveryStatus => {
    try {
      storage.setItem(DRAFT_RECOVERY_OPT_IN_KEY, "false");
      enabled = false;
    } catch {
      // Preserve the original storage failure when opt-in invalidation also fails.
    }
    return errorStatus(error);
  };
  const persist = (authority: ReviewAuthority): RecoveryStatus => {
    if (!enabled)
      return { enabled: false, tone: "off", message: "Draft recovery is off." };
    try {
      const draft = authority.exportActiveDraft();
      if (!draft) storage.removeItem(DRAFT_RECOVERY_KEY);
      else {
        const source = JSON.stringify({ version: 1, ...draft });
        if (new TextEncoder().encode(source).byteLength > MAX_RECOVERY_BYTES)
          throw new Error("draft exceeds the recovery size limit");
        storage.setItem(DRAFT_RECOVERY_KEY, source);
      }
      return {
        enabled: true,
        tone: "saved",
        message: draft
          ? "Draft saved in this browser."
          : "Recovery enabled. New active reviews will be saved.",
      };
    } catch (error) {
      return authority.exportActiveDraft()
        ? errorStatus(error)
        : failClosedAfterClear(error);
    }
  };
  return {
    bootstrap() {
      const empty = createReviewAuthority();
      try {
        enabled = storage.getItem(DRAFT_RECOVERY_OPT_IN_KEY) === "true";
        if (!enabled)
          return {
            authority: empty,
            status: {
              enabled: false,
              tone: "off",
              message: "Draft recovery is off.",
            },
          };
        const source = storage.getItem(DRAFT_RECOVERY_KEY);
        if (!source)
          return {
            authority: empty,
            status: {
              enabled: true,
              tone: "saved",
              message: "Recovery enabled. New active reviews will be saved.",
            },
          };
        return {
          authority: restore(parsePayload(source)),
          status: {
            enabled: true,
            tone: "saved",
            message: "Saved draft recovered in this browser.",
          },
        };
      } catch (error) {
        return { authority: empty, status: errorStatus(error) };
      }
    },
    sync: persist,
    enable(authority) {
      enabled = true;
      try {
        storage.setItem(DRAFT_RECOVERY_OPT_IN_KEY, "true");
      } catch (error) {
        return errorStatus(error);
      }
      return persist(authority);
    },
    disableAndClear() {
      try {
        storage.removeItem(DRAFT_RECOVERY_KEY);
        storage.removeItem(DRAFT_RECOVERY_OPT_IN_KEY);
        enabled = false;
        return {
          enabled: false,
          tone: "off",
          message: "Draft recovery is off and saved draft cleared.",
        };
      } catch (error) {
        return failClosedAfterClear(error);
      }
    },
    clearSavedDraft(authority) {
      try {
        storage.removeItem(DRAFT_RECOVERY_KEY);
        const activeDraftRemains = authority.exportActiveDraft() !== null;
        return {
          enabled,
          tone:
            enabled && activeDraftRemains
              ? "unsaved"
              : enabled
                ? "saved"
                : "off",
          message: activeDraftRemains
            ? "Saved draft cleared. Current review remains open and is not saved."
            : "Saved draft cleared. Current review was not changed.",
        };
      } catch (error) {
        return failClosedAfterClear(error);
      }
    },
  };
}

export function createBrowserDraftRecovery(): DraftRecovery {
  try {
    if (!window.localStorage) throw new Error("browser storage is unavailable");
    return createDraftRecovery(window.localStorage);
  } catch (error) {
    const unavailable = () => {
      throw error;
    };
    return createDraftRecovery({
      get length() {
        return 0;
      },
      clear: unavailable,
      getItem: unavailable,
      key: unavailable,
      removeItem: unavailable,
      setItem: unavailable,
    });
  }
}
