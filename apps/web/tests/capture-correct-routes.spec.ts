import { test } from "@playwright/test";

test.describe("Workboard UI - Correct Routes", () => {
	test("capture spec writer with correct route", async ({ page }) => {
		await page.goto("/projects/workboard/spec-writer");
		await page.waitForLoadState("networkidle");
		await page.waitForTimeout(1500);
		await page.screenshot({ path: "/tmp/spec-writer-correct.png", fullPage: true });
	});
});
