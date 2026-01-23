import { expect, test } from "@playwright/test";

/**
 * Playwright tests for the Spec Writer feature.
 * Tests cover routing, CRUD operations, editor functionality, and UI interactions.
 *
 * These tests use route mocking to simulate the backend API, allowing tests to run
 * without requiring a live control-plane server.
 */

// ============================================================================
// MOCK DATA
// ============================================================================

const mockWorkspaces = {
	workspaces: [
		{
			id: "test-workspace",
			name: "Test Workspace",
			rootDir: "/tmp/test-workspace",
			dbPath: "/tmp/test-workspace/.wrkq/wrkq.db",
			enabled: true,
		},
	],
};

// Mock spec data for a complete spec document
const createMockSpec = (id: string, slug: string, title: string, rev = 1) => ({
	schemaVersion: 1,
	id,
	slug,
	title,
	version: "0.1.0",
	rev,
	overview: `Overview for ${title}`,
	sections: [
		{
			id: "goals",
			kind: "goals",
			label: "Goals",
			order: 0,
			items: [
				{
					id: "G-001",
					summary: "Primary goal",
					body: "This is the primary goal description.",
					status: "draft",
					order: 0,
				},
			],
		},
		{
			id: "non-goals",
			kind: "non-goals",
			label: "Non-goals",
			order: 1,
			items: [],
		},
		{
			id: "features",
			kind: "features",
			label: "Features",
			order: 2,
			items: [
				{
					id: "F-001",
					summary: "Feature one",
					body: "Description of feature one.",
					status: "draft",
					order: 0,
				},
				{
					id: "F-002",
					summary: "Feature two",
					body: "Description of feature two.",
					status: "approved",
					order: 1,
				},
			],
		},
		{
			id: "constraints",
			kind: "constraints",
			label: "Constraints",
			order: 3,
			items: [],
		},
		{
			id: "open-questions",
			kind: "open-questions",
			label: "Open Questions",
			order: 4,
			items: [
				{
					id: "Q-001",
					summary: "How will we handle edge cases?",
					body: "Need to determine approach for error handling.",
					status: "draft",
					order: 0,
				},
			],
		},
	],
	metadata: {
		projectId: "test-workspace",
		createdAt: Date.now() - 86400000, // 1 day ago
		updatedAt: Date.now(),
		createdBy: "test-user",
		updatedBy: "test-user",
		sessionId: null,
	},
});

const mockSpec1 = createMockSpec("spec-1-uuid", "test-spec-one", "Test Spec One");
const mockSpec2 = createMockSpec("spec-2-uuid", "test-spec-two", "Test Spec Two", 2);

// Convert full spec to manifest format for list view
const specToManifest = (spec: ReturnType<typeof createMockSpec>) => ({
	id: spec.id,
	slug: spec.slug,
	title: spec.title,
	version: spec.version,
	rev: spec.rev,
	createdAt: spec.metadata.createdAt,
	updatedAt: spec.metadata.updatedAt,
	sessionId: spec.metadata.sessionId,
});

// Store for tracking created specs during tests
let mockSpecs: ReturnType<typeof createMockSpec>[] = [];

// ============================================================================
// ROUTE SETUP
// ============================================================================

