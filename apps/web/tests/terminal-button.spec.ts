import { expect, test } from "@playwright/test";

// Mock data for tests
const mockTask = {
	task: {
		uuid: "test-uuid",
		id: "T-00001",
		slug: "test-task",
		title: "Test Task",
		state: "open",
		priority: 3,
		kind: "task",
		parent_task: null,
		subtasks: [],
		assignee: null,
		start_at: null,
		due_at: null,
		labels: [],
		meta: {},
		description: "Test description",
		etag: 1,
		created_at: "2025-01-01T00:00:00Z",
		updated_at: "2025-01-01T00:00:00Z",
		completed_at: null,
		archived_at: null,
		deleted_at: null,
		path: "inbox/test-task",
		project: {
			uuid: "project-uuid",
			id: "P-00001",
			slug: "test-project",
			title: "Test Project",
			path: "inbox",
		},
		created_by: { slug: "test-user", role: "human" },
		updated_by: { slug: "test-user", role: "human" },
	},
};

const mockWorkspaces = {
	workspaces: [
		{
			id: "webwrkq",
			name: "webwrkq",
			root: "/Users/test/projects/webwrkq",
			dbPath: ".wrkq/webwrkq.db",
			enabled: true,
		},
	],
};

const mockComments = {
	task: { id: "T-00001", uuid: "test-uuid" },
	comments: [],
};

test.describe("Terminal Button on Prompt Shaping Page", () => {
	test.beforeEach(async ({ page }) => {
		// Mock the API endpoints
		await page.route("**/admin/tasks/webwrkq/tasks/T-00001", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockTask),
			});
		});

		await page.route("**/admin/tasks/webwrkq/tasks/T-00001/comments", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockComments),
			});
		});

		await page.route("**/admin/projects/wrkq", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockWorkspaces),
			});
		});
	});

	test("terminal button is visible and enabled after workspace loads", async ({ page }) => {
		await page.goto("/prompt-shaping/webwrkq/T-00001");
		await page.waitForLoadState("networkidle");

		// Terminal button (Claude triage) should be visible
		const terminalButton = page.getByTestId("open-terminal-button");
		await expect(terminalButton).toBeVisible({ timeout: 10000 });

		// Button text should show "Claude" (the provider name)
		await expect(terminalButton).toContainText("Claude");

		// Wait for workspace fetch to complete
		await page.waitForTimeout(1000);

		// Check button has the terminal icon (SVG)
		const svg = terminalButton.locator("svg");
		await expect(svg).toBeVisible();

		// Button should have proper title
		const title = await terminalButton.getAttribute("title");
		expect(title).toBe("Triage in terminal");
	});

	test("terminal button shows error on 503 response", async ({ page }) => {
		// Mock the terminal API to return 503 - launchTerminal uses /api/terminal/launch
		await page.route("**/api/terminal/launch", async (route) => {
			await route.fulfill({
				status: 503,
				contentType: "application/json",
				body: JSON.stringify({ error: "Ghostty not available" }),
			});
		});

		await page.goto("/prompt-shaping/webwrkq/T-00001");
		await page.waitForLoadState("networkidle");

		// Wait for workspace to load so button is enabled
		await page.waitForTimeout(1000);

		const terminalButton = page.getByTestId("open-terminal-button");
		await expect(terminalButton).toBeVisible({ timeout: 10000 });

		// Click the terminal button
		await terminalButton.click();

		// Error message should appear - the launchTerminal function throws "Terminal not available"
		const errorMessage = page.locator("text=Terminal not available");
		await expect(errorMessage).toBeVisible({ timeout: 5000 });
	});

	test("terminal button shows loading state while request is in flight", async ({ page }) => {
		// Mock the terminal API to delay response - launchTerminal uses /api/terminal/launch
		await page.route("**/api/terminal/launch", async (route) => {
			// Delay for 1.5 seconds to observe loading state
			await new Promise((resolve) => setTimeout(resolve, 1500));
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ success: true }),
			});
		});

		await page.goto("/prompt-shaping/webwrkq/T-00001");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1000);

		const terminalButton = page.getByTestId("open-terminal-button");
		await expect(terminalButton).toBeVisible({ timeout: 10000 });

		// Click the button
		await terminalButton.click();

		// Should show loading spinner (animate-spin class on the inner div)
		const spinner = terminalButton.locator(".animate-spin");
		await expect(spinner).toBeVisible({ timeout: 1000 });

		// Wait for request to complete
		await page.waitForTimeout(2000);

		// Spinner should be gone
		await expect(spinner).not.toBeVisible();
	});

	test("terminal button tooltip shows triage action", async ({ page }) => {
		await page.goto("/prompt-shaping/webwrkq/T-00001");
		await page.waitForLoadState("networkidle");

		const terminalButton = page.getByTestId("open-terminal-button");
		await expect(terminalButton).toBeVisible({ timeout: 10000 });

		// Wait for workspace to load
		await page.waitForTimeout(1000);

		// Title should describe the triage action
		const title = await terminalButton.getAttribute("title");
		expect(title).toBe("Triage in terminal");
	});

	test("terminal button is visible even while workspace is loading", async ({ page }) => {
		// Delay the workspace response
		await page.route("**/admin/projects/wrkq", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockWorkspaces),
			});
		});

		await page.goto("/prompt-shaping/webwrkq/T-00001");

		const terminalButton = page.getByTestId("open-terminal-button");
		await expect(terminalButton).toBeVisible({ timeout: 10000 });

		// Button should still have its title even while loading
		const title = await terminalButton.getAttribute("title");
		expect(title).toBe("Triage in terminal");
	});
});

// Integration test - no mocking, verifies the proxy is configured
test.describe("Terminal API Integration", () => {
	test("terminal API endpoint is reachable through proxy", async ({ request }) => {
		// This test verifies the Vite proxy is configured correctly
		// It should reach the control-plane, not 404
		const response = await request.post("http://localhost:5150/api/terminal/new", {
			data: {
				location: "tab",
				working_directory: "/tmp",
			},
		});

		// We expect either:
		// - 200 (success - terminal opened)
		// - 503 (Ghostty not available)
		// - 401/403 (auth issue)
		// NOT 404 (proxy not configured)
		expect(response.status()).not.toBe(404);
	});
});
