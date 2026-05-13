import { test } from "@playwright/test";

test.describe("Workboard UI Screenshots", () => {
	test("capture project overview", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");
		await page.screenshot({ path: "/tmp/workboard-home.png", fullPage: true });
	});

	test("capture spec writer", async ({ page }) => {
		await page.goto("/spec-writer");
		await page.waitForLoadState("networkidle");
		await page.screenshot({ path: "/tmp/workboard-spec-writer.png", fullPage: true });
	});

	test("capture plan mode", async ({ page }) => {
		await page.goto("/plan");
		await page.waitForLoadState("networkidle");
		await page.screenshot({ path: "/tmp/workboard-plan.png", fullPage: true });
	});
});
