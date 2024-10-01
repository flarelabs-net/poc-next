import { test, expect } from "@playwright/test";

test("the static index page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Next.js logo" })).toBeVisible();
});

// Currently not supported
test.skip("the hello-world api GET route", async ({ page }) => {
  const res = await page.request.get("/api/hello");
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toEqual({ name: "John Doe" });
});

// Currently not supported
test.skip("the server-time page (which uses getServerSideProps)", async ({ page }) => {
  await page.goto("/server-time");
  const heading = page.getByRole("heading");
  await expect(heading).toBeVisible();
  expect(await heading.textContent()).toMatch(
    /The server time is: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/
  );
});
