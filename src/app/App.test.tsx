import { render, screen } from "@testing-library/react";
import { App } from "./App";

test("renders the application shell", () => {
  render(<App />);
  expect(screen.getByRole("main")).toHaveTextContent("FrameGuard");
});
