import { expect, test } from "@playwright/test";

test.describe("Inbox Hub Filter Persistence", () => {
	test.beforeEach(async ({ page }) => {
		// Clear localStorage before each test to ensure clean state
		await page.goto("/");
		await page.evaluate(() => {
			localStorage.removeItem("wrkq:inbox-hub-project-filter");
			localStorage.removeItem("wrkq:inbox-hub-filtersets");
		});
	});

	test("custom filter persists after hard refresh", async ({ page }) => {
		// 1. Navigate to Inbox Hub
		await page.goto("/inbox-hub");

		// 2. Look for the filter button - wait for it to show the count (e.g., "Filter X/Y")
		// The count span appears after filterReady && totalWorkspaceCount > 0
		const filterButton = page.locator('button:has-text("Filter")').first();
		await expect(filterButton).toBeVisible({ timeout: 15000 });

		// Wait for the count to appear in the button (indicates projects have loaded)
		await expect(filterButton).toContainText(/\d+\/\d+/, { timeout: 15000 });

		// Get the initial project count text (format: "Filter 5/5" or "Filter 3/5")
		const initialText = await filterButton.textContent();
		expect(initialText).toBeTruthy();

		// Parse the count (e.g., "5/5" or "3/5")
		const countMatch = initialText?.match(/(\d+)\/(\d+)/);
		if (!countMatch) {
			// Skip test if count is not visible (shouldn't happen after above wait)
			test.skip();
			return;
		}

		const totalProjects = Number.parseInt(countMatch[2], 10);

		// Need at least 2 projects to test filter persistence
		if (totalProjects < 2) {
			test.skip();
			return;
		}

		// 3. Open filter modal
		await filterButton.click();

		// Wait for the modal to appear
		const modal = page.locator('[role="dialog"], [class*="modal"]').first();
		await expect(modal).toBeVisible({ timeout: 5000 });

		// 4. Find project toggle buttons and click the first one to deselect it
		// The modal uses custom styled buttons, not <input type="checkbox">
		// Each project toggle is a <div draggable> containing a <button> with the project name
		const projectToggles = modal.locator('div[draggable="true"]');
		const toggleCount = await projectToggles.count();

		if (toggleCount === 0) {
			test.skip();
			return;
		}

		// Click the first project toggle to deselect it
		const firstToggle = projectToggles.first();
		const toggleButton = firstToggle.locator("button");
		await toggleButton.click();

		// 5. Save the filter (click Apply/Save button)
		const saveButton = modal
			.locator("button")
			.filter({ hasText: /apply|save|done|confirm/i })
			.first();
		await saveButton.click();

		// Wait for modal to close
		await expect(modal).not.toBeVisible({ timeout: 5000 });

		// 6. Verify filter indicator shows reduced count
		await expect(filterButton).toBeVisible();
		const afterFilterText = await filterButton.textContent();

		// Should show something like "Filter 4/5" now (reduced count)
		const afterFractionMatch = afterFilterText?.match(/(\d+)\/(\d+)/);
		expect(afterFractionMatch).toBeTruthy();
		const selectedAfter = Number.parseInt(afterFractionMatch![1], 10);
		const totalAfter = Number.parseInt(afterFractionMatch![2], 10);

		// Verify we actually filtered something
		expect(selectedAfter).toBeLessThan(totalAfter);

		// Store the values for comparison after reload
		const expectedSelected = selectedAfter;
		const expectedTotal = totalAfter;

		// 7. Hard refresh (page.reload())
		await page.reload();

		// 8. Verify filter indicator still shows the same reduced count
		const filterButtonAfterReload = page.locator('button:has-text("Filter")').first();
		await expect(filterButtonAfterReload).toBeVisible({ timeout: 15000 });
		// Wait for the count to appear again
		await expect(filterButtonAfterReload).toContainText(/\d+\/\d+/, { timeout: 15000 });

		const afterReloadText = await filterButtonAfterReload.textContent();
		const afterReloadMatch = afterReloadText?.match(/(\d+)\/(\d+)/);

		// The filter should persist after reload
		expect(afterReloadMatch).toBeTruthy();
		const selectedAfterReload = Number.parseInt(afterReloadMatch![1], 10);
		const totalAfterReload = Number.parseInt(afterReloadMatch![2], 10);

		expect(selectedAfterReload).toBe(expectedSelected);
		expect(totalAfterReload).toBe(expectedTotal);
	});

	// Note: Additional test for filterset modification behavior could be added here
	// when filterset UI is more stable and has data-testid attributes
});
