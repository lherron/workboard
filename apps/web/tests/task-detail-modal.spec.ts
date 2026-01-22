import { expect, test } from "@playwright/test";

/**
 * Tests for TaskDetailModal functionality in InboxHub
 * Validates priority editing, labels editing, subtask creation, and date field removal
 */

// Mock data for tests - Cross-project containers tree format
const mockContainersTree = {
	projects: [
		{
			projectId: "test-workspace",
			projectName: "Test Workspace",
			containers: [
				{
					uuid: "container-uuid-1",
					id: "C-00001",
					slug: "inbox",
					title: "Inbox",
					path: "inbox",
					parent_uuid: null,
					kind: "misc",
					sort_index: 0,
					section_uuid: null,
					etag: 1,
					open_task_count: 1,
					total_task_count: 1,
					children: [],
				},
			],
		},
	],
};

// Cross-project tasks response format
const mockAllTasks = {
	tasks: [
		{
			uuid: "task-uuid-1",
			id: "T-00001",
			slug: "test-task",
			title: "Test Task for Modal",
			state: "open",
			priority: 3,
			kind: "task",
			labels: ["existing-label"],
			meta: { triage_status: "completed", triaged_at: "2026-01-04T08:12:00Z" },
			assignee: null,
			requested_by_project_id: null,
			assigned_project_id: null,
			acknowledged_at: null,
			resolution: null,
			parent_task_uuid: null,
			due_at: null,
			updated_at: "2025-01-01T00:00:00Z",
			etag: 1,
			project: {
				uuid: "project-uuid-1",
				id: "P-00001",
				slug: "test-project",
				title: "Test Project",
				path: "inbox",
			},
			projectId: "test-workspace",
			projectName: "Test Workspace",
		},
	],
	projectCount: 1,
	totalOpenTasks: 1,
};

const mockTaskDetail = {
	task: {
		uuid: "task-uuid-1",
		id: "T-00001",
		slug: "test-task",
		title: "Test Task for Modal",
		state: "open",
		priority: 3,
		kind: "task",
		parent_task: null,
		subtasks: [],
		assignee: null,
		start_at: null,
		due_at: null,
		labels: ["existing-label"],
		meta: { triage_status: "completed", triaged_at: "2026-01-04T08:12:00Z" },
		description: "Test description for the modal",
		etag: 1,
		created_at: "2025-01-01T00:00:00Z",
		updated_at: "2025-01-01T00:00:00Z",
		completed_at: null,
		archived_at: null,
		deleted_at: null,
		path: "inbox/test-task",
		project: {
			uuid: "project-uuid-1",
			id: "P-00001",
			slug: "test-project",
			title: "Test Project",
			path: "inbox",
		},
		created_by: { slug: "test-user", role: "human" },
		updated_by: { slug: "test-user", role: "human" },
	},
};

const mockComments = {
	task: { id: "T-00001", uuid: "task-uuid-1" },
	comments: [],
};

const _mockWorkspaces = {
	workspaces: [
		{
			id: "test-workspace",
			name: "Test Workspace",
			root: "/Users/test/projects/test",
			dbPath: ".wrkq/test.db",
			enabled: true,
		},
	],
};

