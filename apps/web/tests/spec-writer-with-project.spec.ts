import { test } from "@playwright/test";

test("capture spec writer with project", async ({ page }) => {
	await page.goto("/spec-writer?projectId=workboard");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(2000);
	await page.screenshot({ path: "/tmp/spec-writer-workboard.png", fullPage: true });

	const text = await page.locator("body").textContent();
	console.log("Visible text:", text?.substring(0, 300));
});
