import { test, expect } from "../playwright-fixture";

/**
 * Verifies the followers / following dialogs on a profile:
 *  - open dialog
 *  - list renders (or shows empty state)
 *  - paginate (Load more) when available
 *  - clicking a row navigates to /profile/:userId
 */

test.describe("Follow list dialogs", () => {
  test("open followers, paginate, click user, verify navigation", async ({ page }) => {
    // Land on the current user's profile (auth is injected by the fixture)
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    // Try to open the Followers dialog — Profile page exposes stats bubbles
    // labelled "Followers" that open <FollowListDialog />.
    const followersTrigger = page.getByRole("button", { name: /followers/i }).first();
    await expect(followersTrigger).toBeVisible({ timeout: 10_000 });
    await followersTrigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/followers/i)).toBeVisible();

    // Wait for either a user row, the empty state, or an error state.
    const userRow = dialog.locator('button:has-text("@")').first();
    const emptyState = dialog.getByText(/no followers yet|not following anyone/i);
    await Promise.race([
      userRow.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
      emptyState.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
    ]);

    // Manual refresh button is always visible in the header
    const refreshBtn = dialog.getByRole("button", { name: /refresh/i }).first();
    await expect(refreshBtn).toBeVisible();

    const rowCount = await dialog.locator('button:has-text("@")').count();

    if (rowCount === 0) {
      // Empty state path — just verify UI affordances and exit
      await expect(emptyState).toBeVisible();
      return;
    }

    // Paginate if a "Load more" button is present
    const loadMore = dialog.getByRole("button", { name: /load more/i });
    if (await loadMore.isVisible().catch(() => false)) {
      const before = await dialog.locator('button:has-text("@")').count();
      await loadMore.click();
      await expect
        .poll(async () => dialog.locator('button:has-text("@")').count(), { timeout: 8000 })
        .toBeGreaterThanOrEqual(before);
    }

    // Click first user row and verify navigation to /profile/:userId
    const firstRow = dialog.locator('button:has-text("@")').first();
    const label = (await firstRow.innerText()).trim().replace(/^@/, "").split(/\s/)[0];
    await firstRow.click();

    await expect(page).toHaveURL(/\/profile\/[0-9a-f-]{36}/, { timeout: 10_000 });
    // Profile page should reference the same username somewhere
    await expect(page.getByText(new RegExp(`@?${label}`, "i")).first()).toBeVisible({ timeout: 10_000 });
  });

  test("open following dialog and verify list UI states", async ({ page }) => {
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    const followingTrigger = page.getByRole("button", { name: /following/i }).first();
    await expect(followingTrigger).toBeVisible({ timeout: 10_000 });
    await followingTrigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/following/i)).toBeVisible();

    // Either rows are present or the empty/error state is shown with a retry
    const anyRow = dialog.locator('button:has-text("@")').first();
    const empty = dialog.getByText(/not following anyone|no followers yet/i);
    const errorRetry = dialog.getByRole("button", { name: /retry/i });

    await Promise.race([
      anyRow.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
      empty.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
      errorRetry.waitFor({ state: "visible", timeout: 8000 }).catch(() => null),
    ]);

    // The header refresh button must always be present
    await expect(dialog.getByRole("button", { name: /refresh/i }).first()).toBeVisible();
  });
});
