import { expect, test } from "@playwright/test";

/**
 * Tests for multiline markdown rendering in CommentsTimeline
 * Validates that markdown content renders correctly with:
 * - Multiple paragraphs
 * - Headings
 * - Lists (ordered and unordered)
 * - Code blocks and inline code
 * - Line breaks
 */

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

const mockAllTasks = {
	tasks: [
		{
			uuid: "task-uuid-1",
			id: "T-00001",
			slug: "test-task",
			title: "Test Task with Comments",
			state: "open",
			priority: 3,
			kind: "task",
			labels: [],
			meta: {},
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
		title: "Test Task with Comments",
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

// Multiline markdown comment with various formatting
const multilineMarkdownBody = `## Implementation Notes

This is the first paragraph with some context about the task.

This is the second paragraph with more details.

### Key Changes

- First list item with details
- Second list item with more info
- Third item with \`inline code\`

### Code Example

\`\`\`typescript
const example = {
  key: 'value',
  nested: { foo: 'bar' }
};
\`\`\`

### Next Steps

1. First ordered step
2. Second ordered step
3. Third ordered step

Line one
Line two (should have break)`;

const mockComments = {
	task: { id: "T-00001", uuid: "task-uuid-1" },
	comments: [
		{
			uuid: "comment-uuid-1",
			id: "C-00001",
			task_uuid: "task-uuid-1",
			actor_slug: "test-agent",
			actor_role: "agent",
			body: multilineMarkdownBody,
			meta: null,
			created_at: "2025-01-01T12:00:00Z",
			updated_at: null,
		},
		{
			uuid: "comment-uuid-2",
			id: "C-00002",
			task_uuid: "task-uuid-1",
			actor_slug: "test-user",
			actor_role: "human",
			body: "Simple single-line comment",
			meta: null,
			created_at: "2025-01-01T13:00:00Z",
			updated_at: null,
		},
	],
};

test.describe("Multiline Markdown Comments", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/admin/tasks/containers/tree", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockContainersTree),
			});
		});

		await page.route(/\/admin\/tasks\/tasks(\?.*)?$/, async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockAllTasks),
			});
		});

		await page.route("**/admin/tasks/test-workspace/tasks/T-00001", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockTaskDetail),
			});
		});

		await page.route("**/admin/tasks/test-workspace/tasks/T-00001/comments", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockComments),
			});
		});
	});

	test("renders multiline markdown with headings", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		// Click on the task to open modal
		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		// Modal should be open
		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Look for markdown-rendered headings in the comment
		const h2Heading = modal.locator('.markdown-body h2:has-text("Implementation Notes")');
		await expect(h2Heading).toBeVisible();

		const h3Heading = modal.locator('.markdown-body h3:has-text("Key Changes")');
		await expect(h3Heading).toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/markdown-comments-headings.png",
			fullPage: true,
		});
	});

	test("renders unordered lists with bullets", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Check for unordered list items
		const listItem = modal.locator('.markdown-body ul li:has-text("First list item")');
		await expect(listItem).toBeVisible();

		// Verify the list has proper list-style
		const ul = modal.locator(".markdown-body ul").first();
		await expect(ul).toBeVisible();
		const listStyle = await ul.evaluate((el) => getComputedStyle(el).listStyleType);
		expect(listStyle).toBe("disc");

		await page.screenshot({
			path: "test-results/screenshots/markdown-comments-lists.png",
			fullPage: true,
		});
	});

	test("renders ordered lists with numbers", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Check for ordered list items
		const orderedItem = modal.locator('.markdown-body ol li:has-text("First ordered step")');
		await expect(orderedItem).toBeVisible();

		// Verify ordered list has decimal style
		const ol = modal.locator(".markdown-body ol").first();
		await expect(ol).toBeVisible();
		const listStyle = await ol.evaluate((el) => getComputedStyle(el).listStyleType);
		expect(listStyle).toBe("decimal");
	});

	test("renders code blocks with proper styling", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Check for code block (pre element)
		const codeBlock = modal.locator(".markdown-body pre").first();
		await expect(codeBlock).toBeVisible();

		// Code block should contain the example code
		await expect(codeBlock).toContainText("const example");

		await page.screenshot({
			path: "test-results/screenshots/markdown-comments-code-block.png",
			fullPage: true,
		});
	});

	test("renders inline code with styling", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Check for inline code element
		const inlineCode = modal.locator('.markdown-body code:has-text("inline code")');
		await expect(inlineCode).toBeVisible();
	});

	test("renders multiple paragraphs with spacing", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Check for multiple paragraphs
		const firstParagraph = modal.locator('.markdown-body p:has-text("first paragraph")');
		await expect(firstParagraph).toBeVisible();

		const secondParagraph = modal.locator('.markdown-body p:has-text("second paragraph")');
		await expect(secondParagraph).toBeVisible();

		// Verify paragraphs have margin
		const marginBottom = await firstParagraph.evaluate((el) => getComputedStyle(el).marginBottom);
		expect(Number.parseFloat(marginBottom)).toBeGreaterThan(0);
	});

	test("simple single-line comment also renders correctly", async ({ page }) => {
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(500);

		const taskCard = page.locator("text=Test Task with Comments").first();
		await expect(taskCard).toBeVisible({ timeout: 5000 });
		await taskCard.click();
		await page.waitForTimeout(300);

		const modal = page.locator('[class*="fixed inset-0 z-50"]');
		await expect(modal).toBeVisible();

		// Check for the simple comment
		const simpleComment = modal.locator("text=Simple single-line comment");
		await expect(simpleComment).toBeVisible();
	});
});
