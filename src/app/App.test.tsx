import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { App } from "./App";
import { createAppStore } from "./store";

test("renders the application shell", () => {
  render(<App />);
  expect(screen.getByRole("main")).toHaveTextContent("FrameGuard");
  expect(screen.getByText("Nothing changes without approval.")).toBeVisible();
  expect(screen.getByText(/WebMCP unavailable/)).toBeVisible();
});

test("visibly reflects proposal, approval, apply, and undo", async () => {
  const user = userEvent.setup();
  const store = createAppStore();
  render(<App store={store} />);
  await user.click(
    screen.getByRole("button", { name: "Create demo proposal" }),
  );
  expect(screen.getByText("Logo move blocked")).toBeVisible();
  expect(screen.getByLabelText("headline boundaries")).toBeVisible();
  await user.click(screen.getByLabelText("Approve Headline reflow"));
  await user.click(screen.getByLabelText("Approve Image crop"));
  await user.click(screen.getByRole("button", { name: "Apply 2 changes" }));
  expect(screen.getByText("REVISION 02")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText("REVISION 01")).toBeVisible();
});

test("reject removes the proposal and preserves committed revision", async () => {
  const user = userEvent.setup();
  render(<App store={createAppStore()} />);
  await user.click(
    screen.getByRole("button", { name: "Create demo proposal" }),
  );
  await user.click(screen.getByRole("button", { name: /Reject/ }));
  expect(screen.getByText("No active proposal")).toBeVisible();
  expect(screen.getByText("REVISION 01")).toBeVisible();
});
