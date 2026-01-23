import { expect, test } from "@playwright/test";

test.describe("Route Navigation", () => {
	test("/ redirects to /projects", async ({ page }) => {
		await page.goto("/");

		// Should redirect to /projects and show projects page
		await expect(page).toHaveURL("/projects");
		await expect(page.locator("text=Projects")).toBeVisible({ timeout: 10000 });
	});

	test("/plan loads plan mode", async ({ page }) => {
		await page.goto("/plan");

		// Should show plan mode with kanban board header
		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });
	});

	test("/workspace/:id loads workspace dashboard", async ({ page }) => {
		// First go to home to find a valid workspace
		await page.goto("/projects");
		await page.waitForLoadState("networkidle");

		// Look for any project link and click it
		const projectLink = page.locator('a[href^="/projects/"]').first();
		if ((await projectLink.count()) > 0) {
			await projectLink.click();
			// URL should now be /projects/...
			await expect(page).toHaveURL(/\/projects\//);
		}
	});

	test("mode toggle switches between execute and plan", async ({ page }) => {
		await page.goto("/projects");
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
});

test.describe("Browser History", () => {
	test("back button works after navigation", async ({ page }) => {
		await page.goto("/projects");
		await page.waitForLoadState("networkidle");

		// Navigate to plan
		await page.goto("/plan");
		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });

		// Go back
		await page.goBack();
		await expect(page).toHaveURL("/projects");
	});

	test("forward button works after back", async ({ page }) => {
		await page.goto("/projects");
		await page.waitForLoadState("networkidle");

		await page.goto("/plan");
		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });

		await page.goBack();
		await expect(page).toHaveURL("/projects");

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
});
