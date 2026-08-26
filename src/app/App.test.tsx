import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
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
  expect(screen.queryByText("Title is required")).not.toBeInTheDocument();
  expect(screen.queryByText("Objective is required")).not.toBeInTheDocument();
  expect(
    screen.queryByText("Proposed value is required"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Rationale is required")).not.toBeInTheDocument();
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
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Inspect Headline change" }),
    ).toHaveFocus(),
  );
  expect(
    screen.getAllByText(
      (_, element) => element?.textContent === "A custom\nmobile headline",
    ).length,
  ).toBeGreaterThan(0);
  expect(screen.getByLabelText("current mobile canvas")).toHaveTextContent(
    "Make room for what comes next.",
  );
  const proposedMobile = screen.getByLabelText("proposed mobile canvas");
  expect(within(proposedMobile).getByText("A custom")).toBeVisible();
  expect(within(proposedMobile).getByText("mobile headline")).toBeVisible();
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
  await user.selectOptions(
    screen.getByLabelText("Layer for change 1"),
    "image",
  );
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
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "Create proposal" })[1],
    ).toHaveFocus(),
  );
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
    screen.getByRole("option", { name: "Image, 1 proposed change" }),
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

test("exposes selected, proposed, and protected layer semantics", () => {
  const store = createAppStore();
  store.propose("Review the mobile layout");
  render(<App store={store} />);

  expect(
    screen.getByRole("option", {
      name: "Headline, selected, 1 proposed change",
    }),
  ).toHaveAttribute("aria-selected", "true");
  expect(
    screen.getByRole("option", {
      name: "Logo, protected, 1 proposed change",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("option", {
      name: "Legal, protected, no proposed changes",
    }),
  ).toBeVisible();
});

test("removes a layer proposal indicator as its final decision resolves", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);

  expect(
    screen.getByRole("option", {
      name: "Headline, selected, 1 proposed change",
    }),
  ).toBeVisible();
  await user.click(
    screen.getByRole("button", { name: "Approve Headline change" }),
  );

  expect(
    screen.getByRole("option", {
      name: "Headline, selected, no proposed changes",
    }),
  ).toBeVisible();
  expect(
    screen.getByRole("option", { name: "Image, 1 proposed change" }),
  ).toBeVisible();
});

test("supports roving keyboard focus and activates a focused layer", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);
  const headline = screen.getByRole("option", {
    name: "Headline, selected, 1 proposed change",
  });
  headline.focus();

  await user.keyboard("{ArrowDown}");
  const image = screen.getByRole("option", {
    name: "Image, 1 proposed change",
  });
  expect(image).toHaveFocus();
  expect(store.getSnapshot().selectedLayer).toBe("headline");

  await user.keyboard("{Enter}");
  expect(store.getSnapshot().selectedLayer).toBe("image");
  expect(image).toHaveAttribute("aria-selected", "true");
});

test("selects unchanged layers without retaining stale change details", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);

  await user.click(
    screen.getByRole("option", { name: "Body Copy, no proposed changes" }),
  );

  expect(store.getSnapshot()).toMatchObject({
    selectedLayer: "body",
    selectedChange: null,
  });
  expect(
    screen.getByRole("option", {
      name: "Body Copy, selected, no proposed changes",
    }),
  ).toHaveAttribute("aria-selected", "true");
  expect(screen.getAllByLabelText("Selected Body Copy layer")).toHaveLength(2);
  expect(screen.getByText("Body Copy has no proposed changes.")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Inspect Headline change" }),
  ).not.toHaveAttribute("aria-current");
});

test("synchronizes change selection back to Layers and the preview", async () => {
  const user = userEvent.setup();
  const { store } = activeStore();
  render(<App store={store} />);

  await user.click(
    screen.getByRole("button", { name: "Inspect Image change" }),
  );

  expect(
    screen.getByRole("option", {
      name: "Image, selected, 1 proposed change",
    }),
  ).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Selected Image layer")).toBeVisible();
  expect(screen.getByLabelText("proposed crop boundary")).toBeVisible();
});

test("keeps externally selected layer rows visible within the navigator", async () => {
  const user = userEvent.setup();
  const scrollIntoView = vi.fn();
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  try {
    const { store } = activeStore();
    render(<App store={store} />);
    scrollIntoView.mockClear();

    await user.click(
      screen.getByRole("button", { name: "Inspect Image change" }),
    );

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});

test("keeps protected layers inspectable while mutation remains blocked", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  const proposal = store.propose("Review the protected brand boundary");
  const logoChange = proposal.changes.find(
    (change) => change.target === "logo",
  )!;
  const committed = store.getSnapshot().document;
  render(<App store={store} />);

  await user.click(
    screen.getByRole("option", {
      name: "Logo, protected, 1 proposed change",
    }),
  );

  expect(
    screen.getByRole("option", {
      name: "Logo, selected, protected, 1 proposed change",
    }),
  ).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Selected Logo layer")).toBeVisible();
  expect(screen.getByText(/Logo is protected/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Approve Logo change" }),
  ).not.toBeInTheDocument();
  expect(() => store.setApproval(logoChange.id, true)).toThrow(
    "Logo is protected",
  );
  expect(store.getSnapshot().document).toEqual(committed);
});

test("preserves the full accessible name for long imported layer labels", () => {
  const store = createAppStore();
  const document = createInitialDocument();
  document.elements.body.label =
    "International Campaign Headline Supporting Description";
  store.importLayout(JSON.stringify(document));
  render(<App store={store} />);

  const layer = screen.getByRole("option", {
    name: "International Campaign Headline Supporting Description, no proposed changes",
  });
  expect(layer).toBeVisible();
  expect(
    within(layer).getByTitle(
      "International Campaign Headline Supporting Description",
    ),
  ).toBeVisible();
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
  expect(
    screen.getByRole("option", {
      name: "Logo, protected, no proposed changes",
    }),
  ).toBeVisible();
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
