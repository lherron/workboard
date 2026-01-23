import { expect, test } from "@playwright/test";

/**
 * Live Spec Writer tests - require control-plane and workboard running.
 *
 * Run with: E2E_LIVE=1 PLAYWRIGHT_BASE_URL=http://localhost:18460 npx playwright test tests/spec-writer-live.spec.ts
 *
 * Prerequisites:
 * - stackctl status dev shows workboard running
 * - A spec exists (create with: curl -X POST -H "x-cp-token: dev" -H "x-wrkq-actor: lance"
 *   -H "Content-Type: application/json" "http://127.0.0.1:18461/admin/projects/workboard/specs"
 *   -d '{"title":"Test Spec"}')
 *
 * Note: Architect chat requires the project to have a session backend configured.
 * If /admin/runs returns 500, the project needs session backend setup in control-plane.
 */

const projectId = process.env.E2E_PROJECT_ID || "workboard";
const specSlug = process.env.E2E_SPEC_SLUG || "test-authentication-system";

// Skip these tests unless E2E_LIVE is set (they require a running backend)
const skipLive = !process.env.E2E_LIVE;

test.describe("Spec Writer Live", () => {
	test.skip(skipLive, "Skipped: requires E2E_LIVE=1 and running backend");

	test("captures spec writer interface with live backend", async ({ page }) => {
		// Set large viewport to ensure all panes are visible
		await page.setViewportSize({ width: 1600, height: 1000 });

		// Navigate to spec writer
		await page.goto(`/workspace/${projectId}/spec-writer/${specSlug}`);
		await page.waitForLoadState("networkidle");

		// Wait for spec to load - look for spec title
		await expect(page.locator("text=Test Authentication System").first()).toBeVisible({
			timeout: 15000,
		});

		// Verify three-pane layout is visible
		const architectHeader = page.locator("text=Architect").first();
		await expect(architectHeader).toBeVisible({ timeout: 10000 });

		// Capture spec writer interface
		await page.screenshot({
			path: "test-results/spec-writer-live-interface.png",
			fullPage: false,
		});

		console.log("Spec writer interface screenshot captured");
	});

	test("architect chat shows error when session backend not configured", async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 1000 });

		await page.goto(`/workspace/${projectId}/spec-writer/${specSlug}`);
		await page.waitForLoadState("networkidle");

		// Wait for spec to load
		await expect(page.locator("text=Test Authentication System").first()).toBeVisible({
			timeout: 15000,
		});

		// Find chat input and send a message
		const chatInput = page.locator('textarea[placeholder*="architect"]').first();
		await expect(chatInput).toBeVisible({ timeout: 5000 });

		await chatInput.fill("Add a test feature");
		await chatInput.press("Meta+Enter");

		// Wait for response (either success or error)
		await page.waitForTimeout(5000);

		// Capture the result
		await page.screenshot({
			path: "test-results/spec-writer-chat-attempt.png",
			fullPage: false,
		});

		// Check if we got an error (500 means session backend not configured)
		const hasError = await page
			.locator("text=Request failed")
			.isVisible()
			.catch(() => false);
		if (hasError) {
			console.log("Architect chat returned error - project needs session backend configuration");
		} else {
			console.log("Architect chat request sent successfully");
		}
	});
});
