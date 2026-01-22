import { expect, test } from "@playwright/test";

/**
 * Tests for quick-create error handling in InboxHub
 * Validates that 409 conflict errors are properly displayed to the user
 */

test.describe("Quick Create Error Handling", () => {
	test("shows error message when API returns 409", async ({ page }) => {
		// Mock API to return 409 for task creation
		await page.route("**/admin/tasks/**/containers/**/tasks", async (route) => {
			if (route.request().method() === "POST") {
				// Return 409 Conflict
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify({
						message: "A task with this slug already exists",
						code: "DUPLICATE_SLUG",
					}),
				});
			} else {
				await route.continue();
			}
		});

		// Navigate to inbox hub (correct route)
		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1000);

		// Take initial screenshot
		await page.screenshot({
			path: "test-results/screenshots/quick-create-01-inbox-hub.png",
			fullPage: true,
		});

		// Find and click the "Add task" button - look for the span text inside button
		const addTaskBtn = page.locator('button:has-text("Add task")').first();
		await expect(addTaskBtn).toBeVisible({ timeout: 5000 });
		await addTaskBtn.click();
		await page.waitForTimeout(300);

		// Screenshot with quick add form open
		await page.screenshot({
			path: "test-results/screenshots/quick-create-02-form-open.png",
			fullPage: true,
		});

		// Enter a task title
		const titleInput = page.locator('textarea[placeholder="Task name"]');
		await expect(titleInput).toBeVisible();
		await titleInput.fill("Test Task That Will Fail");

		// Submit the task - find button with checkmark SVG (the submit button)
		// The submit button has a specific brown/amber background color
		const submitBtn = page.locator('button[class*="bg-\\[#8b4513\\]"]').first();
		await expect(submitBtn).toBeVisible();
		await submitBtn.click();
		await page.waitForTimeout(1000);

		// Take screenshot of error state
		await page.screenshot({
			path: "test-results/screenshots/quick-create-03-error-shown.png",
			fullPage: true,
		});

		// Verify error message is displayed - look for the red error banner with animate-fade-in
		// Use a more specific selector to avoid matching delete buttons
		const errorBanner = page.locator('div[class*="bg-red-500"][class*="animate-fade-in"]');
		await expect(errorBanner).toBeVisible({ timeout: 3000 });

		// Verify the error text is user-friendly
		const errorText = page.locator("text=A task with this name already exists");
		await expect(errorText).toBeVisible();

		// Screenshot with visible error confirmed
		await page.screenshot({
			path: "test-results/screenshots/quick-create-04-error-verified.png",
			fullPage: true,
		});
	});

	test("error can be dismissed", async ({ page }) => {
		// Mock API to return 409
		await page.route("**/admin/tasks/**/containers/**/tasks", async (route) => {
			if (route.request().method() === "POST") {
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify({ message: "Duplicate task" }),
				});
			} else {
				await route.continue();
			}
		});

		await page.goto("/inbox-hub");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1000);

		// Open quick add form
		const addTaskBtn = page.locator('button:has-text("Add task")').first();
		await expect(addTaskBtn).toBeVisible({ timeout: 5000 });
		await addTaskBtn.click();
		await page.waitForTimeout(300);

		// Fill and submit to trigger error
		const titleInput = page.locator('textarea[placeholder="Task name"]');
		await titleInput.fill("Test Error Dismiss");

		const submitBtn = page.locator('button[class*="bg-\\[#8b4513\\]"]').first();
		await submitBtn.click();
		await page.waitForTimeout(500);

		// Verify error is shown - use specific selector to avoid delete buttons
		const errorBanner = page.locator('div[class*="bg-red-500"][class*="animate-fade-in"]');
		await expect(errorBanner).toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/quick-create-05-error-before-dismiss.png",
			fullPage: true,
		});

		// Click dismiss button (X) - it's inside the error banner
		const dismissBtn = errorBanner.locator("button");
		await dismissBtn.click();
		await page.waitForTimeout(300);

		// Verify error is gone
		await expect(errorBanner).not.toBeVisible();

		await page.screenshot({
			path: "test-results/screenshots/quick-create-06-error-dismissed.png",
			fullPage: true,
		});
	});
});
