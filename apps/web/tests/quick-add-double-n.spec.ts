import { expect, test } from "@playwright/test";

/**
 * Tests for the double-n keyboard navigation bug fix (T-00410)
 *
 * Bug: After creating a task via quick-add (triggered by pressing 'n'),
 * pressing 'n' again should reopen the quick-add card. Previously, the
 * parent state (quickAddColumnIndex) wasn't being reset on successful
 * task creation, so subsequent 'n' presses had no effect.
 *
 * This test uses the live API (control-plane) to verify the fix works
 * in a realistic environment.
 */

test.describe("Quick Add Double-N Keyboard Navigation", () => {
	test("pressing n after task creation reopens quick-add card", async ({ page }) => {
		await page.goto("/inbox-hub");
		// Wait for DOM to settle
		await page.waitForTimeout(1500);

		// Activate keyboard mode by pressing a navigation key
		await page.keyboard.press("Tab");
		await page.waitForTimeout(100);

		// Press 'h' to enter keyboard navigation mode (move focus left)
		await page.keyboard.press("h");
		await page.waitForTimeout(200);

		// Screenshot initial state
		await page.screenshot({
			path: "test-results/screenshots/double-n-01-initial.png",
			fullPage: true,
		});

		// Step 1: Press 'n' to open quick-add
		await page.keyboard.press("n");
		await page.waitForTimeout(300);

		// Verify quick-add card is visible
		const titleInput = page.locator('textarea[placeholder="Task name"]');
		await expect(titleInput).toBeVisible({ timeout: 3000 });

		await page.screenshot({
			path: "test-results/screenshots/double-n-02-first-quickadd-open.png",
			fullPage: true,
		});

		// Step 2: Fill in task title with unique name and submit
		const uniqueTitle = `Test Task ${Date.now()}`;
		await titleInput.fill(uniqueTitle);

		// Submit using Enter (Cmd/Ctrl+Enter may have different behavior)
		await page.keyboard.press("Enter");
		// Wait for API call and UI update
		await page.waitForTimeout(1000);

		// Verify the quick-add card is closed (task created successfully)
		await expect(titleInput).not.toBeVisible({ timeout: 5000 });

		await page.screenshot({
			path: "test-results/screenshots/double-n-03-first-task-created.png",
			fullPage: true,
		});

		// Step 3: Press 'n' again - THIS IS THE BUG FIX TEST
		await page.keyboard.press("n");
		await page.waitForTimeout(300);

		// Verify quick-add card reopens
		const titleInputAgain = page.locator('textarea[placeholder="Task name"]');
		await expect(titleInputAgain).toBeVisible({ timeout: 3000 });

		await page.screenshot({
			path: "test-results/screenshots/double-n-04-second-quickadd-open.png",
			fullPage: true,
		});

		// Clean up: press Escape to close the second quick-add
		await page.keyboard.press("Escape");
		await page.waitForTimeout(200);
		await expect(titleInputAgain).not.toBeVisible({ timeout: 3000 });
	});

	test("pressing Escape then n reopens quick-add (existing behavior)", async ({ page }) => {
		await page.goto("/inbox-hub");
		// Wait for DOM to settle rather than networkidle (which times out with polling APIs)
		await page.waitForTimeout(1500);

		// Enter keyboard mode
		await page.keyboard.press("Tab");
		await page.keyboard.press("h");
		await page.waitForTimeout(200);

		// Open quick-add with 'n'
		await page.keyboard.press("n");
		await page.waitForTimeout(300);

		const titleInput = page.locator('textarea[placeholder="Task name"]');
		await expect(titleInput).toBeVisible({ timeout: 3000 });

		// Press Escape to close without creating
		await page.keyboard.press("Escape");
		await page.waitForTimeout(300);

		await expect(titleInput).not.toBeVisible({ timeout: 3000 });

		// Press 'n' again - should reopen (this was already working)
		await page.keyboard.press("n");
		await page.waitForTimeout(300);

		await expect(titleInput).toBeVisible({ timeout: 3000 });

		await page.screenshot({
			path: "test-results/screenshots/double-n-06-escape-then-n.png",
			fullPage: true,
		});
	});
});
