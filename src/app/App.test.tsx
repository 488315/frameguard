import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { createInitialDocument } from "../editor/document";
import { App } from "./App";
import { createAppStore } from "./store";

const customInput = {
  expectedRevision: 1,
  title: "Custom review",
  objective: "Improve the mobile composition.",
  changes: [
    {
      target: "headline" as const,
      operation: {
        kind: "set_text" as const,
        canvas: "mobile" as const,
        value: "A custom\nmobile headline",
      },
      rationale: "Improve line balance.",
    },
    {
      target: "image" as const,
      operation: {
        kind: "set_image_position" as const,
        canvas: "mobile" as const,
        value: "72% center",
      },
      rationale: "Keep the subject visible.",
    },
  ],
};

function activeStore() {
  const store = createAppStore();
  const proposal = store.createProposal(customInput);
  return { store, proposal };
}

async function openComposer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getAllByRole("button", { name: "Create proposal" })[0],
  );
}

async function fillFirstDraft(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Proposal title"), "Custom review");
  await user.type(
    screen.getByLabelText("Proposal objective"),
    "Improve the mobile composition.",
  );
  await user.type(
    screen.getByLabelText("Proposed value for change 1"),
    "A custom{enter}mobile headline",
  );
  await user.type(
    screen.getByLabelText("Rationale for change 1"),
    "Improve line balance.",
  );
}

test("renders the empty workspace with no demo layers or canvases", () => {
  render(<App />);
  expect(screen.getByText("Start your first review")).toBeVisible();
  expect(screen.getByText("No layers yet")).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "No active proposal" }),
  ).toBeVisible();
  expect(
    screen.getAllByRole("button", { name: "Create proposal" }),
  ).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Reject all" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Apply 0 changes" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Allow agent apply once" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  expect(screen.queryByLabelText("desktop canvas")).not.toBeInTheDocument();
  expect(screen.queryByText("Logo")).not.toBeInTheDocument();
  expect(screen.getByText("No review loaded")).toBeVisible();
});

test("creates a custom proposal through the accessible proposal composer", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await openComposer(user);
  expect(
    screen.getByRole("heading", { name: "Create proposal" }),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));
  expect(await screen.findByText("Title is required")).toBeVisible();
  expect(screen.getByLabelText("Proposal title")).toHaveFocus();
  await fillFirstDraft(user);
  await user.click(screen.getByRole("button", { name: "Add change" }));
  await user.selectOptions(
    screen.getByLabelText("Layer for change 2"),
    "image",
  );
  await user.type(
    screen.getByLabelText("Proposed value for change 2"),
    "72% center",
  );
  await user.type(
    screen.getByLabelText("Rationale for change 2"),
    "Keep the subject visible.",
  );
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));

  expect(screen.getByRole("heading", { name: "Custom review" })).toBeVisible();
  expect(
    screen.getAllByText(
      (_, element) => element?.textContent === "A custom\nmobile headline",
    ).length,
  ).toBeGreaterThan(0);
  expect(store.getSnapshot().document?.revision).toBe(1);
  expect(store.getSnapshot().proposal?.changes).toHaveLength(2);
});

test("keeps an invalid draft open and focuses its exact operation field", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await openComposer(user);
  await user.type(screen.getByLabelText("Proposal title"), "Crop review");
  await user.type(
    screen.getByLabelText("Proposal objective"),
    "Keep the subject visible.",
  );
  await user.selectOptions(screen.getByLabelText("Layer for change 1"), "image");
  await user.type(
    screen.getByLabelText("Proposed value for change 1"),
    "somewhere interesting",
  );
  await user.type(
    screen.getByLabelText("Rationale for change 1"),
    "Shift the focal point.",
  );
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));

  expect(
    await screen.findAllByText(
      "Image position must be center, left center, right center, or 0%-100% center",
    ),
  ).toHaveLength(2);
  expect(screen.getByLabelText("Proposed value for change 1")).toHaveFocus();
  expect(screen.getByLabelText("Proposal title")).toHaveValue("Crop review");
  expect(store.getSnapshot().proposal).toBeNull();
});

test("cancels drafts and supports add/remove without losing keyboard focus", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await openComposer(user);
  await user.click(screen.getByRole("button", { name: "Add change" }));
  expect(screen.getByLabelText("Layer for change 2")).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Remove change 2" }));
  expect(screen.queryByLabelText("Layer for change 2")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add change" })).toHaveFocus();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByRole("heading", { name: "No active proposal" }),
  ).toBeVisible();
});