async function setupMockRoutes(page: import("@playwright/test").Page) {
	// Reset mock specs for each test
	mockSpecs = [mockSpec1, mockSpec2];

	// Mock workspaces/projects endpoint
	await page.route("**/admin/projects/wrkq", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(mockWorkspaces),
		});
	});

	// Mock specs list endpoint
	await page.route("**/admin/projects/test-workspace/specs", async (route) => {
		const method = route.request().method();

		if (method === "GET") {
			// Return list of spec manifests
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					specs: mockSpecs.map(specToManifest),
				}),
			});
		} else if (method === "POST") {
			// Create new spec
			const body = route.request().postDataJSON();
			const title = body.title || "Untitled Spec";
			const slug =
				body.slug ||
				title
					.toLowerCase()
					.replace(/\s+/g, "-")
					.replace(/[^a-z0-9-]/g, "");
			const newSpec = createMockSpec(`spec-${Date.now()}-uuid`, slug, title);
			mockSpecs.push(newSpec);
			await route.fulfill({
				status: 201,
				contentType: "application/json",
				body: JSON.stringify({ spec: newSpec }),
			});
		} else {
			await route.continue();
		}
	});

	// Mock individual spec endpoints (GET, PUT, DELETE)
	await page.route("**/admin/projects/test-workspace/specs/*", async (route) => {
		const url = route.request().url();
		const method = route.request().method();
		const slugMatch = url.match(/\/specs\/([^/?]+)/);
		const slug = slugMatch?.[1];

		if (!slug) {
			await route.fulfill({ status: 404, body: "Not found" });
			return;
		}

		const specIndex = mockSpecs.findIndex((s) => s.slug === slug);

		if (method === "GET") {
			if (specIndex >= 0) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ spec: mockSpecs[specIndex] }),
				});
			} else {
				await route.fulfill({ status: 404, body: "Spec not found" });
			}
		} else if (method === "PUT") {
			if (specIndex >= 0) {
				const body = route.request().postDataJSON();
				const updatedSpec = {
					...mockSpecs[specIndex],
					...body.spec,
					rev: mockSpecs[specIndex].rev + 1,
					metadata: {
						...mockSpecs[specIndex].metadata,
						updatedAt: Date.now(),
					},
				};
				mockSpecs[specIndex] = updatedSpec;
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ spec: updatedSpec }),
				});
			} else {
				await route.fulfill({ status: 404, body: "Spec not found" });
			}
		} else if (method === "DELETE") {
			if (specIndex >= 0) {
				mockSpecs.splice(specIndex, 1);
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ success: true }),
				});
			} else {
				await route.fulfill({ status: 404, body: "Spec not found" });
			}
		} else {
			await route.continue();
		}
	});
}

// ============================================================================
// TESTS
// ============================================================================

test.describe("Spec Writer Routing", () => {
	test("direct link to spec-writer loads the page", async ({ page }) => {
		await setupMockRoutes(page);

		// Navigate directly to spec-writer
		await page.goto("/workspace/test-workspace/spec-writer");

		// Should show spec-writer header
		await expect(page.locator("text=spec-writer")).toBeVisible({ timeout: 10000 });
	});

	test("spec-writer route shows new spec button", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");

		// Should show the "new spec" button in the nav panel
		await expect(page.locator("text=new spec")).toBeVisible({ timeout: 10000 });
	});

	test("navigating to specific spec loads it", async ({ page }) => {
		await setupMockRoutes(page);

		// Navigate to a specific spec
		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");

		// Should show the spec title in the nav list (first match in the list)
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible({
			timeout: 10000,
		});
	});
});

test.describe("Spec Writer Nav Panel", () => {
	test("shows spec count in footer", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Should show spec count (2 specs in mock data)
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });
	});

	test("clicking new spec shows title input", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Click the "new spec" button
		await page.locator("text=new spec").click();

		// Should show the title input
		await expect(page.locator('input[placeholder="Spec title..."]')).toBeVisible({ timeout: 5000 });

		// Should show the "create" button
		await expect(page.locator('button:has-text("create")')).toBeVisible();
	});

	test("escape key cancels new spec creation", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Click the "new spec" button
		await page.locator("text=new spec").click();

		// Input should be visible
		const titleInput = page.locator('input[placeholder="Spec title..."]');
		await expect(titleInput).toBeVisible();

		// Press Escape
		await titleInput.press("Escape");

		// Input should be hidden, "new spec" button should be visible again
		await expect(titleInput).not.toBeVisible();
		await expect(page.locator("text=new spec")).toBeVisible();
	});

	test("shows specs in the list", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Should show both mock specs in the nav list
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible({
			timeout: 10000,
		});
		await expect(page.locator("ul li").filter({ hasText: "Test Spec Two" }).first()).toBeVisible({
			timeout: 10000,
		});
	});
});

