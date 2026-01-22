import { expect, test } from "@playwright/test";

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
			id: "webwrkq",
			slug: "webwrkq",
			title: "webwrkq",
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

test.describe("Async triage", () => {
	test("calls async triage endpoint in control-plane", async ({ page }) => {
		let triageRequest: Record<string, unknown> | null = null;
		const commentRequests: Record<string, unknown>[] = [];

		await page.route("**/admin/tasks/webwrkq/tasks/T-00001", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockTask),
			});
		});

		await page.route("**/admin/tasks/webwrkq/tasks/T-00001/comments", async (route) => {
			if (route.request().method() === "POST") {
				const commentRequest = route.request().postDataJSON() as Record<string, unknown>;
				commentRequests.push(commentRequest);
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						uuid: "comment-uuid",
						id: "C-00001",
						task_uuid: "test-uuid",
						actor_slug: "codex-agent",
						actor_role: "agent",
						body: commentRequest?.body ?? "",
						meta: null,
						created_at: "2025-01-01T00:00:00Z",
						updated_at: null,
					}),
				});
				return;
			}
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

		await page.route("**/admin/tasks/webwrkq/tasks/T-00001/triage_wrkq", async (route) => {
			if (route.request().method() === "POST") {
				triageRequest = (route.request().postDataJSON?.() ?? {}) as Record<string, unknown>;
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						runId: "R-00001",
						sessionId: "S-123",
						status: "queued",
						task: { id: "T-00001", uuid: "test-uuid" },
					}),
				});
				return;
			}
			await route.fulfill({
				status: 404,
				contentType: "application/json",
				body: JSON.stringify({ message: "not found" }),
			});
		});

		await page.goto("/prompt-shaping/webwrkq/T-00001");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click the "Agent SDK" button in the triage group which triggers async triage
		const asyncButton = page.getByRole("button", { name: /Agent SDK/i }).first();
		await expect(asyncButton).toBeVisible({ timeout: 5000 });
		await asyncButton.click();

		await expect(page.locator("text=Async triage started")).toBeVisible({ timeout: 3000 });

		expect(triageRequest).not.toBeNull();
		expect(commentRequests.length).toBe(0);
	});
});
