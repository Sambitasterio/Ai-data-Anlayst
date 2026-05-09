import { expect, test } from "@playwright/test";

test("landing page exposes product title", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AI Data Analyst")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Talk to your data in plain English/i }),
  ).toBeVisible();
});

test("chat page loads composer", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByRole("heading", { name: "Chat" })).toBeVisible();
  await expect(page.getByPlaceholder("Ask a question about your dataset...")).toBeDisabled();
});