test.describe("Spec Writer Editor", () => {
	test("shows spec content when spec is selected", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// The editor should show spec content (CodeMirror loads the markdown)
		// Wait for the graph toggle which indicates the editor loaded
		await expect(page.locator("text=graph")).toBeVisible({ timeout: 10000 });
	});

	test("graph toggle button exists and works", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Wait for spec to load and graph toggle to appear
		const graphToggle = page.locator("button:has-text('graph')");
		await expect(graphToggle).toBeVisible({ timeout: 10000 });

		// Check that React Flow container is visible (graph is shown by default)
		const reactFlowPane = page.locator(".react-flow");
		await expect(reactFlowPane).toBeVisible({ timeout: 5000 });

		// Click to collapse graph
		await graphToggle.click();

		// React Flow pane should be hidden
		await expect(reactFlowPane).not.toBeVisible();

		// Click to expand graph again
		await graphToggle.click();

		// React Flow pane should be visible again
		await expect(reactFlowPane).toBeVisible();
	});
});

test.describe("Spec Writer CRUD Operations", () => {
	test("can create a new spec", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Get initial spec count
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Create a new spec
		const uniqueTitle = "New Test Spec";
		await page.locator("text=new spec").click();

		const titleInput = page.locator('input[placeholder="Spec title..."]');
		await titleInput.fill(uniqueTitle);
		await page.locator('button:has-text("create")').click();

		// Wait for navigation to new spec
		await page.waitForURL(/\/spec-writer\//, { timeout: 10000 });

		// Spec count should increase
		await expect(page.locator("text=3 specs")).toBeVisible({ timeout: 10000 });

		// The spec title should be visible
		await expect(page.locator(`text=${uniqueTitle}`).first()).toBeVisible();
	});

	test("can select a spec from the list", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Click on the second spec to select it
		await page.locator("text=Test Spec Two").click();

		// URL should update to include the spec slug
		await expect(page).toHaveURL(/\/spec-writer\/test-spec-two/);

		// Wait for the spec to load in the editor
		await expect(page.locator("text=graph")).toBeVisible({ timeout: 10000 });
	});

	test("delete confirmation dialog appears when clicking delete", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Hover over a spec list item to reveal the delete button
		const specListItem = page.locator("ul li").first();
		await specListItem.hover();

		// Click the delete button (trash icon)
		const deleteButton = specListItem.locator('button[title="Delete spec"]');
		await deleteButton.click();

		// Delete confirmation dialog should appear
		await expect(page.locator("text=delete spec")).toBeVisible({ timeout: 5000 });
		await expect(page.locator("text=Are you sure you want to delete this spec?")).toBeVisible();
		await expect(page.locator("text=This action cannot be undone.")).toBeVisible();

		// Should have cancel and delete buttons
		await expect(page.locator('button:has-text("cancel")')).toBeVisible();
		await expect(page.locator('button:has-text("delete")')).toBeVisible();
	});

	test("escape key closes delete confirmation dialog", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Open delete dialog
		const specListItem = page.locator("ul li").first();
		await specListItem.hover();
		const deleteButton = specListItem.locator('button[title="Delete spec"]');
		await deleteButton.click();

		// Dialog should be visible
		await expect(page.locator("text=delete spec")).toBeVisible({ timeout: 5000 });

		// Press Escape
		await page.keyboard.press("Escape");

		// Dialog should be closed
		await expect(page.locator("text=Are you sure you want to delete this spec?")).not.toBeVisible();
	});

	test("cancel button closes delete confirmation dialog", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Open delete dialog
		const specListItem = page.locator("ul li").first();
		await specListItem.hover();
		const deleteButton = specListItem.locator('button[title="Delete spec"]');
		await deleteButton.click();

		// Dialog should be visible
		await expect(page.locator("text=delete spec")).toBeVisible({ timeout: 5000 });

		// Click cancel button
		await page.locator('button:has-text("cancel")').click();

		// Dialog should be closed
		await expect(page.locator("text=Are you sure you want to delete this spec?")).not.toBeVisible();
	});

	test("can delete a spec", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Initial count
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Open delete dialog
		const specListItem = page.locator("ul li").first();
		await specListItem.hover();
		const deleteButton = specListItem.locator('button[title="Delete spec"]');
		await deleteButton.click();

		// Dialog should be visible
		await expect(page.locator("text=delete spec")).toBeVisible({ timeout: 5000 });

		// Click delete button
		await page.locator('button:has-text("delete")').last().click();

		// Count should decrease
		await expect(page.locator("text=1 spec")).toBeVisible({ timeout: 10000 });
	});
});

