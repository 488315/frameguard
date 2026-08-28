import { describe, expect, it, vi } from "vitest";
import { createInitialDocument } from "../editor/document";
import { createAppStore } from "../app/store";
import {
  DRAFT_RECOVERY_KEY,
  DRAFT_RECOVERY_OPT_IN_KEY,
  MAX_RECOVERY_BYTES,
  createDraftRecovery,
} from "./recovery";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const proposalInput = {
  expectedRevision: 1,
  title: "Recoverable review",
  objective: "Keep an interrupted review safe.",
  changes: [
    {
      target: "headline" as const,
      operation: {
        kind: "set_text" as const,
        canvas: "mobile" as const,
        value: "Recovered headline",
      },
      rationale: "Preserve the approved edit.",
    },
    {
      target: "logo" as const,
      operation: {
        kind: "set_text" as const,
        canvas: "mobile" as const,
        value: "Move logo",
      },
      rationale: "Prove protected state is rederived.",
    },
  ],
};

function enabledStorage() {
  const storage = new MemoryStorage();
  storage.setItem(DRAFT_RECOVERY_OPT_IN_KEY, "true");
  return storage;
}

function createSavedPayload() {
  const storage = enabledStorage();
  const store = createAppStore({ recovery: createDraftRecovery(storage) });
  store.createProposal(proposalInput);
  return {
    storage,
    payload: JSON.parse(storage.getItem(DRAFT_RECOVERY_KEY)!) as Record<
      string,
      unknown
    >,
  };
}

