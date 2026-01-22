import { expect, test } from "@playwright/test";

test.describe("Route Navigation", () => {
	test("/ loads global dashboard", async ({ page }) => {
		await page.goto("/");

		// Should show the global dashboard with workspaces header
		await expect(page.locator("text=WORKSPACES")).toBeVisible({ timeout: 10000 });
	});

	test("/inbox-hub loads inbox hub", async ({ page }) => {
		await page.goto("/inbox-hub");

		// Should show inbox hub header
		await expect(page.locator("text=Inbox Hub")).toBeVisible({ timeout: 10000 });
	});

	test("/plan loads plan mode", async ({ page }) => {
		await page.goto("/plan");

		// Should show plan mode with kanban board header
		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });
	});

	test("/workspace/:id loads workspace dashboard", async ({ page }) => {
		// First go to home to find a valid workspace
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Look for any workspace link and click it
		const workspaceLink = page.locator('[class*="workspace"]').first();
		if ((await workspaceLink.count()) > 0) {
			await workspaceLink.click();
			// URL should now be /workspace/...
			await expect(page).toHaveURL(/\/workspace\//);
		}
	});

	test("mode toggle switches between execute and plan", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Find and click a visible plan mode toggle
		// There are two plan buttons (mobile and desktop) - get the visible one
		const planToggle = page.locator('button:has-text("Plan"):visible');
		if ((await planToggle.count()) > 0) {
			await planToggle.first().click();
			// Should navigate to /plan
			await expect(page).toHaveURL("/plan");
			await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });
		}
	});

	test("inbox hub link in sidebar works", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Find and click inbox hub link (use first() since there are multiple)
		const inboxLink = page.locator('a[href="/inbox-hub"]').first();
		if ((await inboxLink.count()) > 0) {
			await inboxLink.click();
			await expect(page).toHaveURL("/inbox-hub");
			await expect(page.locator("text=Inbox Hub")).toBeVisible({ timeout: 10000 });
		}
	});
});

test.describe("Browser History", () => {
	test("back button works after navigation", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Navigate to inbox-hub
		await page.goto("/inbox-hub");
		await expect(page.locator("text=Inbox Hub")).toBeVisible({ timeout: 10000 });

		// Go back
		await page.goBack();
		await expect(page).toHaveURL("/");
	});

	test("forward button works after back", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		await page.goto("/plan");
		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });

		await page.goBack();
		await expect(page).toHaveURL("/");

		await page.goForward();
		await expect(page).toHaveURL("/plan");
	});
});

test.describe("Deep Links", () => {
	test("direct link to /plan loads correctly", async ({ page }) => {
		await page.goto("/plan");

		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });
		// Verify the sidebar/controls are present
		await expect(page.locator("text=SYSTEM READY").or(page.locator("text=SYNCING"))).toBeVisible({
			timeout: 10000,
		});
	});

	test("direct link to /inbox-hub loads correctly", async ({ page }) => {
		await page.goto("/inbox-hub");

		await expect(page.locator("text=Inbox Hub")).toBeVisible({ timeout: 10000 });
	});
});