test.describe("Spec Writer Graph Pane", () => {
	test("graph pane can be toggled", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Wait for spec to load and graph toggle to appear
		const graphToggle = page.locator("button:has-text('graph')");
		await expect(graphToggle).toBeVisible({ timeout: 10000 });

		// Check that React Flow container is visible (graph is shown by default)
		const reactFlowPane = page.locator(".react-flow");
		await expect(reactFlowPane).toBeVisible({ timeout: 5000 });

		// Click to collapse graph
		await graphToggle.click();

		// React Flow pane should be hidden
		await expect(reactFlowPane).not.toBeVisible();

		// Click to expand graph again
		await graphToggle.click();

		// React Flow pane should be visible again
		await expect(reactFlowPane).toBeVisible();
	});

	test("graph shows spec structure nodes", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Wait for graph to load
		const reactFlowPane = page.locator(".react-flow");
		await expect(reactFlowPane).toBeVisible({ timeout: 10000 });

		// The graph should contain nodes - React Flow renders nodes inside the container
		const nodes = page.locator(".react-flow__node");
		await expect(nodes.first()).toBeVisible({ timeout: 5000 });
	});
});

test.describe("Spec Writer Actions", () => {
	test("copy markdown button appears when spec is selected", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Copy markdown button should be visible when spec is selected
		await expect(page.locator("text=copy markdown")).toBeVisible({ timeout: 10000 });
	});

	test("save button is disabled when no changes", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Wait for spec to load
		await expect(page.locator("text=graph")).toBeVisible({ timeout: 10000 });

		// Save button should be visible but disabled (no changes)
		const saveButton = page.locator('button:has-text("save")');
		await expect(saveButton).toBeVisible();
		await expect(saveButton).toBeDisabled();
	});
});

test.describe("Spec Writer Chat Pane", () => {
	test("chat pane is visible on large screens", async ({ page }) => {
		await setupMockRoutes(page);

		// Set viewport to large desktop size
		await page.setViewportSize({ width: 1400, height: 900 });

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// On xl screens (1280px+), the chat pane should be visible
		// The chat pane has "Architect" header or quick action buttons
		const architectHeader = page.locator("text=Architect").first();
		const quickActionButtons = page.locator("text=+ feature");

		// Either the Architect header or the quick action buttons indicate the chat pane is visible
		const chatPaneVisible =
			(await architectHeader.isVisible()) || (await quickActionButtons.isVisible());

		// On large screens, chat pane should be visible
		expect(chatPaneVisible).toBeTruthy();
	});

	test("chat pane is hidden on small screens", async ({ page }) => {
		await setupMockRoutes(page);

		// Set viewport to small size (below xl breakpoint)
		await page.setViewportSize({ width: 1200, height: 900 });

		await page.goto("/workspace/test-workspace/spec-writer/test-spec-one");
		await page.waitForLoadState("networkidle");

		// Wait for the page to settle
		await page.waitForTimeout(500);

		// The chat pane has class "hidden xl:flex" so it should be hidden below xl
		// Quick action buttons would not be visible
		const quickActionButtons = page.locator("text=+ feature");
		const isVisible = await quickActionButtons.isVisible();

		// On small screens, chat pane should be hidden
		expect(isVisible).toBeFalsy();
	});
});

test.describe("Spec Writer Empty State", () => {
	test("shows empty state when no specs exist", async ({ page }) => {
		// Setup routes with empty specs list
		mockSpecs = [];
		await setupMockRoutes(page);
		// Override to return empty list
		await page.route("**/admin/projects/test-workspace/specs", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ specs: [] }),
				});
			} else {
				await route.continue();
			}
		});

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Should show 0 specs count
		await expect(page.locator("text=0 specs")).toBeVisible({ timeout: 10000 });

		// Should show empty state instruction in editor area
		await expect(page.locator("text=Select or create a spec")).toBeVisible();
	});
});

