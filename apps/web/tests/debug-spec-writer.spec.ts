import { test } from "@playwright/test";

test("debug spec writer page", async ({ page }) => {
	// Enable console logging
	page.on("console", (msg) => console.log("BROWSER:", msg.text()));
	page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));

	await page.goto("/spec-writer");
	await page.waitForLoadState("networkidle");
	await page.waitForTimeout(2000);

	// Take screenshot after wait
	await page.screenshot({ path: "/tmp/spec-writer-debug.png", fullPage: true });

	// Get page content
	const html = await page.content();
	console.log("Page has content length:", html.length);

	// Check for any visible text
	const bodyText = await page.locator("body").textContent();
	console.log("Body text:", bodyText?.substring(0, 500));
});