test("shows protected targets during drafting and authority-blocks the result", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await openComposer(user);
  await fillFirstDraft(user);
  await user.selectOptions(screen.getByLabelText("Layer for change 1"), "logo");
  expect(
    screen.getByText(/Protected · this attempt will be blocked/),
  ).toBeVisible();
  await user.type(
    screen.getByLabelText("Proposed value for change 1"),
    "Move logo",
  );
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));
  expect(screen.getByText("Blocked", { selector: "span" })).toBeVisible();
  expect(store.getSnapshot().proposal?.changes[0]).toMatchObject({
    target: "logo",
    applicable: false,
    blockedReason: "Logo is protected",
  });
});

test("selects dynamic rows and synchronizes the non-mutating proposal preview", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);
  await user.click(
    screen.getByRole("button", { name: "Image, proposal affected" }),
  );
  expect(
    screen.getByRole("button", { name: "Inspect Image change" }),
  ).toHaveAttribute("aria-current", "true");
  expect(screen.getByLabelText("proposed crop boundary")).toBeVisible();
  expect(store.getSnapshot().document?.layouts.mobile.imagePosition).toBe(
    "center",
  );
  expect(
    store.getSnapshot().previewDocument?.layouts.mobile.imagePosition,
  ).toBe("72% center");
});

test("reviews individual changes, applies only approval, records history, and undoes", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);
  await user.click(
    screen.getByRole("button", { name: "Approve Headline change" }),
  );
  await user.click(screen.getByRole("button", { name: "Reject Image change" }));
  expect(screen.getByText("Approved", { selector: "span" })).toBeVisible();
  expect(screen.getByText("Rejected", { selector: "span" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Apply 1 change" }));
  expect(screen.getByText("REVISION 02")).toBeVisible();
  expect(store.getSnapshot().reviewHistory[0]).toMatchObject({
    outcome: "applied",
  });
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("REVISION 01")).toBeVisible();
});

test("reject all preserves an imported committed document", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  store.importLayout(JSON.stringify(createInitialDocument()));
  store.createProposal(customInput);
  render(<App store={store} />);
  await user.click(screen.getByRole("button", { name: "Reject all" }));
  expect(
    screen.getByRole("heading", { name: "No active proposal" }),
  ).toBeVisible();
  expect(store.getSnapshot()).toMatchObject({
    document: { revision: 1 },
    proposal: null,
  });
  expect(store.getSnapshot().reviewHistory[0]).toMatchObject({
    outcome: "rejected",
  });
});

test("keeps the draft and committed state when activation fails", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  store.createProposal = () => {
    throw new Error("Document changed; regenerate the proposal");
  };
  render(<App store={store} />);
  await openComposer(user);
  await fillFirstDraft(user);
  await user.click(screen.getByRole("button", { name: "Submit proposal" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Document changed");
  expect(screen.getByLabelText("Proposal title")).toHaveValue("Custom review");
  expect(store.getSnapshot()).toMatchObject({ document: null, proposal: null });
});

test("authorizes agent apply only after a human approval and resets on decisions", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);
  const authorize = screen.getByRole("button", {
    name: "Allow agent apply once",
  });
  expect(authorize).toBeDisabled();
  await user.click(
    screen.getByRole("button", { name: "Approve Headline change" }),
  );
  expect(authorize).toBeEnabled();
  await user.click(authorize);
  expect(store.getSnapshot().agentApplyAuthorized).toBe(true);
  await user.click(screen.getByRole("button", { name: "Reject Image change" }));
  expect(store.getSnapshot().agentApplyAuthorized).toBe(false);
});

test("imports valid layouts and keeps the empty state usable after invalid input", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  const view = render(<App store={store} />);
  await user.upload(
    screen.getByLabelText("Import layout file"),
    new File(["not json"], "broken.json", { type: "application/json" }),
  );
  expect(
    await screen.findByText("Import must contain valid JSON"),
  ).toBeVisible();
  expect(screen.getByText("Start your first review")).toBeVisible();
  view.unmount();

  const validStore = createAppStore();
  render(<App store={validStore} />);
  await user.upload(
    screen.getByLabelText("Import layout file"),
    new File([JSON.stringify(createInitialDocument())], "layout.json", {
      type: "application/json",
    }),
  );
  expect(await screen.findByLabelText("desktop canvas")).toBeVisible();
  expect(screen.getByRole("button", { name: "Logo, protected" })).toBeVisible();
});

test("supports keyboard activation and visible activity recovery", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  const create = screen.getAllByRole("button", { name: "Create proposal" })[0];
  create.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByLabelText("Proposal title")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  store.record("inspect_document", "Document inspected after recovery");
  await waitFor(() =>
    expect(screen.getByText("inspect_document")).toBeVisible(),
  );
  expect(screen.getByText("Document inspected after recovery")).toBeVisible();
});