describe("draft recovery adapter", () => {
  it("keeps default startup empty and enabling alone does not provision a workspace", () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { enabled: false },
    });
    store.setRecoveryEnabled(true);
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { enabled: true, tone: "saved" },
    });
    expect(storage.getItem(DRAFT_RECOVERY_KEY)).toBeNull();
  });

  it("ignores a valid saved draft when browser-local recovery is disabled", () => {
    const storage = enabledStorage();
    const first = createAppStore({ recovery: createDraftRecovery(storage) });
    first.createProposal(proposalInput);
    expect(storage.getItem(DRAFT_RECOVERY_KEY)).not.toBeNull();
    storage.removeItem(DRAFT_RECOVERY_OPT_IN_KEY);

    const disabled = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(disabled.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { enabled: false, tone: "off" },
    });
  });

  it.each(["provisional", "imported"] as const)(
    "recovers a valid %s review with fresh IDs",
    (origin) => {
      const storage = enabledStorage();
      const first = createAppStore({ recovery: createDraftRecovery(storage) });
      if (origin === "imported")
        first.importLayout(JSON.stringify(createInitialDocument()));
      const proposal = first.createProposal(proposalInput);
      first.setApproval(proposal.changes[0].id, true);
      const oldIds = proposal.changes.map((change) => change.id);

      const restored = createAppStore({
        recovery: createDraftRecovery(storage),
      });
      expect(restored.getSnapshot()).toMatchObject({
        document: { revision: 1 },
        proposal: {
          title: proposalInput.title,
          changes: [
            { decision: "approved", applicable: true },
            { decision: "pending", applicable: false },
          ],
        },
        recovery: { enabled: true, tone: "saved" },
      });
      expect(
        restored.getSnapshot().proposal!.changes.map((change) => change.id),
      ).not.toEqual(oldIds);

      restored.reject();
      expect(restored.getSnapshot().document === null).toBe(
        origin === "provisional",
      );
    },
  );

  it.each([
    ["malformed JSON", "{"],
    ["incompatible version", JSON.stringify({ version: 2 })],
    [
      "unexpected fields",
      JSON.stringify({
        version: 1,
        origin: "provisional",
        document: null,
        proposal: proposalInput,
        decisions: ["pending", "pending"],
        extra: true,
      }),
    ],
    ["oversized payload", "x".repeat(MAX_RECOVERY_BYTES + 1)],
  ])("fails closed for %s", (_label, payload) => {
    const storage = enabledStorage();
    storage.setItem(DRAFT_RECOVERY_KEY, payload);
    const store = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(store.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { enabled: true, tone: "error" },
    });
  });

  it("rejects protected approval tampering without publishing partial state", () => {
    const storage = enabledStorage();
    const first = createAppStore({ recovery: createDraftRecovery(storage) });
    first.createProposal(proposalInput);
    const payload = JSON.parse(storage.getItem(DRAFT_RECOVERY_KEY)!);
    payload.decisions[1] = "approved";
    storage.setItem(DRAFT_RECOVERY_KEY, JSON.stringify(payload));
    const restored = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(restored.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { tone: "error" },
    });
  });

  it.each([
    [
      "a stale proposal revision",
      (payload: Record<string, unknown>) => {
        (payload.proposal as Record<string, unknown>).expectedRevision = 2;
      },
    ],
    [
      "a partial proposal",
      (payload: Record<string, unknown>) => {
        delete (payload.proposal as Record<string, unknown>).objective;
      },
    ],
    [
      "an inconsistent decision count",
      (payload: Record<string, unknown>) => {
        payload.decisions = ["pending"];
      },
    ],
    [
      "an invalid decision",
      (payload: Record<string, unknown>) => {
        payload.decisions = ["selected", "pending"];
      },
    ],
    [
      "duplicate change identities",
      (payload: Record<string, unknown>) => {
        const proposal = payload.proposal as Record<string, unknown>;
        const changes = proposal.changes as unknown[];
        changes.push(structuredClone(changes[0]));
        payload.decisions = ["pending", "pending", "pending"];
      },
    ],
    [
      "normalized identity drift",
      (payload: Record<string, unknown>) => {
        (payload.proposal as Record<string, unknown>).title =
          " Recoverable review ";
      },
    ],
  ] satisfies Array<[string, (payload: Record<string, unknown>) => void]>)(
    "fails closed for %s",
    (_label, mutate) => {
      const { storage, payload } = createSavedPayload();
      mutate(payload);
      storage.setItem(DRAFT_RECOVERY_KEY, JSON.stringify(payload));

      const restored = createAppStore({
        recovery: createDraftRecovery(storage),
      });
      expect(restored.getSnapshot()).toMatchObject({
        document: null,
        proposal: null,
        recovery: { enabled: true, tone: "error" },
      });
    },
  );

  it("rejects a corrupt imported document without adopting its proposal", () => {
    const storage = enabledStorage();
    const first = createAppStore({ recovery: createDraftRecovery(storage) });
    first.importLayout(JSON.stringify(createInitialDocument()));
    first.createProposal(proposalInput);
    const payload = JSON.parse(storage.getItem(DRAFT_RECOVERY_KEY)!) as {
      document: { elements: { logo: { protected: boolean } } };
    };
    payload.document.elements.logo.protected = false;
    storage.setItem(DRAFT_RECOVERY_KEY, JSON.stringify(payload));

    const restored = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(restored.getSnapshot()).toMatchObject({
      document: null,
      proposal: null,
      recovery: { tone: "error" },
    });
  });

  it("persists only authority-owned proposal input, origin, document, and decisions", () => {
    const storage = enabledStorage();
    const first = createAppStore({ recovery: createDraftRecovery(storage) });
    const proposal = first.createProposal(proposalInput);
    first.setApproval(proposal.changes[0].id, true);
    first.setWebMcpAvailable(true);
    first.authorizeAgentApply();
    first.record("test_activity", "not durable");

    const source = storage.getItem(DRAFT_RECOVERY_KEY)!;
    const payload = JSON.parse(source);
    expect(Object.keys(payload).sort()).toEqual([
      "decisions",
      "document",
      "origin",
      "proposal",
      "version",
    ]);
    expect(payload).toEqual({
      version: 1,
      origin: "provisional",
      document: null,
      proposal: proposalInput,
      decisions: ["approved", "pending"],
    });
    for (const id of [
      proposal.id,
      ...proposal.changes.map((change) => change.id),
    ]) {
      expect(source).not.toContain(id);
    }
    expect(source).not.toMatch(
      /before|applicable|blockedReason|preview|selected|activity|webMcp|authorized|history|undo|composer/i,
    );

    const restored = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(restored.getSnapshot()).toMatchObject({
      activity: null,
      webMcpAvailable: false,
      agentApplyAuthorized: false,
      selectedLayer: null,
      selectedChange: null,
      canUndo: false,
      reviewHistory: [],
    });
  });

  it("clears bytes after apply, reset, reject, turn-off, and explicit clear without mutating a live review", () => {
    for (const action of ["apply", "reset", "reject"] as const) {
      const storage = enabledStorage();
      const store = createAppStore({ recovery: createDraftRecovery(storage) });
      const proposal = store.createProposal(proposalInput);
      if (action === "apply") {
        store.setApproval(proposal.changes[0].id, true);
        store.applyFromUi();
      }
      if (action === "reset") store.resetWorkspace();
      if (action === "reject") store.reject();
      expect(storage.getItem(DRAFT_RECOVERY_KEY)).toBeNull();
    }
    const storage = enabledStorage();
    const store = createAppStore({ recovery: createDraftRecovery(storage) });
    store.createProposal(proposalInput);
    store.clearSavedDraft();
    expect(store.getSnapshot().proposal).not.toBeNull();
    expect(store.getSnapshot().recovery).toMatchObject({
      enabled: true,
      tone: "unsaved",
    });
    expect(storage.getItem(DRAFT_RECOVERY_KEY)).toBeNull();
    store.setRecoveryEnabled(false);
    expect(store.getSnapshot()).toMatchObject({
      proposal: { title: proposalInput.title },
      recovery: { enabled: false },
    });
    expect(storage.getItem(DRAFT_RECOVERY_OPT_IN_KEY)).toBeNull();
  });

  it("keeps valid in-memory operations and reports storage exceptions", () => {
    const storage = enabledStorage();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("quota unavailable");
    });
    const store = createAppStore({ recovery: createDraftRecovery(storage) });
    const proposal = store.createProposal(proposalInput);
    expect(proposal.title).toBe(proposalInput.title);
    expect(store.getSnapshot()).toMatchObject({
      proposal: { title: proposalInput.title },
      recovery: { enabled: true, tone: "error" },
    });
  });

  it("replays rejected decisions and preserves undo after a recovered apply", () => {
    const storage = enabledStorage();
    const first = createAppStore({ recovery: createDraftRecovery(storage) });
    const proposal = first.createProposal({
      ...proposalInput,
      changes: [
        proposalInput.changes[0],
        {
          target: "image",
          operation: {
            kind: "set_image_position",
            canvas: "mobile",
            value: "72% center",
          },
          rationale: "Keep the original crop after review.",
        },
      ],
    });
    first.setApproval(proposal.changes[0].id, true);
    first.rejectChange(proposal.changes[1].id);

    const restored = createAppStore({ recovery: createDraftRecovery(storage) });
    expect(
      restored.getSnapshot().proposal?.changes.map((change) => change.decision),
    ).toEqual(["approved", "rejected"]);
    restored.applyFromUi();
    expect(restored.getSnapshot()).toMatchObject({
      document: { revision: 2 },
      proposal: null,
      canUndo: true,
    });
    expect(restored.undo()).toMatchObject({
      changed: true,
      document: { revision: 1 },
    });
  });

  it("reports read and clear failures without adopting or rolling back state", () => {
    const unreadable = enabledStorage();
    vi.spyOn(unreadable, "getItem").mockImplementation(() => {
      throw new Error("read blocked");
    });
    expect(
      createAppStore({
        recovery: createDraftRecovery(unreadable),
      }).getSnapshot(),
    ).toMatchObject({
      document: null,
      proposal: null,
      recovery: { tone: "error" },
    });

    const uncleared = enabledStorage();
    const store = createAppStore({ recovery: createDraftRecovery(uncleared) });
    const proposal = store.createProposal(proposalInput);
    store.setApproval(proposal.changes[0].id, true);
    vi.spyOn(uncleared, "removeItem").mockImplementation(() => {
      throw new Error("clear blocked");
    });
    store.applyFromUi();
    expect(store.getSnapshot()).toMatchObject({
      document: { revision: 2 },
      proposal: null,
      recovery: { tone: "error" },
    });
  });

  it("publishes an immutable recovery status with the store snapshot", () => {
    const store = createAppStore({
      recovery: createDraftRecovery(new MemoryStorage()),
    });

    expect(Object.isFrozen(store.getSnapshot().recovery)).toBe(true);
  });
});