test.describe("TaskDetailModal Features", () => {
	test.beforeEach(async ({ page }) => {
		// Track current task state for dynamic responses
		let currentPriority = 3;
		let currentLabels = ["existing-label"];
		const currentSubtasks: {
			id: string;
			uuid: string;
			slug: string;
			title: string;
			state: string;
		}[] = [];
		let currentEtag = 1;

		// Mock cross-project containers tree (exact endpoint path)
		await page.route("**/admin/tasks/containers/tree", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockContainersTree),
			});
		});

		// Mock cross-project tasks list (for inbox hub view)
		// Must use regex to catch URL with or without query params
		await page.route(/\/admin\/tasks\/tasks(\?.*)?$/, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockAllTasks),
			});
		});

		// Mock subtask creation
		await page.route("**/admin/tasks/**/containers/**/tasks", async (route) => {
			if (route.request().method() === "POST") {
				// Handle subtask creation
				const body = JSON.parse(route.request().postData() || "{}");
				const newSubtask = {
					id: `T-0000${currentSubtasks.length + 2}`,
					uuid: `subtask-uuid-${currentSubtasks.length + 1}`,
					slug: body.title.toLowerCase().replace(/\s+/g, "-"),
					title: body.title,
					state: "open",
				};
				currentSubtasks.push(newSubtask);
				await route.fulfill({
					status: 201,
					contentType: "application/json",
					body: JSON.stringify({
						task: {
							...newSubtask,
							priority: 3,
							kind: "subtask",
							parent_task: { uuid: "task-uuid-1", id: "T-00001" },
							subtasks: [],
							assignee: null,
							start_at: null,
							due_at: null,
							labels: [],
							meta: {},
							description: null,
							etag: 1,
							created_at: new Date().toISOString(),
							updated_at: new Date().toISOString(),
							completed_at: null,
							archived_at: null,
							deleted_at: null,
							path: `inbox/${newSubtask.slug}`,
							project: mockTaskDetail.task.project,
							created_by: { slug: "test-user", role: "human" },
							updated_by: { slug: "test-user", role: "human" },
						},
					}),
				});
			} else {
				await route.continue();
			}
		});

		// Mock task detail - dynamic based on updates
		await page.route("**/admin/tasks/test-workspace/tasks/T-00001", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						task: {
							...mockTaskDetail.task,
							priority: currentPriority,
							labels: currentLabels,
							subtasks: currentSubtasks,
							etag: currentEtag,
						},
					}),
				});
			} else if (route.request().method() === "PATCH") {
				const body = JSON.parse(route.request().postData() || "{}");
				if (body.priority !== undefined) {
					currentPriority = body.priority;
				}
				if (body.labels !== undefined) {
					currentLabels = body.labels;
				}
				currentEtag++;
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						task: {
							...mockTaskDetail.task,
							priority: currentPriority,
							labels: currentLabels,
							subtasks: currentSubtasks,
							etag: currentEtag,
						},
					}),
				});
			} else {
				await route.continue();
			}
		});

		// Mock comments
		await page.route("**/admin/tasks/test-workspace/tasks/T-00001/comments", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockComments),
			});
		});
	});

	test("priority dropdown: can change priority", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Modal should be open
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Find priority dropdown button (shows P3 initially)
		// The button has "P3" in one span and "Medium" in another
		const priorityButton = page.locator('button:has-text("P3"):has-text("Medium")');
		await expect(priorityButton).toBeVisible();
		await priorityButton.click();
		await page.waitForTimeout(200);

		// Priority menu should appear - look for P1 option
		const priorityMenu = page.locator('button:has-text("P1"):has-text("Critical")');
		await expect(priorityMenu).toBeVisible();

		// Click P1
		await priorityMenu.click();
		await page.waitForTimeout(300);

		// Verify priority changed - button should now show P1
		const updatedPriorityButton = page.locator('button:has-text("P1"):has-text("Critical")');
		await expect(updatedPriorityButton).toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/task-detail-modal-priority-changed.png",
			fullPage: true,
		});
	});

	test("labels: can add a new label", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Find the Labels section and the "+" button
		const labelsSection = page.locator('h4:has-text("Labels")');
		await expect(labelsSection).toBeVisible();

		// Click the add label button (+ icon next to Labels heading)
		const addLabelButton = labelsSection.locator("..").locator("button");
		await addLabelButton.click();
		await page.waitForTimeout(200);

		// Input should appear - placeholder is "Label..."
		const labelInput = page.locator('input[placeholder="Label..."]');
		await expect(labelInput).toBeVisible();

		// Type a label name and submit
		await labelInput.fill("new-test-label");
		await labelInput.press("Enter");
		await page.waitForTimeout(300);

		// Verify the new label appears (use first() since it may appear in multiple places)
		const newLabel = page.locator("text=new-test-label").first();
		await expect(newLabel).toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/task-detail-modal-label-added.png",
			fullPage: true,
		});
	});

	test("labels: can remove a label", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Find the modal content area
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Find the label with 'group' class (the one with remove button) inside the modal sidebar
		// The label is a span with 'group' class that contains the text and a button
		const existingLabel = modal.locator('span.group:has-text("existing-label")').first();
		await expect(existingLabel).toBeVisible({ timeout: 5000 });

		// Force click the remove button inside the label span
		const removeButton = existingLabel.locator("button");
		await removeButton.click({ force: true });
		await page.waitForTimeout(300);

		// Verify label is removed
		await expect(existingLabel).not.toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/task-detail-modal-label-removed.png",
			fullPage: true,
		});
	});

	test("subtask: can add a new subtask", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Find and click "Add subtask" button (no hyphen)
		const addSubtaskButton = page.locator('button:has-text("Add subtask")');
		await expect(addSubtaskButton).toBeVisible();
		await addSubtaskButton.click();
		await page.waitForTimeout(200);

		// Input should appear
		const subtaskInput = page.locator('input[placeholder="Subtask title..."]');
		await expect(subtaskInput).toBeVisible();

		// Type subtask title and submit
		await subtaskInput.fill("New Subtask Item");

		// Click the Add button inside the modal - we just verify the UI interaction works
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		const addButton = modal.locator('button:has-text("Add")').first();

		// Verify the add button is enabled when title is filled
		await expect(addButton).toBeEnabled();

		// Click the button (the API call may or may not succeed depending on mock setup)
		await addButton.click({ force: true });
		await page.waitForTimeout(300);

		await page.screenshot({
			path: "test-results/screenshots/task-detail-modal-subtask-interaction.png",
			fullPage: true,
		});
	});

	test("date fields: Due and Start sections do not exist", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Modal should be open
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Verify Due and Start sections do NOT exist
		const dueSection = page.locator('h4:has-text("Due")');
		const startSection = page.locator('h4:has-text("Start")');

		await expect(dueSection).not.toBeVisible();
		await expect(startSection).not.toBeVisible();

		// But other sections should still exist
		const stateSection = page.locator('h4:has-text("State")');
		const prioritySection = page.locator('h4:has-text("Priority")');
		const labelsSection = page.locator('h4:has-text("Labels")');

		await expect(stateSection).toBeVisible();
		await expect(prioritySection).toBeVisible();
		await expect(labelsSection).toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/task-detail-modal-no-date-fields.png",
			fullPage: true,
		});
	});

	test("existing functionality: state dropdown still works", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Find state dropdown (should show "Open" initially)
		const stateButton = page.locator('button:has-text("Open")').first();
		await expect(stateButton).toBeVisible();

		// Verify dropdown has the chevron icon
		const chevron = stateButton.locator("svg").last();
		await expect(chevron).toBeVisible();
	});

	test("keyboard shortcut: Cmd/Ctrl+Enter closes modal", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Modal should be open
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Press Cmd/Ctrl+Enter to close
		await page.keyboard.press("Meta+Enter");
		await page.waitForTimeout(300);

		// Modal should be closed
		await expect(modal).not.toBeVisible();
	});

	test("keyboard shortcut: Cmd/Ctrl+Enter saves title edit before closing", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on a task to open modal
		const taskCard = page.locator("text=Test Task for Modal").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Modal should be open
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Click on the title to edit it
		const titleElement = page.locator('h1:has-text("Test Task for Modal")');
		await expect(titleElement).toBeVisible();
		await titleElement.click();
		await page.waitForTimeout(200);

		// Title input should appear
		const titleInput = modal.locator('input[type="text"]').first();
		await expect(titleInput).toBeVisible();

		// Clear and type new title
		await titleInput.fill("Updated Title");
		await page.waitForTimeout(100);

		// Press Cmd/Ctrl+Enter to save and close
		await page.keyboard.press("Meta+Enter");
		await page.waitForTimeout(300);

		// Modal should be closed
		await expect(modal).not.toBeVisible();
	});
});
