import { expect, test } from "@playwright/test";

const mockWorkspaces = {
	workspaces: [
		{
			id: "workboard",
			name: "workboard",
			root: "/Users/lherron/praesidium/workboard",
			dbPath: "/Users/lherron/praesidium/var/db/wrkq.db",
			enabled: true,
		},
	],
};

const mockContainersTree = {
	projects: [
		{
			projectId: "workboard",
			projectName: "workboard",
			containers: [],
		},
	],
};

const mockTasks = {
	tasks: [],
	projectCount: 1,
	totalOpenTasks: 0,
};

async function mockRouteData(page: import("@playwright/test").Page) {
	await page.route("**/admin/projects/wrkq", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(mockWorkspaces),
		});
	});

	await page.route("**/admin/projects/*/roster", async (route) => {
		await route.fulfill({
			status: 404,
			contentType: "application/json",
			body: JSON.stringify({ error: "No roster configured" }),
		});
	});

	await page.route("**/admin/tasks/containers/tree", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(mockContainersTree),
		});
	});

	await page.route("**/admin/tasks/tasks?**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(mockTasks),
		});
	});
}

test.beforeEach(async ({ page }) => {
	await mockRouteData(page);
});

test.describe("Route Navigation", () => {
	test("/ redirects to /projects", async ({ page }) => {
		await page.goto("/");

		// Should redirect to /projects and show Projects header
		await expect(page).toHaveURL("/projects");
		await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible({ timeout: 10000 });
	});

	test("/plan loads plan mode", async ({ page }) => {
		await page.goto("/plan");

		// Should show plan mode with kanban board header
		await expect(page.locator("text=PLANNING BOARD")).toBeVisible({ timeout: 10000 });
	});

	test("/workspace/:id loads workspace dashboard", async ({ page }) => {
		// First go to projects page to find a valid workspace
		await page.goto("/projects");
		await page.waitForLoadState("networkidle");

		// Look for any project link and click it
		const projectLink = page.locator('a[href*="/projects/"]').first();
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
		await expect(page.locator("text=SYSTEM READY").or(page.locator("text=SYNCING..."))).toBeVisible(
			{ timeout: 10000 },
		);
	});
});