test.describe("Spec Writer Search/Filter", () => {
	test("filter input is visible when specs exist", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Filter input should be visible
		await expect(page.locator('input[placeholder="Filter specs..."]')).toBeVisible();
	});

	test("filter input is hidden when no specs exist", async ({ page }) => {
		// Setup routes with empty specs list
		mockSpecs = [];
		await setupMockRoutes(page);
		await page.route("**/admin/projects/test-workspace/specs", async (route) => {
			if (route.request().method() === "GET") {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ specs: [] }),
				});
			} else {
				await route.continue();
			}
		});

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for empty state
		await expect(page.locator("text=0 specs")).toBeVisible({ timeout: 10000 });

		// Filter input should NOT be visible when no specs exist
		await expect(page.locator('input[placeholder="Filter specs..."]')).not.toBeVisible();
	});

	test("filtering narrows down the spec list", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Both specs should be visible initially
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible();
		await expect(page.locator("ul li").filter({ hasText: "Test Spec Two" }).first()).toBeVisible();

		// Type in filter input
		const filterInput = page.locator('input[placeholder="Filter specs..."]');
		await filterInput.fill("One");

		// Only "Test Spec One" should be visible now
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible();
		await expect(
			page.locator("ul li").filter({ hasText: "Test Spec Two" }).first(),
		).not.toBeVisible();
	});

	test("shows no match message when filter has no results", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Type a filter that matches nothing
		const filterInput = page.locator('input[placeholder="Filter specs..."]');
		await filterInput.fill("nonexistent");

		// Should show "no match" message
		await expect(page.locator('text=No specs match "nonexistent"')).toBeVisible();

		// Should show "clear filter" button
		await expect(page.locator("text=clear filter")).toBeVisible();
	});

	test("clear filter button clears the filter", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Type a filter that matches nothing
		const filterInput = page.locator('input[placeholder="Filter specs..."]');
		await filterInput.fill("nonexistent");

		// Should show "no match" message
		await expect(page.locator('text=No specs match "nonexistent"')).toBeVisible();

		// Click "clear filter" button
		await page.locator("text=clear filter").click();

		// Filter should be cleared, both specs should be visible
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible();
		await expect(page.locator("ul li").filter({ hasText: "Test Spec Two" }).first()).toBeVisible();

		// Filter input should be empty
		await expect(filterInput).toHaveValue("");
	});

	test("escape key clears the filter", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Type in filter input
		const filterInput = page.locator('input[placeholder="Filter specs..."]');
		await filterInput.fill("One");

		// Only one spec should be visible
		await expect(
			page.locator("ul li").filter({ hasText: "Test Spec Two" }).first(),
		).not.toBeVisible();

		// Press Escape while focused on filter input
		await filterInput.press("Escape");

		// Filter should be cleared, both specs should be visible
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible();
		await expect(page.locator("ul li").filter({ hasText: "Test Spec Two" }).first()).toBeVisible();

		// Filter input should be empty
		await expect(filterInput).toHaveValue("");
	});

	test("X button clears the filter when visible", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Type in filter input
		const filterInput = page.locator('input[placeholder="Filter specs..."]');
		await filterInput.fill("One");

		// X button should be visible (clear filter button next to input)
		const clearButton = page.locator('button[title="Clear filter"]');
		await expect(clearButton).toBeVisible();

		// Click the X button
		await clearButton.click();

		// Filter should be cleared
		await expect(filterInput).toHaveValue("");

		// Both specs should be visible
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible();
		await expect(page.locator("ul li").filter({ hasText: "Test Spec Two" }).first()).toBeVisible();
	});

	test("filter is case-insensitive", async ({ page }) => {
		await setupMockRoutes(page);

		await page.goto("/workspace/test-workspace/spec-writer");
		await page.waitForLoadState("networkidle");

		// Wait for specs to load
		await expect(page.locator("text=2 specs")).toBeVisible({ timeout: 10000 });

		// Type lowercase filter that should match "Test Spec One" (mixed case)
		const filterInput = page.locator('input[placeholder="Filter specs..."]');
		await filterInput.fill("test spec one");

		// "Test Spec One" should still be visible (case-insensitive match)
		await expect(page.locator("ul li").filter({ hasText: "Test Spec One" }).first()).toBeVisible();
		await expect(
			page.locator("ul li").filter({ hasText: "Test Spec Two" }).first(),
		).not.toBeVisible();
	});
});
