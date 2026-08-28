import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { App } from "./App";
import { createAppStore } from "./store";
import { createDraftRecovery } from "../recovery/recovery";
import {
  DRAFT_RECOVERY_KEY,
  DRAFT_RECOVERY_OPT_IN_KEY,
} from "../recovery/recovery";

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

function renderRecoverableApp(storage = new MemoryStorage()) {
  render(
    <App store={createAppStore({ recovery: createDraftRecovery(storage) })} />,
  );
  return storage;
}

test("offers explicit browser-local recovery without loading a workspace", async () => {
  const user = userEvent.setup();
  const storage = renderRecoverableApp();
  const control = screen.getByRole("checkbox", {
    name: "Recover in-progress reviews after refresh",
  });
  expect(control).not.toBeChecked();
  expect(screen.getByText(/saved only in this browser/i)).toHaveAttribute(
    "id",
    "draft-recovery-description",
  );
  expect(control).toHaveAttribute(
    "aria-describedby",
    "draft-recovery-description draft-recovery-status",
  );
  await user.click(control);
  expect(control).toBeChecked();
  expect(storage.getItem(DRAFT_RECOVERY_OPT_IN_KEY)).toBe("true");
  expect(storage.getItem(DRAFT_RECOVERY_KEY)).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Recovery enabled");
  expect(screen.getByText("Start your first review")).toBeVisible();
});

test("supports native keyboard opt-in with visible focus and polite status", async () => {
  const user = userEvent.setup();
  renderRecoverableApp();
  const control = screen.getByRole("checkbox", {
    name: "Recover in-progress reviews after refresh",
  });

  control.focus();
  expect(control).toHaveFocus();
  await user.keyboard("[Space]");

  expect(control).toBeChecked();
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
});

test("reports browser storage errors without presenting a saved state", async () => {
  const user = userEvent.setup();
  const storage = new MemoryStorage();
  vi.spyOn(storage, "setItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  renderRecoverableApp(storage);

  await user.click(
    screen.getByRole("checkbox", {
      name: "Recover in-progress reviews after refresh",
    }),
  );

  expect(screen.getByRole("status")).toHaveTextContent(
    "Draft recovery unavailable: storage blocked",
  );
  expect(screen.getByRole("status")).toHaveClass("error");
});

test("turns off and clears saved bytes without mutating the active review", async () => {
  const user = userEvent.setup();
  const storage = renderRecoverableApp();
  await user.click(
    screen.getByRole("checkbox", {
      name: "Recover in-progress reviews after refresh",
    }),
  );
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
  await user.type(screen.getByLabelText("Proposal title"), "Saved UI review");
  await user.type(
    screen.getByLabelText("Proposal objective"),
    "Recover this proposal.",
  );
  await user.type(
    screen.getByLabelText("Proposed value for change 1"),
    "Recovered headline",
  );
  await user.type(
    screen.getByLabelText("Rationale for change 1"),
    "Keep the draft.",
  );
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));
  expect(storage.getItem(DRAFT_RECOVERY_KEY)).not.toBeNull();
  await user.click(
    screen.getByRole("button", { name: "Turn off and clear saved draft" }),
  );
  expect(
    screen.getByRole("heading", { name: "Saved UI review" }),
  ).toBeVisible();
  expect(storage.getItem(DRAFT_RECOVERY_KEY)).toBeNull();
  expect(storage.getItem(DRAFT_RECOVERY_OPT_IN_KEY)).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("saved draft cleared");
});
